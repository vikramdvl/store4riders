import { UrlRedirectRepository } from "./url-redirect.repository";
import {
  IUrlRedirect,
  IUrlRedirectResolveResult,
  UrlRedirectSource,
} from "@store4riders/shared-types";
import { ConflictError, NotFoundError, ValidationError } from "../../core/errors/AppError";
import { clearUrlRedirectCaches, getCache, setCache } from "../../core/cache/redis";
import { logger } from "../../core/utils/logger";
import { normalizeRedirectPath, normalizeSourcePath } from "@store4riders/shared-validation";

const URL_REDIRECT_MAP_CACHE_KEY = "url_redirect_map_v1";
const URL_REDIRECT_SINGLE_PREFIX = "url_redirect_single_v1_";
const URL_REDIRECT_TTL = 600; // 10 minutes

export class UrlRedirectService {
  static async list(page = 1, limit = 20, search?: string, source?: string) {
    return UrlRedirectRepository.list(page, limit, search, source);
  }

  static async getById(id: string): Promise<IUrlRedirect> {
    const doc = await UrlRedirectRepository.findById(id);
    if (!doc) {
      throw new NotFoundError("URL redirect");
    }
    return doc;
  }

  private static async assertNoCircularLoop(fromPath: string, toPath: string, ignoreId?: string) {
    if (fromPath === toPath) {
      throw new ValidationError("Source path and destination URL cannot be the same");
    }

    // Only check internal path chains
    if (!toPath.startsWith("/")) return;

    const visited = new Set<string>([fromPath]);
    let cursor = normalizeSourcePath(toPath);
    let depth = 0;

    while (cursor && depth < 10) {
      if (visited.has(cursor)) {
        throw new ValidationError(
          `Circular redirect loop detected between "${fromPath}" and "${toPath}"`
        );
      }
      visited.add(cursor);

      const next = await UrlRedirectRepository.findByFromPath(cursor);
      if (!next || !next.isActive || (ignoreId && String(next._id) === String(ignoreId))) {
        break;
      }
      if (!next.toPath.startsWith("/")) {
        break;
      }
      cursor = normalizeSourcePath(next.toPath);
      depth += 1;
    }
  }

  static async create(data: Partial<IUrlRedirect>): Promise<IUrlRedirect> {
    const fromPath = normalizeSourcePath(data.fromPath || "");
    const toPath = normalizeRedirectPath(data.toPath || "");

    const existing = await UrlRedirectRepository.findByFromPath(fromPath);
    if (existing) {
      throw new ConflictError(`A redirect rule for "${fromPath}" already exists`);
    }

    await this.assertNoCircularLoop(fromPath, toPath);

    const created = await UrlRedirectRepository.create({
      ...data,
      fromPath,
      toPath,
      source: data.source || "manual",
    });

    await clearUrlRedirectCaches();
    return created;
  }

  static async update(id: string, data: Partial<IUrlRedirect>): Promise<IUrlRedirect> {
    const existing = await UrlRedirectRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("URL redirect");
    }

    const nextFrom = data.fromPath ? normalizeSourcePath(data.fromPath) : existing.fromPath;
    const nextTo = data.toPath ? normalizeRedirectPath(data.toPath) : existing.toPath;

    if (nextFrom !== existing.fromPath) {
      const conflict = await UrlRedirectRepository.findByFromPath(nextFrom);
      if (conflict && String(conflict._id) !== String(id)) {
        throw new ConflictError(`A redirect rule for "${nextFrom}" already exists`);
      }
    }

    await this.assertNoCircularLoop(nextFrom, nextTo, id);

    const updated = await UrlRedirectRepository.update(id, {
      ...data,
      fromPath: nextFrom,
      toPath: nextTo,
    });
    if (!updated) {
      throw new NotFoundError("URL redirect");
    }

    await clearUrlRedirectCaches();
    return updated;
  }

  static async delete(id: string): Promise<boolean> {
    const deleted = await UrlRedirectRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError("URL redirect");
    }
    await clearUrlRedirectCaches();
    return true;
  }

  /**
   * Automatically records a 301 Permanent Redirect whenever an entity slug changes.
   * Also cleans up inverse loops (if slug flipped back A -> B -> A) and flattens chains (X -> A becomes X -> B).
   */
  static async recordSlugChange(
    rawOldPath: string,
    rawNewPath: string,
    source: UrlRedirectSource,
    note?: string
  ): Promise<void> {
    const fromPath = normalizeSourcePath(rawOldPath);
    const toPath = normalizeRedirectPath(rawNewPath);

    if (!fromPath || fromPath === "/" || !toPath || fromPath === toPath) {
      return;
    }

    try {
      // If the new slug previously had an outbound redirect (e.g. product flipped B -> A), remove it so A doesn't bounce back to B
      await UrlRedirectRepository.deleteByFromPath(toPath);

      // Flatten existing redirects that pointed to oldPath so they point straight to newPath (avoid multi-hop chains)
      await UrlRedirectRepository.repointDestination(fromPath, toPath);

      // Upsert 301 permanent redirect for oldPath -> newPath
      await UrlRedirectRepository.upsertAutoRedirect(
        fromPath,
        toPath,
        source,
        note || `Auto 301 redirect from slug change`
      );

      await clearUrlRedirectCaches();
    } catch (err: any) {
      logger.warn("Failed to record automatic slug redirect", {
        fromPath,
        toPath,
        source,
        error: err?.message,
      });
    }
  }

  static async resolvePath(rawPath: string): Promise<IUrlRedirectResolveResult> {
    const normalized = normalizeSourcePath(rawPath);
    if (!normalized || normalized === "/") {
      return { matched: false };
    }

    const cacheKey = `${URL_REDIRECT_SINGLE_PREFIX}${normalized}`;
    const cached = await getCache(cacheKey);
    if (cached && typeof cached === "object" && "matched" in cached) {
      if (cached.matched && cached._id) {
        UrlRedirectRepository.incrementHitCount(cached._id).catch(() => {});
      }
      return {
        matched: Boolean(cached.matched),
        toPath: cached.toPath,
        statusCode: cached.statusCode,
      };
    }

    const doc = await UrlRedirectRepository.findActiveByFromPath(normalized);
    if (!doc) {
      await setCache(cacheKey, { matched: false }, 120);
      return { matched: false };
    }

    await setCache(
      cacheKey,
      {
        matched: true,
        _id: String(doc._id),
        toPath: doc.toPath,
        statusCode: doc.statusCode,
      },
      URL_REDIRECT_TTL
    );

    if (doc._id) {
      UrlRedirectRepository.incrementHitCount(String(doc._id)).catch(() => {});
    }

    return {
      matched: true,
      toPath: doc.toPath,
      statusCode: doc.statusCode,
    };
  }

  static async getActiveRedirectMap(): Promise<
    Array<{ fromPath: string; toPath: string; statusCode: 301 | 302 }>
  > {
    const cached = await getCache(URL_REDIRECT_MAP_CACHE_KEY);
    if (Array.isArray(cached)) {
      return cached;
    }

    const map = await UrlRedirectRepository.findAllActiveMap();
    await setCache(URL_REDIRECT_MAP_CACHE_KEY, map, URL_REDIRECT_TTL);
    return map;
  }
}
