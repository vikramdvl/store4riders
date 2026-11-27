import { describe, it, expect, vi, beforeEach } from "vitest";
import { CategoryRepository } from "../category.repository";
import { CategoryModel } from "../category.model";

describe("CategoryRepository — Exact Slug & Alias Safety Regression Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("matches exact slug without hijacking unrelated alias documents when updating by template slug", async () => {
    const findExactSpy = vi.spyOn(CategoryRepository, "findExactBySlug").mockResolvedValueOnce(null);
    const findByIdSpy = vi.spyOn(CategoryRepository, "findById");
    const saveSpy = vi.spyOn(CategoryModel.prototype, "save").mockImplementation(function (this: any) {
      return Promise.resolve({
        toObject: () => ({
          _id: "new_cleaners_tombstone",
          name: "Helmet Cleaners",
          slug: "helmet-cleaners",
          includeInMenu: false,
          isDeleted: true,
        }),
      });
    });

    const result = await CategoryRepository.update("helmet-cleaners", {
      name: "Helmet Cleaners",
      slug: "helmet-cleaners",
      includeInMenu: false,
      isDeleted: true,
    });

    expect(findExactSpy).toHaveBeenCalledWith("helmet-cleaners");
    // Crucial: must NOT fall back to alias lookup that could overwrite 'motorcycle-care'
    expect(findByIdSpy).not.toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(result?.slug).toBe("helmet-cleaners");
    expect((result as any)?.isDeleted).toBe(true);
  });
});
