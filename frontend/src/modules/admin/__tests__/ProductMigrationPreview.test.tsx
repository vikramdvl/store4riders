import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  CsvMigrationPreviewReport,
  CsvValidationPreviewModal,
} from "../components/CsvValidationPreviewModal";
import { ProductMigration } from "../components/ProductMigration";

const { mockApiPost, mockApiGet, mockAxiosPut } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockApiGet: vi.fn(),
  mockAxiosPut: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    put: mockAxiosPut,
  },
}));

vi.mock("@/core/api/client", () => ({
  apiClient: {
    post: mockApiPost,
    get: mockApiGet,
  },
}));

vi.mock("@/core/hooks/useBrands", () => ({
  useBrands: () => ({ data: [{ _id: "b1", name: "Axor", slug: "axor" }] }),
}));

vi.mock("@/core/utils/exportCsv", () => ({
  downloadBrandProductCsv: vi.fn(),
}));

vi.mock("@/core/utils/revalidateStorefront", () => ({
  revalidateStorefrontPaths: vi.fn(),
}));

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  }
});

const SAMPLE_REPORT: CsvMigrationPreviewReport = {
  totalRows: 5,
  headerAnalysis: {
    standardFields: ["sku", "old_sku", "name", "price", "qty", "weight", "length", "breadth", "height"],
    attributeColumns: ["certification"],
    ignoredColumns: ["codazon_custom_tab"],
  },
  summary: {
    createCount: 1,
    updateCount: 1,
    variantUpdateCount: 1,
    variantCreateCount: 0,
    noChangeCount: 1,
    skipCount: 1,
  },
  rows: [
    {
      rowNumber: 2,
      sku: "BAD-ZERO",
      name: "Broken Free Helmet",
      rowType: "simple",
      action: "skip",
      changes: [],
      reason: "New standalone product has zero/missing price",
    },
    {
      rowNumber: 3,
      sku: "AXOR-APEX",
      name: "Axor Apex Venomous",
      rowType: "configurable",
      action: "update",
      changes: ["qty: 4 → 12", "weight: 1.4 kg → 1.55 kg"],
    },
    {
      rowNumber: 4,
      sku: "NEW-GLOVE",
      name: "Rynox Storm Gloves",
      rowType: "simple",
      action: "create",
      changes: ["name: Rynox Storm Gloves", "price: ₹3499", "qty: 8"],
    },
    {
      rowNumber: 5,
      sku: "AXOR-BLK-M",
      name: "Axor Apex (AXOR-BLK-M)",
      rowType: "variant",
      action: "variant_update",
      changes: ["stock: 9", "length: 37"],
    },
    {
      rowNumber: 6,
      sku: "SAME-ITEM",
      name: "Same Item",
      rowType: "simple",
      action: "no_change",
      changes: ["Omitted/blank columns preserved — nothing new to overwrite"],
    },
  ],
  truncatedNormalRows: 0,
};

describe("CsvValidationPreviewModal & ProductMigration workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders summary counters, column mappings, filter tabs, and safe confirmation actions", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CsvValidationPreviewModal
        isOpen={true}
        fileName="catalog-patch.csv"
        report={SAMPLE_REPORT}
        isConfirming={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText(/Database Safe Patch Mode Active/i)).toBeDefined();
    expect(screen.getByText("codazon_custom_tab")).toBeDefined();
    expect(screen.getByText("certification")).toBeDefined();
    expect(screen.getByText(/3 change\(s\) ready to apply cleanly/i)).toBeDefined();

    // Filter down to Skipped rows only
    fireEvent.click(screen.getByRole("button", { name: /Skipped \(1\)/i }));
    expect(screen.getByText("BAD-ZERO")).toBeDefined();
    expect(screen.queryByText("NEW-GLOVE")).toBeNull();

    // Switch to Creates tab
    fireEvent.click(screen.getByRole("button", { name: /Creates \(1\)/i }));
    expect(screen.getByText("NEW-GLOVE")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Apply Changes/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm & Apply Changes when CSV has zero actionable updates or creations", () => {
    const emptyActionReport: CsvMigrationPreviewReport = {
      ...SAMPLE_REPORT,
      summary: {
        createCount: 0,
        updateCount: 0,
        variantUpdateCount: 0,
        variantCreateCount: 0,
        noChangeCount: 1,
        skipCount: 1,
      },
      rows: [SAMPLE_REPORT.rows[0], SAMPLE_REPORT.rows[4]],
    };

    render(
      <CsvValidationPreviewModal
        isOpen={true}
        fileName="noop.csv"
        report={emptyActionReport}
        isConfirming={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /Confirm & Apply Changes/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(screen.getByText(/No updates or creations detected in this CSV/i)).toBeDefined();
  });

  it("validates file extension, calls dry-run preview before queueing upload, and shows final completion counters", async () => {
    mockApiPost.mockImplementation(async (url: string) => {
      if (url === "/migration/preview") {
        return { data: { data: SAMPLE_REPORT } };
      }
      if (url === "/migration/presigned-url") {
        return { data: { data: { uploadUrl: "https://s3.example.com/presigned", s3Key: "migrations/1-patch.csv" } } };
      }
      if (url === "/migration/start") {
        return { data: { data: { jobId: "job-77" } } };
      }
      return { data: {} };
    });
    mockAxiosPut.mockResolvedValue({ status: 200 });
    mockApiGet.mockResolvedValue({
      data: {
        data: {
          jobId: "job-77",
          state: "completed",
          progress: 100,
          result: {
            successCount: 3,
            createdProductsCount: 1,
            updatedProductsCount: 1,
            updatedVariantsCount: 1,
            skippedGarbageCount: 1,
            failCount: 0,
            errors: [{ sku: "BAD-ZERO", error: "Skipped: Zero price" }],
          },
        },
      },
    });

    const { container } = renderWithClient(<ProductMigration />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // 1. Rejects non-CSV cleanly
    const badFile = new File(["invalid"], "catalog.xlsx", { type: "application/vnd.ms-excel" });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    fireEvent.click(screen.getByRole("button", { name: /Validate & Preview CSV/i }));
    expect(screen.getByText(/Only .csv files are allowed/i)).toBeDefined();
    expect(mockApiPost).not.toHaveBeenCalled();

    // 2. Valid CSV -> runs preview ONLY (does NOT start migration yet)
    const csvFile = new File(["sku,qty\nAXOR-APEX,12"], "patch.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });
    fireEvent.click(screen.getByRole("button", { name: /Validate & Preview CSV/i }));

    await waitFor(() => {
      expect(screen.getByText(/CSV Pre-Upload Validator & Dry-Run Preview/i)).toBeDefined();
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(
      "/migration/preview",
      expect.any(FormData),
      expect.any(Object)
    );
    expect(mockApiPost.mock.calls.some(([u]) => u === "/migration/start" || u === "/migration/upload")).toBe(false);

    // 3. Cancel does not upload anything
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockApiPost).toHaveBeenCalledTimes(1);

    // 4. Re-open preview & Confirm & Apply Changes -> completes polling and renders counters
    fireEvent.click(screen.getByRole("button", { name: /Validate & Preview CSV/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Confirm & Apply Changes/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Apply Changes/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/migration/start", {
        s3Key: "migrations/1-patch.csv",
        fileName: "patch.csv",
      });
    });

    await waitFor(
      () => {
        expect(screen.getByText(/Upload Complete! Successfully processed 3 record\(s\)/i)).toBeDefined();
        expect(screen.getByText("Created Products")).toBeDefined();
        expect(screen.getByText("Updated Products")).toBeDefined();
        expect(screen.getByText("Variants Updated")).toBeDefined();
        expect(screen.getByText("Skipped Rows")).toBeDefined();
      },
      { timeout: 3000 }
    );
  });
});
