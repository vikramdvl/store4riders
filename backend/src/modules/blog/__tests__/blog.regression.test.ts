import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { BlogRepository } from "../blog.repository";
import { BlogService } from "../blog.service";
import { BlogController } from "../blog.controller";
import { BlogPostModel, BlogCategoryModel } from "../blog.model";

describe("Blog Module Regression Suite (Repository, Service & Controller)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("BlogRepository Payload & ObjectId Safety", () => {
    it("findPosts must exclude heavy HTML content field (.select('-content')) to prevent >2MB list payloads", async () => {
      const selectMock = vi.fn().mockReturnThis();
      const sortMock = vi.fn().mockReturnThis();
      const skipMock = vi.fn().mockReturnThis();
      const limitMock = vi.fn().mockReturnThis();
      const leanMock = vi.fn().mockReturnThis();
      const execMock = vi.fn().mockResolvedValue([]);

      vi.spyOn(BlogPostModel, "find").mockReturnValue({
        select: selectMock,
        sort: sortMock,
        skip: skipMock,
        limit: limitMock,
        lean: leanMock,
        exec: execMock,
      } as any);
      vi.spyOn(BlogPostModel, "countDocuments").mockReturnValue({
        exec: vi.fn().mockResolvedValue(0),
      } as any);

      await BlogRepository.findPosts({ status: "published" }, 1, 18);

      expect(selectMock).toHaveBeenCalledWith("-content");
      expect(leanMock).toHaveBeenCalled();
    });

    it("findRelatedPosts must exclude content field and only query published posts excluding currentSlug", async () => {
      const selectMock = vi.fn().mockReturnThis();
      const sortMock = vi.fn().mockReturnThis();
      const limitMock = vi.fn().mockReturnThis();
      const leanMock = vi.fn().mockReturnThis();
      const execMock = vi.fn().mockResolvedValue([]);

      const findSpy = vi.spyOn(BlogPostModel, "find").mockReturnValue({
        select: selectMock,
        sort: sortMock,
        limit: limitMock,
        lean: leanMock,
        exec: execMock,
      } as any);

      await BlogRepository.findRelatedPosts("Current-Post", "helmets", ["Safety"], 3);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: { $ne: "current-post" },
          status: "published",
        })
      );
      expect(selectMock).toHaveBeenCalledWith("-content");
    });

    it("findCategoryById handles slug strings safely without throwing Mongoose CastError", async () => {
      const findByIdSpy = vi.spyOn(BlogCategoryModel, "findById");
      const findOneSpy = vi.spyOn(BlogCategoryModel, "findOne").mockReturnValue({
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue({ _id: "cat-1", slug: "choosing-correct-riding-gear" }),
      } as any);

      const result = await BlogRepository.findCategoryById("Choosing-Correct-Riding-Gear");

      expect(findByIdSpy).not.toHaveBeenCalled();
      expect(findOneSpy).toHaveBeenCalledWith({ slug: "choosing-correct-riding-gear" });
      expect(result?.slug).toBe("choosing-correct-riding-gear");
    });

    it("findCategoryById queries findById when given a valid ObjectId", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const findByIdSpy = vi.spyOn(BlogCategoryModel, "findById").mockReturnValue({
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue({ _id: validId, slug: "helmets" }),
      } as any);

      const result = await BlogRepository.findCategoryById(validId);

      expect(findByIdSpy).toHaveBeenCalledWith(validId);
      expect(result?._id).toBe(validId);
    });

    it("updateCategoryArticleCount avoids querying _id with non-ObjectId slugs", async () => {
      const updateOneSpy = vi.spyOn(BlogCategoryModel, "updateOne").mockReturnValue({
        exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      } as any);

      await BlogRepository.updateCategoryArticleCount("Riding-Gear-Care", 6);

      expect(updateOneSpy).toHaveBeenCalledWith(
        { slug: "riding-gear-care" },
        { articleCount: 6 }
      );
    });

    it("updateCategoryArticleCount matches _id or slug when given a valid ObjectId", async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const updateOneSpy = vi.spyOn(BlogCategoryModel, "updateOne").mockReturnValue({
        exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      } as any);

      await BlogRepository.updateCategoryArticleCount(validId, 11);

      expect(updateOneSpy).toHaveBeenCalledWith(
        { $or: [{ _id: validId }, { slug: validId.toLowerCase() }] },
        { articleCount: 11 }
      );
    });
  });

  describe("BlogService CRUD & Category Count Integrity", () => {
    it("createPost preserves CloudFront featuredImage URL and updates category article count", async () => {
      const cfUrl = "https://d2zuvpvc0pfkya.cloudfront.net/uploads/1795620798564-Boots.webp";
      vi.spyOn(BlogRepository, "findPostBySlug").mockResolvedValue(null);
      vi.spyOn(BlogRepository, "findCategoryById").mockResolvedValue({
        _id: "cat-1",
        name: "Choosing correct Riding Gear",
        slug: "choosing-correct-riding-gear",
      } as any);
      vi.spyOn(BlogRepository, "createPost").mockImplementation(async (data) => ({
        _id: "new-post-id",
        ...data,
      } as any));
      vi.spyOn(BlogRepository, "countPostsByCategory").mockResolvedValue(12);
      const updateCountSpy = vi.spyOn(BlogRepository, "updateCategoryArticleCount").mockResolvedValue(undefined);

      const created = await BlogService.createPost({
        title: "New Boots Guide",
        content: "<p>Complete guide to motorcycle boots in India.</p>",
        featuredImage: cfUrl,
        categoryId: "cat-1",
        status: "published",
      });

      expect(created.featuredImage).toBe(cfUrl);
      expect(created.categorySlug).toBe("choosing-correct-riding-gear");
      expect(updateCountSpy).toHaveBeenCalledWith("choosing-correct-riding-gear", 12);
    });

    it("updatePost decrements old category articleCount when category is unassigned", async () => {
      vi.spyOn(BlogRepository, "findPostById").mockResolvedValue({
        _id: "post-1",
        title: "Old Post",
        slug: "old-post",
        content: "<p>Some content here</p>",
        status: "published",
        categoryId: "cat-1",
        categoryName: "Expert Tips",
        categorySlug: "expert-tips",
      } as any);
      vi.spyOn(BlogRepository, "updatePost").mockImplementation(async (id, data) => ({
        _id: id,
        ...data,
      } as any));
      const countSpy = vi.spyOn(BlogRepository, "countPostsByCategory").mockResolvedValue(1);
      const updateCountSpy = vi.spyOn(BlogRepository, "updateCategoryArticleCount").mockResolvedValue(undefined);

      await BlogService.updatePost("post-1", {
        categoryId: "",
        categoryName: "",
        categorySlug: "",
      });

      expect(countSpy).toHaveBeenCalledTimes(1);
      expect(countSpy).toHaveBeenCalledWith("expert-tips");
      expect(updateCountSpy).toHaveBeenCalledWith("expert-tips", 1);
    });
  });

  describe("BlogController Public Route Security", () => {
    it("getPublicPosts always enforces status: 'published' regardless of query param", async () => {
      const getPostsSpy = vi.spyOn(BlogService, "getPosts").mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const req = new NextRequest("http://localhost:4000/api/v1/blog/posts?status=draft&limit=20");
      await BlogController.getPublicPosts(req);

      expect(getPostsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "published",
          limit: 20,
        })
      );
    });
  });
});
