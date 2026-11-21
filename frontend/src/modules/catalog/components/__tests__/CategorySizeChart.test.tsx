import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloatingCatalogBar } from "../FloatingCatalogBar";
import { SidebarFilters } from "../SidebarFilters";
import { SizeChartModal } from "@/modules/product-detail/components/SizeChartModal";

const stableSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => stableSearchParams,
  usePathname: () => "/motorcycle-helmets",
  useParams: () => ({ categorySlug: ["motorcycle-helmets"] }),
}));

vi.mock("@/core/hooks/useProducts", () => ({
  useProductAggregations: () => ({
    data: {
      categories: [],
      brands: [{ name: "Axor", count: 5 }],
      sizes: [{ name: "M", count: 4 }, { name: "L", count: 2 }],
      colors: [],
    },
    isLoading: false,
  }),
}));

describe("Category Page Size Chart Test Suite", () => {
  const sampleImageUrl = "https://s3.ap-south-2.amazonaws.com/store4riders/helmets-chart.png";
  const sampleTableHtml = `
    <table class="size-table">
      <thead>
        <tr><th>Size</th><th>Circumference (cm)</th></tr>
      </thead>
      <tbody>
        <tr><td>M</td><td>57 - 58</td></tr>
        <tr><td>L</td><td>59 - 60</td></tr>
      </tbody>
    </table>
  `;

  describe("Desktop Sidebar (SidebarFilters)", () => {
    it("renders Size Guide button when category has sizeChart", () => {
      const handleOpen = vi.fn();
      render(
        <SidebarFilters
          sizeChart={sampleImageUrl}
          onOpenSizeChart={handleOpen}
        />
      );

      const buttons = screen.getAllByRole("button", { name: /size guide/i });
      expect(buttons.length).toBeGreaterThan(0);

      fireEvent.click(buttons[0]);
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it("does not render Size Guide button when category has no sizeChart", () => {
      render(
        <SidebarFilters
          sizeChart=""
        />
      );

      const button = screen.queryByRole("button", { name: /size guide/i });
      expect(button).toBeNull();
    });
  });

  describe("Mobile Drawer (FloatingCatalogBar)", () => {
    it("renders Size Guide callout button in mobile drawer when category has sizeChart", () => {
      const handleOpen = vi.fn();
      render(
        <FloatingCatalogBar
          totalCount={20}
          sizeChart={sampleImageUrl}
          onOpenSizeChart={handleOpen}
        />
      );

      // Open drawer
      const openDrawerBtn = screen.getByRole("button", { name: /filter & sort/i });
      fireEvent.click(openDrawerBtn);

      // Callout button inside drawer
      const sizeGuideBtns = screen.getAllByRole("button", { name: /size guide/i });
      expect(sizeGuideBtns.length).toBeGreaterThan(0);

      fireEvent.click(sizeGuideBtns[0]);
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it("does not render Size Guide callout in mobile drawer when category has no sizeChart", () => {
      render(
        <FloatingCatalogBar
          totalCount={20}
          sizeChart=""
        />
      );

      const openDrawerBtn = screen.getByRole("button", { name: /filter & sort/i });
      fireEvent.click(openDrawerBtn);

      const sizeGuideBtn = screen.queryByRole("button", { name: /size guide/i });
      expect(sizeGuideBtn).toBeNull();
    });
  });

  describe("SizeChartModal Integration", () => {
    it("renders modal with image size chart and handles close", () => {
      const handleClose = vi.fn();
      render(
        <SizeChartModal
          isOpen={true}
          onClose={handleClose}
          sizeChart={sampleImageUrl}
          productName="Full Face Helmets Size Guide"
        />
      );

      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Size Guide")).toBeDefined();
      expect(screen.getByText("Full Face Helmets Size Guide")).toBeDefined();

      const img = screen.getByAltText("Size Guide");
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe(sampleImageUrl);

      const closeBtn = screen.getByRole("button", { name: /close size guide/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("renders modal with HTML table size chart", () => {
      const handleClose = vi.fn();
      render(
        <SizeChartModal
          isOpen={true}
          onClose={handleClose}
          sizeChart={sampleTableHtml}
          productName="Riding Jackets Size Guide"
        />
      );

      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("Circumference (cm)")).toBeDefined();
      expect(screen.getByText("57 - 58")).toBeDefined();
      expect(screen.getByText("59 - 60")).toBeDefined();
    });

    it("returns null when modal is closed", () => {
      render(
        <SizeChartModal
          isOpen={false}
          onClose={vi.fn()}
          sizeChart={sampleImageUrl}
          productName="Helmets"
        />
      );

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
