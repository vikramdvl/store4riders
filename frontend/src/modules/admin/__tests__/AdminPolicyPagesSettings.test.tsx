import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminPolicyPagesSettings } from "../components/AdminPolicyPagesSettings";

let mockPageParam: string | null = null;

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "page" ? mockPageParam : null),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/core/utils/revalidateStorefront", () => ({
  revalidateStorefrontPaths: vi.fn(),
}));

const apiGetMock = vi.fn();
const apiPutMock = vi.fn();

vi.mock("@/core/api/client", () => ({
  apiClient: {
    get: (...args: any[]) => apiGetMock(...args),
    put: (...args: any[]) => apiPutMock(...args),
  },
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AdminPolicyPagesSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageParam = null;
    apiGetMock.mockResolvedValue({ data: { data: { policyPages: [] } } });
    apiPutMock.mockResolvedValue({ data: { data: {} } });
  });

  it("renders without crashing when no page query param is provided", async () => {
    renderWithQueryClient(<AdminPolicyPagesSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Policy & Page Content Editor/i)).toBeDefined();
    });

    expect(screen.getByText(/\/returns-replacements-store4riders/i, { selector: "code" })).toBeDefined();
  });

  it("resolves legacy alias ?page=about-us to about-us-store4riders", async () => {
    mockPageParam = "about-us";
    renderWithQueryClient(<AdminPolicyPagesSettings />);

    await waitFor(() => {
      expect(screen.getByText(/\/about-us-store4riders/i, { selector: "code" })).toBeDefined();
    });
  });

  it("resolves legacy alias ?page=contact-us to contact-store4riders", async () => {
    mockPageParam = "contact-us";
    renderWithQueryClient(<AdminPolicyPagesSettings />);

    await waitFor(() => {
      expect(screen.getByText(/\/contact-store4riders/i, { selector: "code" })).toBeDefined();
    });
  });

  it("falls back safely when ?page is an unknown slug", async () => {
    mockPageParam = "unknown-policy-slug";
    renderWithQueryClient(<AdminPolicyPagesSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Policy & Page Content Editor/i)).toBeDefined();
    });

    expect(screen.getByText(/\/returns-replacements-store4riders/i, { selector: "code" })).toBeDefined();
  });

  it("switches active page cleanly when clicking another page tab", async () => {
    renderWithQueryClient(<AdminPolicyPagesSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Policy & Page Content Editor/i)).toBeDefined();
    });

    const shippingTab = screen.getByRole("button", { name: /Shipping & Delivery/i });
    fireEvent.click(shippingTab);

    expect(screen.getByText(/\/shipping-policies-store4riders/i, { selector: "code" })).toBeDefined();

    const canonicalSlugInput = screen.getByLabelText("Canonical URL Path") as HTMLInputElement;
    expect(canonicalSlugInput.readOnly).toBe(true);
    expect(canonicalSlugInput.value).toBe("shipping-policies-store4riders");
  });
});
