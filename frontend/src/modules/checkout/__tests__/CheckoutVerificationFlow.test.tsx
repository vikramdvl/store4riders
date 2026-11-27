import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutPageModule } from "../components/CheckoutPageModule";
import { CheckoutCallbackModule } from "../components/CheckoutCallbackModule";
import * as checkoutHooks from "@/core/hooks/useCheckout";
import {
  savePendingPaymentOrder,
  loadPendingPaymentOrder,
  clearPendingPaymentOrder,
  PENDING_ORDER_STORAGE_KEY,
} from "@/core/utils/paymentSubmit";

const mockPush = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    preload: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }: any) => (
    <img {...props} alt={props.alt || ""} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/modules/homepage/components/TopBanner", () => ({
  default: () => <div data-testid="top-banner" />,
}));
vi.mock("@/modules/homepage/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));
vi.mock("@/modules/homepage/components/Footer", () => ({
  default: () => <footer data-testid="footer" />,
}));
vi.mock("@/components/ui/Breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

const mockClearCart = vi.fn();
let mockCartState: any = {
  items: [
    {
      productId: "prod-1",
      quantity: 1,
      price: 2500,
      product: { name: "Riding Gloves", weight: 0.5 },
    },
  ],
  clearCart: mockClearCart,
  isLoaded: true,
};

vi.mock("@/stores/useCartStore", () => ({
  useCartStore: () => mockCartState,
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: () => ({ user: null }),
}));

vi.mock("@/core/hooks/useCoupons", () => ({
  useValidateCoupon: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublicCoupons: () => ({ data: [] }),
}));

vi.mock("@/core/hooks/useAddresses", () => ({
  useUserAddresses: () => ({ data: [] }),
  useAddAddress: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAddress: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAddress: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/core/hooks/usePaymentSettings", () => ({
  usePublicSettings: () => ({
    data: {
      enabledGateways: ["payu", "ccavenue", "snapmint", "cod"],
      snapmintMinOrderValue: 0,
      shippingCost: 0,
      freeShippingThreshold: 0,
    },
    isLoading: false,
  }),
}));

vi.mock("@/core/hooks/usePincodeLookup", () => ({
  usePincodeLookup: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/core/hooks/useIndianStates", () => ({
  useIndianStates: () => ({ data: ["Karnataka", "Maharashtra", "Delhi"], isLoading: false }),
}));

vi.mock("@/core/hooks/useCheckout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/hooks/useCheckout")>();
  return {
    ...actual,
    syncOrderPaymentStatus: vi.fn(),
    useCheckout: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

describe("Checkout Auto-Verification & Callback Flow Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingPaymentOrder();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    currentSearchParams = new URLSearchParams();
    mockCartState = {
      items: [
        {
          productId: "prod-1",
          quantity: 1,
          price: 2500,
          product: { name: "Riding Gloves", weight: 0.5 },
        },
      ],
      clearCart: mockClearCart,
      isLoaded: true,
    };
    window.scrollTo = vi.fn() as any;
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearPendingPaymentOrder();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("shows gateway-agnostic verification view on ?verifying=true without redirecting empty cart, and confirms automatically on retry", async () => {
    mockCartState = {
      items: [],
      clearCart: mockClearCart,
      isLoaded: true,
    };
    currentSearchParams = new URLSearchParams("verifying=true&orderId=OD-S4R-9001");

    vi.mocked(checkoutHooks.syncOrderPaymentStatus)
      .mockResolvedValueOnce({
        status: "pending_payment",
        orderNumber: "OD-S4R-9001",
        paymentMethod: "ccavenue",
        isConfirmed: false,
        isPending: true,
        gatewayStatus: "pending",
        message: "Pending at bank",
      })
      .mockResolvedValueOnce({
        status: "confirmed",
        orderNumber: "OD-S4R-9001",
        paymentMethod: "ccavenue",
        isConfirmed: true,
        isPending: false,
        gatewayStatus: "confirmed",
        message: "Payment captured!",
      });

    render(<CheckoutPageModule />);

    expect(await screen.findByText(/CONFIRMING YOUR PAYMENT\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/CCAvenue & your bank/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith("/cart");

    // Trigger manual check button immediately to simulate user/timer resolution without real-timer wait
    const checkBtn = screen.getByRole("button", { name: /Check Status Now|Checking Bank Status/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
    });
    expect(mockClearCart).toHaveBeenCalledTimes(1);
  });

  it("transitions to failure banner with reason without losing cart or re-polling when verification returns declined", async () => {
    currentSearchParams = new URLSearchParams("verifying=true&orderId=OD-S4R-9002");

    vi.mocked(checkoutHooks.syncOrderPaymentStatus).mockResolvedValue({
      status: "failed",
      orderNumber: "OD-S4R-9002",
      paymentMethod: "snapmint",
      isConfirmed: false,
      isPending: false,
      gatewayStatus: "failed",
      failureReason: "Cardless EMI rejected",
      message: "Declined",
    });

    render(<CheckoutPageModule />);

    await waitFor(() => {
      expect(screen.getByText(/Payment Unsuccessful or Bank Declined/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Cardless EMI rejected/i)).toBeInTheDocument();
    expect(mockClearCart).not.toHaveBeenCalled();
    // Should only invoke syncOrderPaymentStatus once (no redundant re-poll from CheckoutPaymentStep)
    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it("re-checks bank status immediately on browser visibilitychange when returning from UPI/banking app", async () => {
    vi.useFakeTimers();
    currentSearchParams = new URLSearchParams("verifying=true&orderId=OD-S4R-9003");

    vi.mocked(checkoutHooks.syncOrderPaymentStatus)
      .mockResolvedValueOnce({
        status: "pending_payment",
        orderNumber: "OD-S4R-9003",
        paymentMethod: "payu",
        isConfirmed: false,
        isPending: true,
        gatewayStatus: "pending",
        message: "Awaiting UPI approval",
      })
      .mockResolvedValueOnce({
        status: "confirmed",
        orderNumber: "OD-S4R-9003",
        paymentMethod: "payu",
        isConfirmed: true,
        isPending: false,
        gatewayStatus: "confirmed",
        message: "Captured via UPI",
      });

    await act(async () => {
      render(<CheckoutPageModule />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(1);

    // Advance past 1200ms focus/visibility throttle (before scheduled 1500ms retry fires)
    await act(async () => {
      vi.advanceTimersByTime(1300);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
  });

  it("exhausts progressive backoff schedule across 7 checks (~29.5s) and shows pending timeout helper cleanly", async () => {
    vi.useFakeTimers();
    currentSearchParams = new URLSearchParams("verifying=true&orderId=OD-S4R-9004");

    vi.mocked(checkoutHooks.syncOrderPaymentStatus).mockResolvedValue({
      status: "pending_payment",
      orderNumber: "OD-S4R-9004",
      paymentMethod: "payu",
      isConfirmed: false,
      isPending: true,
      gatewayStatus: "pending",
      message: "Still processing",
    });

    await act(async () => {
      render(<CheckoutPageModule />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(1);

    // Advance through [1500, 2500, 3500, 5000, 7000, 10000] step by step
    for (const delay of [1500, 2500, 3500, 5000, 7000, 10000]) {
      await act(async () => {
        vi.advanceTimersByTime(delay);
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(7);
    expect(screen.getByText(/Bank Confirmation Still Processing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Re-check Payment Status with Bank/i })).toBeInTheDocument();
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it("CheckoutCallbackModule routes pending status straight to /checkout?verifying=true", () => {
    currentSearchParams = new URLSearchParams("status=pending&orderId=OD-CB-555");
    render(<CheckoutCallbackModule />);

    expect(screen.getByText(/Verifying Payment Status/i)).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith("/checkout?verifying=true&orderId=OD-CB-555");
  });

  it("keeps polling through transient sync network errors and confirms once bank recovers", async () => {
    vi.useFakeTimers();
    currentSearchParams = new URLSearchParams("verifying=true&orderId=OD-NET-1");

    vi.mocked(checkoutHooks.syncOrderPaymentStatus)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        status: "confirmed",
        orderNumber: "OD-NET-1",
        paymentMethod: "payu",
        isConfirmed: true,
        isPending: false,
        gatewayStatus: "confirmed",
        message: "Confirmed after retry!",
      });

    await act(async () => {
      render(<CheckoutPageModule />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/CONFIRMING YOUR PAYMENT\.\.\./i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
    expect(mockClearCart).toHaveBeenCalledTimes(1);
  });

  it("renders confirmation screen immediately on ?success=true and resolves actual gateway method non-blockingly", async () => {
    currentSearchParams = new URLSearchParams("success=true&orderId=OD-S4R-CC99");
    vi.mocked(checkoutHooks.syncOrderPaymentStatus).mockResolvedValue({
      status: "confirmed",
      orderNumber: "OD-S4R-CC99",
      paymentMethod: "ccavenue",
      isConfirmed: true,
      isPending: false,
      gatewayStatus: "confirmed",
      message: "Confirmed",
    });

    render(<CheckoutPageModule />);

    expect(await screen.findByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
    expect(screen.getByText(/#OD-S4R-CC99/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("CCAVENUE")).toBeInTheDocument();
    });
  });

  it("shows weak-network notice when offline/slow-internet fails check and auto-confirms when online event fires", async () => {
    vi.useFakeTimers();
    currentSearchParams = new URLSearchParams("verifying=true&orderId=OD-S4R-NETDROP");

    vi.mocked(checkoutHooks.syncOrderPaymentStatus)
      .mockRejectedValueOnce(new Error("timeout of 12000ms exceeded"))
      .mockResolvedValueOnce({
        status: "confirmed",
        orderNumber: "OD-S4R-NETDROP",
        paymentMethod: "payu",
        isConfirmed: true,
        isPending: false,
        gatewayStatus: "confirmed",
        message: "Confirmed after reconnect!",
      });

    await act(async () => {
      render(<CheckoutPageModule />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Weak or disconnected internet detected/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1300);
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
  });

  it("recovers and auto-confirms an in-flight payment after device switch-off / tab crash when reopening clean /checkout", async () => {
    savePendingPaymentOrder({
      orderNumber: "OD-CRASH-101",
      gatewayOrderId: "TXN-CRASH-101",
      paymentMethod: "payu",
    });
    // Simulate backend webhook already cleared DB cart while customer's phone was off
    mockCartState = {
      items: [],
      clearCart: mockClearCart,
      isLoaded: true,
    };
    currentSearchParams = new URLSearchParams();

    vi.mocked(checkoutHooks.syncOrderPaymentStatus).mockResolvedValueOnce({
      status: "confirmed",
      orderNumber: "OD-CRASH-101",
      paymentMethod: "payu",
      isConfirmed: true,
      isPending: false,
      gatewayStatus: "confirmed",
      message: "Captured via webhook while offline",
    });

    render(<CheckoutPageModule />);

    expect(await screen.findByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
    expect(screen.getByText(/#OD-CRASH-101/i)).toBeInTheDocument();
    expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledWith("OD-CRASH-101");
    expect(mockPush).not.toHaveBeenCalledWith("/cart");
    expect(mockClearCart).toHaveBeenCalled();
    expect(loadPendingPaymentOrder()).toBeNull();
  });

  it("resumes verification polling when reopening /checkout after browser kill while gateway settlement is still pending", async () => {
    savePendingPaymentOrder({
      orderNumber: "OD-CRASH-202",
      gatewayOrderId: "TXN-CRASH-202",
      paymentMethod: "ccavenue",
    });
    currentSearchParams = new URLSearchParams();

    vi.mocked(checkoutHooks.syncOrderPaymentStatus)
      .mockResolvedValueOnce({
        status: "pending_payment",
        orderNumber: "OD-CRASH-202",
        paymentMethod: "ccavenue",
        isConfirmed: false,
        isPending: true,
        gatewayStatus: "pending",
        message: "Still awaiting settlement",
      })
      .mockResolvedValueOnce({
        status: "pending_payment",
        orderNumber: "OD-CRASH-202",
        paymentMethod: "ccavenue",
        isConfirmed: false,
        isPending: true,
        gatewayStatus: "pending",
        message: "Still awaiting settlement",
      })
      .mockResolvedValueOnce({
        status: "confirmed",
        orderNumber: "OD-CRASH-202",
        paymentMethod: "ccavenue",
        isConfirmed: true,
        isPending: false,
        gatewayStatus: "confirmed",
        message: "Settled!",
      });

    render(<CheckoutPageModule />);

    expect(await screen.findByText(/CONFIRMING YOUR PAYMENT\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Order Ref: #OD-CRASH-202/i)).toBeInTheDocument();

    const checkBtn = await screen.findByRole("button", { name: /Check Status Now/i });
    fireEvent.click(checkBtn);

    expect(await screen.findByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
    expect(loadPendingPaymentOrder()).toBeNull();
  });

  it("holds crash recovery in verification mode when rebooted offline and auto-confirms once internet reconnects", async () => {
    vi.useFakeTimers();
    savePendingPaymentOrder({
      orderNumber: "OD-CRASH-OFFLINE",
      gatewayOrderId: "TXN-OFF-1",
      paymentMethod: "payu",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    currentSearchParams = new URLSearchParams();

    vi.mocked(checkoutHooks.syncOrderPaymentStatus)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        status: "confirmed",
        orderNumber: "OD-CRASH-OFFLINE",
        paymentMethod: "payu",
        isConfirmed: true,
        isPending: false,
        gatewayStatus: "confirmed",
        message: "Confirmed after reconnect",
      });

    await act(async () => {
      render(<CheckoutPageModule />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/CONFIRMING YOUR PAYMENT\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Weak or disconnected internet detected/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1300);
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/PAYMENT SUCCESS!/i)).toBeInTheDocument();
    expect(loadPendingPaymentOrder()).toBeNull();
  });

  it("ignores expired (>2h) persisted pending payment records without blocking normal checkout", () => {
    window.localStorage.setItem(
      PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderNumber: "OD-STALE-OLD",
        paymentMethod: "payu",
        createdAt: Date.now() - 3 * 60 * 60 * 1000,
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(loadPendingPaymentOrder()).toBeNull();
    render(
      <QueryClientProvider client={queryClient}>
        <CheckoutPageModule />
      </QueryClientProvider>
    );
    expect(checkoutHooks.syncOrderPaymentStatus).not.toHaveBeenCalled();
  });
});
