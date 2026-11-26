import { describe, it, expect, vi, beforeEach } from "vitest";
import { BlogService } from "../blog.service";
import { BlogRepository } from "../blog.repository";
import { NotFoundError, ConflictError, ValidationError } from "../../../core/errors/AppError";
import { clearBlogCaches } from "../../../core/cache/redis";

describe("BlogService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearBlogCaches();
  });

  describe("createPost", () => {
    it("should throw ValidationError if title or content is missing", async () => {
      await expect(BlogService.createPost({ title: "", content: "abc" })).rejects.toThrow(ValidationError);
      await expect(BlogService.createPost({ title: "My Post", content: "" })).rejects.toThrow(ValidationError);
    });

    it("should auto-generate slug and calculate reading time and word count", async () => {
      vi.spyOn(BlogRepository, "findPostBySlug").mockResolvedValue(null);
      vi.spyOn(BlogRepository, "createPost").mockImplementation(async (data) => ({
        _id: "post123",
        ...data,
      } as any));
      vi.spyOn(BlogRepository, "countPostsByCategory").mockResolvedValue(1);
      vi.spyOn(BlogRepository, "updateCategoryArticleCount").mockResolvedValue(undefined);

      const post = await BlogService.createPost({
        title: "Top 5 Helmets for Monsoon Riding",
        content: "<p>This is a guide on choosing helmets in wet monsoon season in India.</p>",
        categorySlug: "helmets",
      });

      expect(post.slug).toBe("top-5-helmets-for-monsoon-riding");
      expect(post.wordCount).toBeGreaterThan(0);
      expect(post.readingTimeMinutes).toBe(1);
      expect(BlogRepository.createPost).toHaveBeenCalled();
    });

    it("should throw ConflictError if slug already exists", async () => {
      vi.spyOn(BlogRepository, "findPostBySlug").mockResolvedValue({
        _id: "existing123",
        slug: "top-5-helmets",
      } as any);

      await expect(
        BlogService.createPost({
          title: "Top 5 Helmets",
          content: "Some content here...",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("updatePost", () => {
    it("should update post content and recalculate word count", async () => {
      vi.spyOn(BlogRepository, "findPostById").mockResolvedValue({
        _id: "post123",
        title: "Old Title",
        slug: "old-title",
        content: "short content",
        wordCount: 2,
        readingTimeMinutes: 1,
      } as any);

      vi.spyOn(BlogRepository, "updatePost").mockImplementation(async (id, data) => ({
        _id: id,
        ...data,
      } as any));

      const updated = await BlogService.updatePost("post123", {
        title: "Updated Title",
        content: "<p>New comprehensive guide with much more detailed content about motorcycle maintenance in India.</p>",
      });

      expect(updated.title).toBe("Updated Title");
      expect(updated.wordCount).toBeGreaterThan(5);
    });

    it("should throw NotFoundError if post does not exist", async () => {
      vi.spyOn(BlogRepository, "findPostById").mockResolvedValue(null);

      await expect(
        BlogService.updatePost("non-existent-id", { title: "Test" })
      ).rejects.toThrow(NotFoundError);
    });

    it("should recalculate category count when status changes within same category", async () => {
      vi.spyOn(BlogRepository, "findPostById").mockResolvedValue({
        _id: "post123",
        title: "Helmet Guide",
        slug: "helmet-guide",
        content: "content",
        status: "draft",
        categorySlug: "choosing-correct-riding-gear",
      } as any);
      vi.spyOn(BlogRepository, "updatePost").mockResolvedValue({
        _id: "post123",
        status: "published",
        categorySlug: "choosing-correct-riding-gear",
      } as any);
      vi.spyOn(BlogRepository, "countPostsByCategory").mockResolvedValue(12);
      const updateCountSpy = vi.spyOn(BlogRepository, "updateCategoryArticleCount").mockResolvedValue(undefined);

      await BlogService.updatePost("post123", { status: "published" });

      expect(updateCountSpy).toHaveBeenCalledWith("choosing-correct-riding-gear", 12);
    });
  });

  describe("getPosts", () => {
    it("should escape regex special characters in search and tag filters", async () => {
      const findPostsSpy = vi.spyOn(BlogRepository, "findPosts").mockResolvedValue({
        items: [],
        totalCount: 0,
      });

      await BlogService.getPosts({
        search: "helmet (ECE 22.06)+",
        tag: "ECE+22.06",
      });

      const filterArg = findPostsSpy.mock.calls[0][0] as any;
      expect(filterArg.tags).toBeInstanceOf(RegExp);
      expect(filterArg.$or).toHaveLength(3);
      expect(() => filterArg.$or[0].title.test("helmet (ECE 22.06)+")).not.toThrow();
    });
  });

  describe("deletePost", () => {
    it("should delete post and update category count", async () => {
      vi.spyOn(BlogRepository, "deletePost").mockResolvedValue({
        _id: "post123",
        categorySlug: "riding-gear",
      } as any);
      vi.spyOn(BlogRepository, "countPostsByCategory").mockResolvedValue(0);
      vi.spyOn(BlogRepository, "updateCategoryArticleCount").mockResolvedValue(undefined);

      const deleted = await BlogService.deletePost("post123");
      expect(deleted._id).toBe("post123");
      expect(BlogRepository.updateCategoryArticleCount).toHaveBeenCalledWith("riding-gear", 0);
    });
  });

  describe("categories", () => {
    it("should create category with slugified name", async () => {
      vi.spyOn(BlogRepository, "findCategoryBySlug").mockResolvedValue(null);
      vi.spyOn(BlogRepository, "createCategory").mockImplementation(async (data) => ({
        _id: "cat123",
        ...data,
      } as any));

      const cat = await BlogService.createCategory({
        name: "Helmet Maintenance",
        description: "Tips to maintain helmets",
      });

      expect(cat.slug).toBe("helmet-maintenance");
      expect(BlogRepository.createCategory).toHaveBeenCalled();
    });

    it("should throw ConflictError if category slug already exists", async () => {
      vi.spyOn(BlogRepository, "findCategoryBySlug").mockResolvedValue({
        _id: "existing-cat",
        slug: "helmets",
      } as any);

      await expect(
        BlogService.createCategory({
          name: "Helmets",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("caching & invalidation", () => {
    it("should cache public getPosts responses and invalidate cache on createPost", async () => {
      const findPostsSpy = vi.spyOn(BlogRepository, "findPosts").mockResolvedValue({
        items: [{ _id: "p1", title: "Cached Guide", slug: "cached-guide" } as any],
        totalCount: 1,
      });

      const first = await BlogService.getPosts({ status: "published", page: 1, limit: 18 });
      const second = await BlogService.getPosts({ status: "published", page: 1, limit: 18 });

      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      expect(findPostsSpy).toHaveBeenCalledTimes(1);

      vi.spyOn(BlogRepository, "findPostBySlug").mockResolvedValue(null);
      vi.spyOn(BlogRepository, "createPost").mockResolvedValue({
        _id: "p2",
        title: "Fresh Guide",
        slug: "fresh-guide",
      } as any);
      vi.spyOn(BlogRepository, "countPostsByCategory").mockResolvedValue(1);
      vi.spyOn(BlogRepository, "updateCategoryArticleCount").mockResolvedValue(undefined);

      await BlogService.createPost({
        title: "Fresh Guide",
        content: "<p>Brand new riding guide content.</p>",
      });

      await BlogService.getPosts({ status: "published", page: 1, limit: 18 });
      expect(findPostsSpy).toHaveBeenCalledTimes(2);
    });

    it("should resolve related posts using lightweight metadata lookup without fetching full content", async () => {
      const slugSpy = vi.spyOn(BlogRepository, "findPostBySlug").mockResolvedValue({
        slug: "helmet-guide",
        categorySlug: "choosing-correct-riding-gear",
        tags: ["helmets"],
      } as any);
      const relatedSpy = vi.spyOn(BlogRepository, "findRelatedPosts").mockResolvedValue([]);

      await BlogService.getRelatedPosts("helmet-guide", 3);

      expect(slugSpy).toHaveBeenCalledWith("helmet-guide", "slug categorySlug tags");
      expect(relatedSpy).toHaveBeenCalledWith("helmet-guide", "choosing-correct-riding-gear", ["helmets"], 3);
    });
  });
});
