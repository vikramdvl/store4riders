import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CheckoutPaymentStep } from "../components/CheckoutPaymentStep";
import * as paymentSettingsHooks from "@/core/hooks/usePaymentSettings";
import * as checkoutHooks from "@/core/hooks/useCheckout";
import {
  getGatewayRedirectLabel,
  formatGatewayDisplayName,
  PAYMENT_VERIFY_RETRY_DELAYS_MS,
  FAILED_SILENT_RETRY_DELAYS_MS,
} from "@/core/utils/paymentSubmit";

vi.mock("@/core/hooks/usePaymentSettings", () => ({
  usePublicSettings: vi.fn(),
}));

vi.mock("@/core/hooks/useCheckout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/hooks/useCheckout")>();
  return {
    ...actual,
    syncOrderPaymentStatus: vi.fn(),
  };
});

describe("CheckoutPaymentStep & gateway redirect state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(paymentSettingsHooks.usePublicSettings).mockReturnValue({
      data: {
        enabledGateways: ["payu", "ccavenue", "snapmint", "cod"],
        snapmintMinOrderValue: 0,
        codPartialPaymentEnabled: true,
        codPartialPaymentType: "percentage",
        codPartialPaymentValue: 10,
      },
      isLoading: false,
    } as any);
  });

  it("maps gateway methods to user-friendly redirect labels", () => {
    expect(getGatewayRedirectLabel("payu")).toBe("REDIRECTING TO PAYU...");
    expect(getGatewayRedirectLabel("cod")).toBe("REDIRECTING TO PAYU...");
    expect(getGatewayRedirectLabel("ccavenue")).toBe("REDIRECTING TO CCAVENUE...");
    expect(getGatewayRedirectLabel("snapmint")).toBe("REDIRECTING TO SNAPMINT...");
    expect(getGatewayRedirectLabel("unknown")).toBe("REDIRECTING TO PAYMENT...");
  });

  it("keeps Place Order buttons disabled and shows gateway redirect message while redirecting", () => {
    render(
      <CheckoutPaymentStep
        generatedOrderNumber="ORD-123"
        paymentOption="payu"
        setPaymentOption={vi.fn()}
        setCurrentStep={vi.fn()}
        handleAgreeToPay={vi.fn()}
        isProcessing={false}
        isRedirecting={true}
        total={2500}
      />
    );

    const redirectingButtons = screen.getAllByRole("button", { name: /REDIRECTING TO PAYU\.\.\./i });
    expect(redirectingButtons.length).toBeGreaterThanOrEqual(2);
    redirectingButtons.forEach((btn) => expect(btn).toBeDisabled());
    expect(screen.getByText(/Connecting securely to payment gateway/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to Shipping Details/i })).toBeDisabled();
  });

  it("renders visible bank status recheck button when payment confirmation is pending", () => {
    render(
      <CheckoutPaymentStep
        generatedOrderNumber="OD-S4R-261199"
        orderReference="OD-S4R-261199"
        paymentOption="payu"
        setPaymentOption={vi.fn()}
        setCurrentStep={vi.fn()}
        handleAgreeToPay={vi.fn()}
        isProcessing={false}
        isPendingParam={true}
        total={2500}
      />
    );

    expect(screen.getByText(/Bank Confirmation Still Processing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Re-check Payment Status with Bank/i })).toBeInTheDocument();
  });

  it("automatically reconciles on failed redirect when orderReference is provided and confirms if captured", async () => {
    const onVerifiedSuccess = vi.fn();
    vi.mocked(checkoutHooks.syncOrderPaymentStatus).mockResolvedValue({
      status: "confirmed",
      orderNumber: "OD-S4R-261200",
      paymentMethod: "payu",
      isConfirmed: true,
      isPending: false,
      gatewayStatus: "confirmed",
      message: "Payment verified!",
    });

    render(
      <CheckoutPaymentStep
        generatedOrderNumber="OD-S4R-261200"
        orderReference="OD-S4R-261200"
        paymentOption="payu"
        setPaymentOption={vi.fn()}
        setCurrentStep={vi.fn()}
        handleAgreeToPay={vi.fn()}
        onVerifiedSuccess={onVerifiedSuccess}
        isProcessing={false}
        isFailedParam={true}
        total={2500}
      />
    );

    await waitFor(() => {
      expect(checkoutHooks.syncOrderPaymentStatus).toHaveBeenCalledWith("OD-S4R-261200");
      expect(onVerifiedSuccess).toHaveBeenCalledWith("OD-S4R-261200", "payu");
    });
  });

  it("shows directly visible recheck button without collapsed accordion if failed check stays unconfirmed", async () => {
    vi.mocked(checkoutHooks.syncOrderPaymentStatus).mockResolvedValue({
      status: "failed",
      orderNumber: "OD-S4R-261201",
      isConfirmed: false,
      isPending: false,
      gatewayStatus: "failed",
      message: "Payment has not been completed or was declined.",
    });

    render(
      <CheckoutPaymentStep
        generatedOrderNumber="OD-S4R-261201"
        orderReference="OD-S4R-261201"
        paymentOption="payu"
        setPaymentOption={vi.fn()}
        setCurrentStep={vi.fn()}
        handleAgreeToPay={vi.fn()}
        isProcessing={false}
        isFailedParam={true}
        total={2500}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Payment Unsuccessful or Bank Declined/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Re-check payment status with Bank/i })).toBeInTheDocument();
  });

  it("formats gateway display names cleanly and exposes progressive polling schedules", () => {
    expect(formatGatewayDisplayName("payu")).toBe("PayU");
    expect(formatGatewayDisplayName("ccavenue")).toBe("CCAvenue");
    expect(formatGatewayDisplayName("snapmint")).toBe("Snapmint");
    expect(formatGatewayDisplayName("upi")).toBe("UPI");
    expect(formatGatewayDisplayName(undefined)).toBe("the payment gateway");

    expect(PAYMENT_VERIFY_RETRY_DELAYS_MS).toEqual([1500, 2500, 3500, 5000, 7000, 10000]);
    expect(FAILED_SILENT_RETRY_DELAYS_MS).toEqual([1500, 3000]);
  });

  it("skips duplicate silent verification when skipAutoVerify is passed after polling failure", () => {
    render(
      <CheckoutPaymentStep
        generatedOrderNumber="OD-S4R-261202"
        orderReference="OD-S4R-261202"
        paymentOption="ccavenue"
        setPaymentOption={vi.fn()}
        setCurrentStep={vi.fn()}
        handleAgreeToPay={vi.fn()}
        isProcessing={false}
        isFailedParam={true}
        skipAutoVerify={true}
        failureReason="Insufficient funds"
        total={2500}
      />
    );

    expect(checkoutHooks.syncOrderPaymentStatus).not.toHaveBeenCalled();
    expect(screen.getByText(/Insufficient funds/i)).toBeInTheDocument();
  });
});
