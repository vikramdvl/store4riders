import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

let mockTreeData: any[] = [];
const createMutateMock = vi.fn();
const updateMutateMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const deleteMutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
    warning: vi.fn(),
  },
}));

vi.mock("@/components/ui/Modal", () => ({
  default: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/ui/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      aria-label="Category Description"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/SearchableSelect", () => ({
  SearchableSelect: ({ options, value, onChange, placeholder }: any) => (
    <select
      aria-label={placeholder || "Select"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("../components/SizeChartUploader", () => ({
  SizeChartUploader: () => <div data-testid="size-chart-uploader" />,
}));

vi.mock("@/core/utils/imageCompressor", () => ({
  compressImageToWebP: vi.fn(),
  uploadImageToS3: vi.fn(),
}));

vi.mock("@/core/hooks/useCategories", () => ({
  useCategoryTree: () => ({ data: mockTreeData, isLoading: false }),
  useCreateCategory: () => ({ mutate: createMutateMock, isPending: false }),
  useUpdateCategory: () => ({
    mutate: updateMutateMock,
    mutateAsync: updateMutateAsyncMock,
    isPending: false,
  }),
  useDeleteCategory: () => ({ mutate: deleteMutateMock, isPending: false }),
}));

import { AdminCategories } from "../components/AdminCategories";

describe("AdminCategories — CRUD, Mapping & Template Deletion Regression Suite", () => {
  const fullFaceId = "6ac9de6835b1b42fa90ac6d3";
  const cleanersId = "6ac9de6835b1b42fa90ac6d9";

  beforeEach(() => {
    vi.clearAllMocks();
    createMutateMock.mockImplementation((_data: any, opts?: any) => opts?.onSuccess?.());
    updateMutateMock.mockImplementation((_vars: any, opts?: any) => opts?.onSuccess?.());
    deleteMutateMock.mockImplementation((_vars: any, opts?: any) => opts?.onSuccess?.());
    mockTreeData = [
      {
        _id: fullFaceId,
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        includeInMenu: true,
        children: [],
      },
      {
        _id: cleanersId,
        name: "Helmet Cleaners",
        slug: "helmet-cleaners",
        includeInMenu: true,
        children: [],
      },
      {
        _id: "unmapped_under_5000",
        name: "Best helmets under Rs.5000",
        slug: "best-helmets-under-rs-5000",
        includeInMenu: false,
        children: [],
      },
      {
        _id: "unmapped_ls2_800",
        name: "LS2 FF800 Storm II Helmets (Touring Range)",
        slug: "ls2-ff800-storm-ii-helmets-touring-range",
        includeInMenu: false,
        children: [],
      },
    ];
  });

  it("maps an unmapped legacy category to a parent category and removes it from Unmapped tab", async () => {
    const { rerender } = render(<AdminCategories />);

    // Open Unmapped Legacy Categories tab
    const unmappedTab = screen.getByRole("button", { name: /Unmapped Legacy Categories \(2\)/i });
    fireEvent.click(unmappedTab);

    expect(screen.getByText("Best helmets under Rs.5000")).toBeDefined();
    expect(screen.getByText("LS2 FF800 Storm II Helmets (Touring Range)")).toBeDefined();

    // Edit "Best helmets under Rs.5000" and assign Parent = Full Face Helmets
    const editButtons = screen.getAllByTitle("Edit Category");
    fireEvent.click(editButtons[0]);

    const dialog = screen.getByRole("dialog", { name: /Edit Category: Best helmets under Rs.5000/i });
    const parentSelect = within(dialog).getByLabelText("None (Top Level Category)");
    fireEvent.change(parentSelect, { target: { value: fullFaceId } });

    fireEvent.click(within(dialog).getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "unmapped_under_5000",
          data: expect.objectContaining({
            parentId: fullFaceId,
          }),
        }),
        expect.any(Object)
      );
    });

    // Simulate refreshed categoryTree returned from backend after save
    mockTreeData = [
      {
        _id: fullFaceId,
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        includeInMenu: true,
        children: [
          {
            _id: "unmapped_under_5000",
            name: "Best helmets under Rs.5000",
            slug: "best-helmets-under-rs-5000",
            parentId: fullFaceId,
            includeInMenu: false,
            children: [],
          },
        ],
      },
      {
        _id: cleanersId,
        name: "Helmet Cleaners",
        slug: "helmet-cleaners",
        includeInMenu: true,
        children: [],
      },
      {
        _id: "unmapped_ls2_800",
        name: "LS2 FF800 Storm II Helmets (Touring Range)",
        slug: "ls2-ff800-storm-ii-helmets-touring-range",
        includeInMenu: false,
        children: [],
      },
    ];

    rerender(<AdminCategories />);

    expect(screen.getByRole("button", { name: /Unmapped Legacy Categories \(1\)/i })).toBeDefined();
    expect(screen.queryByText("Best helmets under Rs.5000")).toBeNull();
    // Switch back to Storefront Menu tab and verify it is nested there
    fireEvent.click(screen.getByRole("button", { name: /Storefront Menu/i }));
    expect(screen.getByText("Best helmets under Rs.5000")).toBeDefined();
  });

  it("normalizes slug-based parentId in the Edit modal so parent selection is preserved", () => {
    mockTreeData = [
      {
        _id: fullFaceId,
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        includeInMenu: true,
        children: [
          {
            _id: "mapped_smk",
            name: "SMK Gullwing helmets",
            slug: "smk-gullwing-helmets",
            parentId: "full-face-helmets",
            includeInMenu: false,
            children: [],
          },
        ],
      },
    ];

    render(<AdminCategories />);
    fireEvent.click(screen.getAllByTitle("Edit Category").find((_, idx) => idx > 0) || screen.getAllByTitle("Edit Category")[0]);

    // Find SMK row's Edit button specifically
    const smkSlugBtn = screen.getByText("/smk-gullwing-helmets");
    const row = smkSlugBtn.closest(".grid")!;
    fireEvent.click(within(row as HTMLElement).getByTitle("Edit Category"));

    const dialog = screen.getByRole("dialog", { name: /Edit Category: SMK Gullwing helmets/i });
    const parentSelect = within(dialog).getByLabelText("None (Top Level Category)") as HTMLSelectElement;
    expect(parentSelect.value).toBe(fullFaceId);
  });

  it("creates a new root category with menuGroup 'admin-custom' so it surfaces in Storefront Menu", async () => {
    const { rerender } = render(<AdminCategories />);

    fireEvent.click(screen.getByRole("button", { name: /Add Category/i }));
    const dialog = screen.getByRole("dialog", { name: /Add New Category/i });

    fireEvent.change(within(dialog).getByPlaceholderText("e.g., Full Face Helmet"), {
      target: { value: "Adventure Touring Gear" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: /Create Category/i }));

    await waitFor(() => {
      expect(createMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Adventure Touring Gear",
          slug: "adventure-touring-gear",
          menuGroup: "admin-custom",
        }),
        expect.any(Object)
      );
    });

    mockTreeData = [
      ...mockTreeData,
      {
        _id: "custom_adv_1",
        name: "Adventure Touring Gear",
        slug: "adventure-touring-gear",
        menuGroup: "admin-custom",
        includeInMenu: true,
        children: [],
      },
    ];

    rerender(<AdminCategories />);
    expect(screen.getByText("/adventure-touring-gear")).toBeDefined();
  });

  it("creates a new subcategory under a selected parent category", async () => {
    render(<AdminCategories />);

    fireEvent.click(screen.getByTitle('Add subcategory under "Full Face Helmets"'));
    const dialog = screen.getByRole("dialog", {
      name: /Add Subcategory \/ Submenu under "Full Face Helmets"/i,
    });

    fireEvent.change(within(dialog).getByPlaceholderText("e.g., Full Face Helmet"), {
      target: { value: "Dual Sport Helmets" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: /Create Category/i }));

    await waitFor(() => {
      expect(createMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dual Sport Helmets",
          slug: "dual-sport-helmets",
          parentId: fullFaceId,
        }),
        expect.any(Object)
      );
    });
  });

  it("deletes /helmet-cleaners via in-app modal with soft=true template flag and keeps it deleted after reload", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => true);
    const { rerender } = render(<AdminCategories />);

    const cleanersSlug = screen.getByText("/helmet-cleaners");
    const row = cleanersSlug.closest(".grid")!;
    fireEvent.click(within(row as HTMLElement).getByTitle("Delete Category"));

    // Must use in-app modal instead of native window.confirm (prevents focus-refresh logout race)
    expect(confirmSpy).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { name: /Confirm Category Deletion/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /Delete Category/i }));

    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledWith(
        {
          id: cleanersId,
          isTemplate: true,
          slug: "helmet-cleaners",
          name: "Helmet Cleaners",
        },
        expect.any(Object)
      );
    });

    // Simulate reload/re-login where backend returns tombstone record
    mockTreeData = [
      {
        _id: fullFaceId,
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        includeInMenu: true,
        children: [],
      },
      {
        _id: cleanersId,
        name: "Helmet Cleaners",
        slug: "helmet-cleaners",
        includeInMenu: false,
        isDeleted: true,
        children: [],
      },
      {
        _id: "unmapped_under_5000",
        name: "Best helmets under Rs.5000",
        slug: "best-helmets-under-rs-5000",
        includeInMenu: false,
        children: [],
      },
    ];

    rerender(<AdminCategories />);

    expect(screen.queryByRole("dialog", { name: /Confirm Category Deletion/i })).toBeNull();
    expect(screen.queryByText("/helmet-cleaners")).toBeNull();
    expect(screen.getByText("/motorcycle-helmets")).toBeDefined();
    expect(screen.getByText("/full-face-helmets")).toBeDefined();
    const unmappedTab = screen.getByRole("button", { name: /Unmapped Legacy Categories \(1\)/i });
    fireEvent.click(unmappedTab);
    expect(screen.queryByText("/helmet-cleaners")).toBeNull();

    confirmSpy.mockRestore();
  });

  it("clears single-match search filter after deleting a subcategory so the parent category stays visible", async () => {
    const { rerender } = render(<AdminCategories />);

    const searchInput = screen.getByPlaceholderText(
      /Search categories \(e\.g\. 'full face', 'gloves', 'axor'\)\.\.\./i
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "helmet cleaner" } });

    expect(screen.getByText("/motorcycle-helmets")).toBeDefined();
    expect(screen.getByText("/helmet-cleaners")).toBeDefined();
    expect(screen.queryByText("/full-face-helmets")).toBeNull();

    const row = screen.getByText("/helmet-cleaners").closest(".grid")!;
    fireEvent.click(within(row as HTMLElement).getByTitle("Delete Category"));

    const dialog = screen.getByRole("dialog", { name: /Confirm Category Deletion/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /Delete Category/i }));

    mockTreeData = [
      {
        _id: fullFaceId,
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        includeInMenu: true,
        children: [],
      },
      {
        _id: cleanersId,
        name: "Helmet Cleaners",
        slug: "helmet-cleaners",
        includeInMenu: false,
        isDeleted: true,
        children: [],
      },
    ];

    rerender(<AdminCategories />);

    await waitFor(() => {
      expect(searchInput.value).toBe("");
    });
    expect(screen.queryByText("/helmet-cleaners")).toBeNull();
    expect(screen.getByText("/motorcycle-helmets")).toBeDefined();
    expect(screen.getByText("/full-face-helmets")).toBeDefined();
  });

  it("hard-deletes a non-template unmapped legacy category by ID via the confirmation modal", async () => {
    render(<AdminCategories />);

    fireEvent.click(screen.getByRole("button", { name: /Unmapped Legacy Categories \(2\)/i }));
    const slugEl = screen.getByText("/best-helmets-under-rs-5000");
    const row = slugEl.closest(".grid")!;
    fireEvent.click(within(row as HTMLElement).getByTitle("Delete Category"));

    const dialog = screen.getByRole("dialog", { name: /Confirm Category Deletion/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /Delete Category/i }));

    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledWith("unmapped_under_5000", expect.any(Object));
    });
  });
});
