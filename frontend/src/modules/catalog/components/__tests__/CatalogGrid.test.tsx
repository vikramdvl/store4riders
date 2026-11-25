import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CatalogGrid } from "../CatalogGrid";
import { CatalogProduct } from "../../types/catalog.types";

const mockRouterPush = vi.fn();
const stableSearchParams = new URLSearchParams("category=helmets&page=1");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => stableSearchParams,
  usePathname: () => "/motorcycle-helmets",
}));

vi.mock("../CatalogProductCard", () => ({
  CatalogProductCard: ({ product }: { product: CatalogProduct }) => (
    <div data-testid="catalog-card">{product.name}</div>
  ),
}));

const sampleProducts: CatalogProduct[] = [
  {
    id: "p1",
    name: "Axor Apex Venomous",
    category: "Helmets",
    priceFormatted: "₹4,999",
    imageUrl: "/helmet.jpg",
    rating: 0,
    productUrl: "/axor-apex-venomous",
  },
];

describe("CatalogGrid Pagination Performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  it("updates URL via shallow history.pushState instead of router.push on page click", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    render(
      <CatalogGrid
        products={sampleProducts}
        totalCount={36}
        isLoading={false}
        isFetching={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/motorcycle-helmets?category=helmets&page=2");
    expect(mockRouterPush).not.toHaveBeenCalled();

    pushStateSpy.mockRestore();
  });

  it("prefetches target page on hover and next button hover", () => {
    const onPrefetchPage = vi.fn();

    render(
      <CatalogGrid
        products={sampleProducts}
        totalCount={36}
        isLoading={false}
        isFetching={false}
        onPrefetchPage={onPrefetchPage}
      />
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "3" }));
    expect(onPrefetchPage).toHaveBeenCalledWith(3);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Next page" }));
    expect(onPrefetchPage).toHaveBeenCalledWith(2);
  });
});
