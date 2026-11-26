import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminUrlRedirectsManager } from "../components/AdminUrlRedirectsManager";

const createMutateAsyncMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();
const refetchMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/core/hooks/useCategories", () => ({
  useCategoryTree: () => ({ data: [] }),
}));

vi.mock("@/core/hooks/useUrlRedirects", () => ({
  useUrlRedirects: () => ({
    data: {
      items: [
        {
          _id: "redir-1",
          fromPath: "/old-axor-helmet",
          toPath: "/axor-apex-helmet",
          statusCode: 301,
          source: "auto_product",
          isActive: true,
          hitCount: 14,
          note: "Product slug updated",
        },
      ],
      totalCount: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
    isLoading: false,
    refetch: refetchMock,
  }),
  useCreateUrlRedirect: () => ({
    mutateAsync: createMutateAsyncMock,
    isPending: false,
  }),
  useUpdateUrlRedirect: () => ({
    mutateAsync: updateMutateAsyncMock,
    isPending: false,
  }),
  useDeleteUrlRedirect: () => ({
    mutateAsync: deleteMutateAsyncMock,
    isPending: false,
  }),
}));

describe("AdminUrlRedirectsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutateAsyncMock.mockResolvedValue({ _id: "new-1" });
  });

  it("renders existing auto-301 and manual page redirects", () => {
    render(<AdminUrlRedirectsManager />);

    expect(screen.getByText("/old-axor-helmet")).toBeDefined();
    expect(screen.getByText("/axor-apex-helmet")).toBeDefined();
    expect(screen.getByText("301 Permanent")).toBeDefined();
    expect(screen.getByText("Auto: Product")).toBeDefined();
  });

  it("allows picking a destination from dropdown and saving a 301 redirect", async () => {
    render(<AdminUrlRedirectsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Add Page Redirect/i }));

    const sourceInput = screen.getByPlaceholderText("e.g. /old-helmet-page");
    fireEvent.change(sourceInput, { target: { value: "/legacy-about-page" } });

    const destSelect = screen.getByLabelText("Select destination page");
    fireEvent.change(destSelect, { target: { value: "/about-us-store4riders" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Redirect/i }));

    await waitFor(() => {
      expect(createMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fromPath: "/legacy-about-page",
          toPath: "/about-us-store4riders",
          statusCode: 301,
          isActive: true,
        })
      );
    });
  });
});
