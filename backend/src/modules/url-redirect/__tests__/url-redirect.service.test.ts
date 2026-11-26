import { describe, it, expect, vi, beforeEach } from "vitest";
import { UrlRedirectService } from "../url-redirect.service";
import { UrlRedirectRepository } from "../url-redirect.repository";
import { ConflictError, ValidationError } from "../../../core/errors/AppError";
import { clearUrlRedirectCaches } from "../../../core/cache/redis";

describe("UrlRedirectService", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearUrlRedirectCaches();
  });

  it("normalizes paths and creates a 301 redirect rule", async () => {
    vi.spyOn(UrlRedirectRepository, "findByFromPath").mockResolvedValue(null);
    const createSpy = vi.spyOn(UrlRedirectRepository, "create").mockResolvedValue({
      _id: "r1",
      fromPath: "/old-helmet",
      toPath: "/new-helmet",
      statusCode: 301,
      source: "manual",
      isActive: true,
      hitCount: 0,
    });

    const created = await UrlRedirectService.create({
      fromPath: "Old-Helmet/",
      toPath: "new-helmet/",
      statusCode: 301,
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fromPath: "/old-helmet",
        toPath: "/new-helmet",
        statusCode: 301,
        source: "manual",
      })
    );
    expect(created.fromPath).toBe("/old-helmet");
  });

  it("throws ConflictError if source path already exists", async () => {
    vi.spyOn(UrlRedirectRepository, "findByFromPath").mockResolvedValue({
      _id: "existing",
      fromPath: "/old-helmet",
      toPath: "/new-helmet",
      statusCode: 301,
      source: "manual",
      isActive: true,
      hitCount: 0,
    });

    await expect(
      UrlRedirectService.create({
        fromPath: "/old-helmet",
        toPath: "/another-helmet",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("rejects circular redirect loops (A -> B when B -> A exists)", async () => {
    vi.spyOn(UrlRedirectRepository, "findByFromPath").mockImplementation(async (path: string) => {
      if (path === "/page-b") {
        return {
          _id: "r2",
          fromPath: "/page-b",
          toPath: "/page-a",
          statusCode: 301,
          source: "manual",
          isActive: true,
          hitCount: 0,
        };
      }
      return null;
    });

    await expect(
      UrlRedirectService.create({
        fromPath: "/page-a",
        toPath: "/page-b",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("auto-records slug change, prevents reverse loop, and flattens existing chains", async () => {
    const deleteSpy = vi.spyOn(UrlRedirectRepository, "deleteByFromPath").mockResolvedValue(undefined);
    const repointSpy = vi.spyOn(UrlRedirectRepository, "repointDestination").mockResolvedValue(undefined);
    const upsertSpy = vi.spyOn(UrlRedirectRepository, "upsertAutoRedirect").mockResolvedValue({
      _id: "r3",
      fromPath: "/helmet-v1",
      toPath: "/helmet-v2",
      statusCode: 301,
      source: "auto_product",
      isActive: true,
      hitCount: 0,
    });

    await UrlRedirectService.recordSlugChange("/helmet-v1", "/helmet-v2", "auto_product", "Slug updated");

    expect(deleteSpy).toHaveBeenCalledWith("/helmet-v2");
    expect(repointSpy).toHaveBeenCalledWith("/helmet-v1", "/helmet-v2");
    expect(upsertSpy).toHaveBeenCalledWith(
      "/helmet-v1",
      "/helmet-v2",
      "auto_product",
      "Slug updated"
    );
  });

  it("resolves active redirects and caches results", async () => {
    const findSpy = vi.spyOn(UrlRedirectRepository, "findActiveByFromPath").mockResolvedValue({
      _id: "r4",
      fromPath: "/legacy-page",
      toPath: "/new-page",
      statusCode: 302,
      source: "manual",
      isActive: true,
      hitCount: 3,
    });
    vi.spyOn(UrlRedirectRepository, "incrementHitCount").mockResolvedValue(undefined);

    const first = await UrlRedirectService.resolvePath("/legacy-page/");
    const second = await UrlRedirectService.resolvePath("/legacy-page");

    expect(first).toEqual({ matched: true, toPath: "/new-page", statusCode: 302 });
    expect(second).toEqual({ matched: true, toPath: "/new-page", statusCode: 302 });
    expect(findSpy).toHaveBeenCalledTimes(1);
  });
});
