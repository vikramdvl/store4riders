import { ReviewRepository } from "./review.repository";
import { IReview, IStoreReview } from "@store4riders/shared-types";
import { ConflictError, ValidationError, AppError, NotFoundError } from "../../core/errors/AppError";
import { logger } from "../../core/utils/logger";
import { getCache, setCache, deleteCache, clearReviewCaches, clearProductCaches } from "../../core/cache/redis";

const REVIEW_CACHE_TTL = 1800; // 30 minutes (invalidated instantly on review write/sync)
const STORE_REVIEWS_POOL_KEY = "reviews_store_pool_v1";
const STORE_REVIEWS_POOL_LIMIT = 50;

/**
 * @class ReviewService
 * @description Core business logic for Product & Store (Google) Reviews.
 */
export class ReviewService {
  static async addReview(userId: string, data: Partial<IReview>): Promise<IReview> {
    const existing = await ReviewRepository.findByUserAndProduct(userId, data.productId!);
    if (existing) {
      throw new ConflictError("You have already reviewed this product");
    }

    const review = await ReviewRepository.create({ ...data, userId });

    // Recalculate average rating & review count for the product
    try {
      const stats = await ReviewRepository.calculateRatingStats(data.productId!);
      const { ProductRepository } = await import("../product/product.repository");
      await ProductRepository.updateRatingStats(data.productId!, stats.avgRating, stats.reviewCount);
      await clearProductCaches(Boolean(data.productId)).catch(() => {});
      logger.info(`Updated rating stats for product ${data.productId}`, stats);
    } catch (err: any) {
      logger.error("Failed to update product rating stats", { error: err.message, productId: data.productId });
    }

    await deleteCache(`reviews_product_v1_${data.productId}`);
    return review;
  }

  static async getProductReviews(productId: string): Promise<IReview[]> {
    const cacheKey = `reviews_product_v1_${productId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached as IReview[];

    const reviews = await ReviewRepository.findByProductId(productId);
    await setCache(cacheKey, reviews, REVIEW_CACHE_TTL);
    return reviews;
  }

  static async getStoreReviews(
    limit: number = 10,
    random: boolean = false,
    excludeIds: string[] = []
  ): Promise<IStoreReview[]> {
    // Fast-path: serve both random and filtered store review requests from a cached 50-item pool
    if (limit <= STORE_REVIEWS_POOL_LIMIT) {
      let pool = (await getCache(STORE_REVIEWS_POOL_KEY)) as IStoreReview[] | null;
      if (!Array.isArray(pool) || pool.length === 0) {
        pool = await ReviewRepository.getStoreReviews(STORE_REVIEWS_POOL_LIMIT, false, []);
        if (pool.length === 0 && process.env.SERPAPI_KEY) {
          try {
            logger.info("Store reviews collection is empty in DB. Auto-syncing from Google via SerpApi...");
            pool = await this.syncGoogleReviews();
          } catch (err: any) {
            logger.warn("Auto-syncing Google reviews on empty state failed", { error: err.message });
          }
        }
        if (pool.length > 0) {
          await setCache(STORE_REVIEWS_POOL_KEY, pool, REVIEW_CACHE_TTL);
        }
      }

      const excludeSet = new Set(excludeIds.map((id) => String(id)));
      const filtered = excludeSet.size > 0
        ? pool.filter((r: any) => !excludeSet.has(String(r._id || "")) && !excludeSet.has(String(r.externalId || "")))
        : pool;

      if (random && filtered.length > 1) {
        const shuffled = [...filtered];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, limit);
      }

      return filtered.slice(0, limit);
    }

    let reviews = await ReviewRepository.getStoreReviews(limit, random, excludeIds);
    if (reviews.length === 0 && process.env.SERPAPI_KEY) {
      try {
        logger.info("Store reviews collection is empty in DB. Auto-syncing from Google via SerpApi...");
        reviews = await this.syncGoogleReviews();
      } catch (err: any) {
        logger.warn("Auto-syncing Google reviews on empty state failed", { error: err.message });
      }
    }

    return reviews;
  }

  static async getStoreRatingStats(): Promise<{ rating: number; reviewCount: string }> {
    const cacheKey = "reviews_store_stats_v1";
    const cached = await getCache(cacheKey);
    if (cached && typeof cached === "object") {
      return cached as { rating: number; reviewCount: string };
    }

    try {
      const { SettingRepository } = await import("../settings/setting.repository");
      const settings = await SettingRepository.getSettings();
      if (settings.googleLastSyncedAt && settings.googleRating && settings.googleRating > 0) {
        const result = {
          rating: settings.googleRating,
          reviewCount: settings.googleReviewCount ? String(settings.googleReviewCount) : "",
        };
        await setCache(cacheKey, result, REVIEW_CACHE_TTL);
        return result;
      }
    } catch {
      // Fallback to reviews calculation
    }
    const stats = await ReviewRepository.calculateStoreRatingStats();
    const result = {
      rating: stats.avgRating,
      reviewCount: stats.reviewCount > 0 ? `${stats.reviewCount}+` : "",
    };
    await setCache(cacheKey, result, REVIEW_CACHE_TTL);
    return result;
  }

  static async syncGoogleReviews(apiKey?: string, pages: number = 1): Promise<IStoreReview[]> {
    const resolvedKey = apiKey || process.env.SERPAPI_KEY;
    if (!resolvedKey) {
      throw new ValidationError("SerpApi key is required. Please provide it in the request or set SERPAPI_KEY in environment variables.");
    }

    const maxPages = Math.min(Math.max(pages, 1), 10);
    const allReviews: any[] = [];
    let nextToken: string | undefined = undefined;
    let placeRating: number | undefined = undefined;
    let placeReviewsCount: number | undefined = undefined;

    logger.info(`Fetching up to ${maxPages} page(s) of Google Reviews from SerpApi`);

    for (let p = 0; p < maxPages; p++) {
      let url = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=0x3bc2c00d5a48819f:0xd4b529549919577c&api_key=${resolvedKey}`;
      if (nextToken) {
        url += `&next_page_token=${encodeURIComponent(nextToken)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        if (allReviews.length > 0) break;
        logger.error("SerpApi returned error", { error: data.error });
        throw new AppError(`SerpApi error: ${data.error}`, 502);
      }

      // Extract dynamic live store rating directly from Google Maps place_info
      if (p === 0 && data.place_info) {
        if (typeof data.place_info.rating === "number") {
          placeRating = data.place_info.rating;
        } else if (typeof data.place_info.rating === "string") {
          placeRating = parseFloat(data.place_info.rating);
        }
        if (data.place_info.reviews !== undefined) {
          placeReviewsCount = typeof data.place_info.reviews === "number"
            ? data.place_info.reviews
            : parseInt(String(data.place_info.reviews), 10);
        }
      }

      if (!data.reviews || !Array.isArray(data.reviews) || data.reviews.length === 0) {
        break;
      }

      allReviews.push(...data.reviews);
      nextToken = data.serpapi_pagination?.next_page_token;
      if (!nextToken) break;
    }

    if (allReviews.length === 0) {
      throw new NotFoundError("No reviews returned from SerpApi for this location");
    }

    const mapped = allReviews.map((r: any, idx: number) => ({
      author: r.user?.name || "Customer",
      rating: typeof r.rating === "number" ? r.rating : 5,
      date: r.date || "Recently",
      text: r.snippet || r.extracted_snippet?.original || "",
      link: r.link || r.share_link || "https://www.google.com/search?q=Store4Riders+Pune#lrd=0x3bc2c00d5a48819f:0xd4b529549919577c,1,,,,",
      avatarUrl: r.user?.thumbnail || undefined,
      source: "google" as const,
      externalId: r.review_id || `google-rev-${(r.user?.name || "customer").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${idx}`,
      isActive: true,
    }));

    const saved = await ReviewRepository.saveStoreReviews(mapped);
    logger.info(`Successfully saved ${saved.length} store reviews to database across ${maxPages} page(s)`);

    // Dynamically persist live Google Maps rating to Settings
    if (placeRating !== undefined || placeReviewsCount !== undefined) {
      try {
        const { SettingRepository } = await import("../settings/setting.repository");
        await SettingRepository.updateSettings({
          ...(placeRating !== undefined && !isNaN(placeRating) ? { googleRating: placeRating } : {}),
          ...(placeReviewsCount ? { googleReviewCount: `${placeReviewsCount}+` } : {}),
          googleLastSyncedAt: new Date(),
        });
        logger.info(`Updated Google Store rating: ${placeRating}, reviews: ${placeReviewsCount}`);
      } catch (err: any) {
        logger.warn("Failed to update settings with Google rating", { error: err.message });
      }
    }

    await clearReviewCaches();
    return saved;
  }

  static async getAccountStatus(apiKey?: string): Promise<{
    planName: string;
    searchesPerMonth: number;
    searchesLeft: number;
    usageThisMonth: number;
    renewalDate: string | null;
  } | null> {
    const resolvedKey = apiKey || process.env.SERPAPI_KEY;
    if (!resolvedKey) return null;

    try {
      const res = await fetch(`https://serpapi.com/account.json?api_key=${resolvedKey}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        planName: data.plan_name || "Free Plan",
        searchesPerMonth: data.searches_per_month ?? 250,
        searchesLeft: data.total_searches_left ?? data.plan_searches_left ?? 0,
        usageThisMonth: data.this_month_usage ?? 0,
        renewalDate: data.plan_renewal_date || null,
      };
    } catch {
      return null;
    }
  }
}
