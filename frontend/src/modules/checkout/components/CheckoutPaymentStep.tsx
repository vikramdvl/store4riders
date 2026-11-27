import React from "react";
import Image from "next/image";
import { PaymentMethodType } from "@store4riders/shared-types";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { syncOrderPaymentStatus } from "@/core/hooks/useCheckout";
import { toast } from "sonner";
import {
  getGatewayRedirectLabel,
  FAILED_SILENT_RETRY_DELAYS_MS,
} from "@/core/utils/paymentSubmit";

interface CheckoutPaymentStepProps {
  generatedOrderNumber: string;
  orderReference?: string;
  paymentOption: PaymentMethodType;
  setPaymentOption: (option: PaymentMethodType) => void;
  setCurrentStep: (step: 1 | 2) => void;
  handleAgreeToPay: () => void;
  onPreOrderCreate?: () => Promise<string | null>;
  onVerifiedSuccess?: (orderNumber: string, paymentMethod?: string) => void;
  isProcessing: boolean;
  isRedirecting?: boolean;
  shippingAddressSummary?: string;
  isFailedParam?: boolean;
  isCancelledParam?: boolean;
  isPendingParam?: boolean;
  skipAutoVerify?: boolean;
  failureReason?: string;
  isCodAvailable?: boolean;
  total?: number;
}

export const CheckoutPaymentStep = ({
  generatedOrderNumber,
  orderReference,
  paymentOption,
  setPaymentOption,
  setCurrentStep,
  handleAgreeToPay,
  onPreOrderCreate,
  onVerifiedSuccess,
  isProcessing,
  isRedirecting = false,
  shippingAddressSummary,
  isFailedParam,
  isCancelledParam,
  isPendingParam,
  skipAutoVerify = false,
  failureReason,
  isCodAvailable = true,
  total
}: CheckoutPaymentStepProps) => {
  const { data: settings, isLoading } = usePublicSettings({ staleTime: 30 * 1000 });
  const snapmintMin = settings?.snapmintMinOrderValue ?? 0;

  const baseGateways = settings?.enabledGateways && settings.enabledGateways.length > 0
    ? settings.enabledGateways
    : ["payu", "ccavenue", "snapmint", "cod"];
    
  // Filter available gateways and strictly ensure COD is always placed at the very bottom
  const filteredGateways = baseGateways.filter(g => (g !== "cod" || isCodAvailable) && g !== "upi" && g !== "gpay");
  const onlineGateways = filteredGateways.filter(g => g !== "cod");
  const availableGateways = filteredGateways.includes("cod") ? [...onlineGateways, "cod"] : onlineGateways;

  const isSnapmintIneligible = snapmintMin > 0 && total !== undefined && total < snapmintMin;

  // Ensure an available and eligible gateway is selected
  React.useEffect(() => {
    const eligibleGateways = availableGateways.filter(
      (g) => g !== "snapmint" || !isSnapmintIneligible
    );
    if (
      eligibleGateways.length > 0 &&
      (!eligibleGateways.includes(paymentOption) || (paymentOption === "snapmint" && isSnapmintIneligible))
    ) {
      setPaymentOption(eligibleGateways[0] as PaymentMethodType);
    }
  }, [availableGateways, paymentOption, setPaymentOption, isSnapmintIneligible]);

  const [isCheckingStatus, setIsCheckingStatus] = React.useState(false);
  const [isAutoVerifyingFailed, setIsAutoVerifyingFailed] = React.useState(
    Boolean(isFailedParam && orderReference && !skipAutoVerify)
  );
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = React.useState(false);

  const effectiveOrderRef = orderReference || generatedOrderNumber;

  const applyConfirmedRedirect = React.useCallback(
    (confirmedOrder: string, confirmedMethod?: string) => {
      setIsVerifiedSuccess(true);
      if (onVerifiedSuccess) {
        onVerifiedSuccess(confirmedOrder, confirmedMethod);
      } else {
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = `/checkout?success=true&orderId=${encodeURIComponent(confirmedOrder)}`;
          }
        }, 500);
      }
    },
    [onVerifiedSuccess]
  );

  // Silent progressive-backoff reconciliation on ?failed=true&orderId=... in case bank settled right after redirect
  React.useEffect(() => {
    if (!isFailedParam || !orderReference || isPendingParam || skipAutoVerify) {
      setIsAutoVerifyingFailed(false);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const maxSilentAttempts = FAILED_SILENT_RETRY_DELAYS_MS.length + 1;

    setIsAutoVerifyingFailed(true);

    const checkOnce = async (attempt: number) => {
      if (cancelled) return;
      try {
        const result = await syncOrderPaymentStatus(orderReference);
        if (cancelled) return;

        if (result?.isConfirmed) {
          toast.success(result.message || "Payment verified with bank! Your order is confirmed.");
          applyConfirmedRedirect(result.orderNumber || orderReference, result.paymentMethod);
          return;
        }

        if (result?.isPending && attempt < maxSilentAttempts) {
          const delayMs = FAILED_SILENT_RETRY_DELAYS_MS[attempt - 1] ?? 3000;
          retryTimer = setTimeout(() => {
            void checkOnce(attempt + 1);
          }, delayMs);
          return;
        }

        if (result?.message) {
          setStatusMessage(result.message);
        }
      } catch {
        // Silent fallback so user can manually re-check or retry
      }
      if (!cancelled) {
        setIsAutoVerifyingFailed(false);
      }
    };

    void checkOnce(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isFailedParam, orderReference, isPendingParam, skipAutoVerify, applyConfirmedRedirect]);

  // Automatically re-check once when internet reconnects or app returns to foreground while awaiting pending confirmation
  React.useEffect(() => {
    if (!isPendingParam || !orderReference) return;

    let lastReconnectSyncAt = 0;
    const handleReconnectSync = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (Date.now() - lastReconnectSyncAt < 3000) return;
      lastReconnectSyncAt = Date.now();
      try {
        const result = await syncOrderPaymentStatus(orderReference);
        if (result?.isConfirmed) {
          toast.success(result.message || "Payment verified with bank! Your order is confirmed.");
          applyConfirmedRedirect(result.orderNumber || orderReference, result.paymentMethod);
        }
      } catch {
        // Keep manual re-check button active without noisy errors
      }
    };

    window.addEventListener("online", handleReconnectSync);
    document.addEventListener("visibilitychange", handleReconnectSync);
    return () => {
      window.removeEventListener("online", handleReconnectSync);
      document.removeEventListener("visibilitychange", handleReconnectSync);
    };
  }, [isPendingParam, orderReference, applyConfirmedRedirect]);

  const handleCheckStatus = async () => {
    if (!effectiveOrderRef) {
      toast.error("No active order reference found to check status.");
      return;
    }
    try {
      setIsCheckingStatus(true);
      const result = await syncOrderPaymentStatus(effectiveOrderRef);
      if (result?.isConfirmed) {
        toast.success(result.message || "Payment verified with bank! Your order is confirmed.");
        applyConfirmedRedirect(result.orderNumber || effectiveOrderRef, result.paymentMethod);
      } else {
        setStatusMessage(
          result?.message ||
            "Bank has not confirmed any payment for this order yet. If debited, funds will auto-reverse within 24-48 hours."
        );
        toast.info(result?.message || "No captured payment received from bank yet.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not check payment status. Please try again.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const isCodWithAdvance = Boolean(settings?.codPartialPaymentEnabled) && (settings?.codPartialPaymentValue || 0) > 0;
  const isCodHandlingFeeEnabled = settings?.codHandlingFeeEnabled !== false;
  const codHandlingFee = isCodHandlingFeeEnabled
    ? ((total || 0) <= (settings?.codHandlingFeeThreshold ?? 5000)
        ? (settings?.codHandlingFeeTier1Amount ?? 100)
        : (settings?.codHandlingFeeTier2Amount ?? 200))
    : 0;

  const codAdvanceText = settings?.codPartialPaymentType === "fixed"
    ? `₹${Number(settings?.codPartialPaymentValue || 0).toLocaleString("en-IN")}`
    : `${settings?.codPartialPaymentValue ?? 10}%`;

  const advanceAmount = React.useMemo(() => {
    if (!isCodWithAdvance || total === undefined || total <= 0) return 0;
    if (settings?.codPartialPaymentType === "fixed") {
      return Math.min(Number(settings?.codPartialPaymentValue || 0), total);
    }
    const pct = Number(settings?.codPartialPaymentValue || 10);
    return Math.round((total * pct) / 100);
  }, [isCodWithAdvance, total, settings?.codPartialPaymentType, settings?.codPartialPaymentValue]);

  const balanceDue = React.useMemo(() => {
    if (total === undefined) return 0;
    return Math.max(0, total - advanceAmount);
  }, [total, advanceAmount]);

  const isBusy = isProcessing || isRedirecting;
  const busyButtonLabel = isRedirecting
    ? getGatewayRedirectLabel(paymentOption)
    : "PROCESSING ORDER...";

  const handleSelectGateway = (method: PaymentMethodType) => {
    if (isBusy) return;
    if (method === "snapmint" && isSnapmintIneligible) return;
    setPaymentOption(method);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-in fade-in duration-300">
      
      {/* Failure, Pending & Cancellation Diagnostic Banners */}
      {(isFailedParam || isCancelledParam || isPendingParam) && (
        <>
          {isCancelledParam && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed shadow-xs">
              <span className="font-bold">Payment was cancelled at the gateway.</span> No funds were captured. You can re-attempt payment with any preferred method below.
            </div>
          )}

          {isPendingParam && !isVerifiedSuccess && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-sm block text-amber-950">
                      Bank Confirmation Still Processing
                    </span>
                    {orderReference && (
                      <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                        Ref: #{orderReference}
                      </span>
                    )}
                  </div>
                  <p className="text-amber-900 leading-normal">
                    Your bank or UPI app has not sent final settlement confirmation yet. If money was debited from your account, do not pay again immediately — click below to re-check live status. Uncaptured debits auto-reverse per RBI TAT (typically within 1–5 business days).
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  {isCheckingStatus ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Checking with bank...</span>
                    </>
                  ) : (
                    <span>Re-check Payment Status with Bank</span>
                  )}
                </button>
              </div>

              {statusMessage && (
                <div className="p-2.5 bg-white border border-amber-200 rounded-lg text-[11px] text-neutral-800 font-mono">
                  {statusMessage}
                </div>
              )}
            </div>
          )}

          {isFailedParam && !isPendingParam && isAutoVerifyingFailed && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-center gap-3 shadow-xs">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold text-sm block">Verifying Payment Status with Bank...</span>
                <p className="text-blue-800 leading-normal">
                  Checking whether your transaction was settled by your payment gateway or bank. Please wait a moment.
                </p>
              </div>
            </div>
          )}

          {isFailedParam && !isPendingParam && !isAutoVerifyingFailed && !isVerifiedSuccess && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-sm block text-red-950">Payment Unsuccessful or Bank Declined</span>
                    {orderReference && (
                      <span className="text-[11px] font-mono font-bold bg-red-100 text-red-900 px-2 py-0.5 rounded border border-red-200">
                        Ref: #{orderReference}
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-700 leading-normal">
                    {failureReason
                      ? `${failureReason}. Your cart has been safely preserved. Please choose another payment method or re-try below.`
                      : "The bank did not authorize this transaction. Your cart has been safely preserved. Please choose another payment method or re-try below."}
                  </p>
                </div>
              </div>

              {/* Directly visible Bank Reconciliation Helper */}
              {orderReference && (
                <div className="pt-2.5 border-t border-red-200/80">
                  <div className="p-3 bg-white border border-red-200 rounded-xl space-y-2 text-neutral-800">
                    <p className="text-[11px] leading-relaxed">
                      <strong>Was money debited from your bank / UPI?</strong>{" "}
                      <span className="text-neutral-600">
                        UPI apps (GPay, PhonePe, Paytm) or banks sometimes take a few moments to settle. Click below to verify live status with your bank (uncaptured debits auto-reverse per RBI TAT within 1–5 business days).
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCheckStatus}
                        disabled={isCheckingStatus}
                        className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        {isCheckingStatus ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Checking with bank...</span>
                          </>
                        ) : (
                          <span>Re-check payment status with Bank</span>
                        )}
                      </button>
                    </div>

                    {statusMessage && (
                      <div className="mt-2 p-2 bg-neutral-50 border border-neutral-200 rounded text-[11px] text-neutral-800 font-mono">
                        {statusMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Main Payment Container */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 flex flex-col gap-4">
        
        {/* Heading */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-sans font-bold text-base sm:text-lg text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <span>PAYMENT OPTIONS</span>
            </h2>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              disabled={isBusy}
              className="lg:hidden text-[11px] font-bold text-slate-700 hover:text-slate-950 uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 hover:border-slate-400 transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            All online transactions are 100% secure and 256-bit encrypted.
          </p>
        </div>

        {/* Delivery Summary Strip */}
        {shippingAddressSummary && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-start gap-2 min-w-0">
              <svg className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deliver to</span>
                <span className="text-xs text-slate-800 font-semibold line-clamp-1">{shippingAddressSummary}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              disabled={isBusy}
              className="bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-900 text-slate-900 font-bold text-[11px] uppercase px-3 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Change
            </button>
          </div>
        )}

        {/* Unified Enterprise Payment Options List */}
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            <div className="p-4 h-20 animate-pulse bg-slate-50/70" />
            <div className="p-4 h-16 animate-pulse bg-slate-50/40" />
            <div className="p-4 h-16 animate-pulse bg-slate-50/70" />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
            {availableGateways.map((method) => {
              // 1. PayU
              if (method === "payu") {
                const isSelected = paymentOption === "payu";
                return (
                  <label
                    key="payu"
                    onClick={() => handleSelectGateway("payu")}
                    className={`relative block p-3.5 sm:p-4 transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-slate-50/90"
                        : "bg-white hover:bg-slate-50/50"
                    }`}
                  >
                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-slate-900" aria-hidden="true" />}
                    <div className="flex items-start gap-3">
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${isSelected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-sans font-bold text-[13.5px] sm:text-sm text-slate-900 leading-snug">
                            UPI, Cards, NetBanking &amp; EMI
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Image src="/icons/payment/payu.svg" alt="PayU" width={36} height={18} className="object-contain h-4 w-auto" priority loading="eager" unoptimized />
                            <Image src="/icons/payment/upi.svg" alt="UPI" width={28} height={14} className="object-contain h-3.5 w-auto" priority loading="eager" unoptimized />
                          </div>
                        </div>

                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                          GPay, PhonePe, Paytm, Credit/Debit Cards &amp; Bajaj EMI
                        </p>

                        {/* Accepted Payment Methods Strip (expanded cleanly on selection) */}
                        {isSelected && (
                          <div className="flex items-center gap-1.5 mt-3 flex-wrap animate-in fade-in duration-150">
                            {[
                              { src: "/icons/payment/gpay.svg", alt: "GPay" },
                              { src: "/icons/payment/phonepe.svg", alt: "PhonePe" },
                              { src: "/icons/payment/paytm.svg", alt: "Paytm" },
                              { src: "/icons/payment/visa.svg", alt: "VISA" },
                              { src: "/icons/payment/mastercard.svg", alt: "Mastercard" },
                              { src: "/icons/payment/rupay.svg", alt: "RuPay" },
                            ].map((icon) => (
                              <div
                                key={icon.alt}
                                className="bg-white border border-slate-200 rounded-md px-1.5 py-1 flex items-center justify-center h-6 w-10"
                              >
                                <Image
                                  src={icon.src}
                                  alt={icon.alt}
                                  width={32}
                                  height={18}
                                  className="object-contain w-full h-full"
                                  priority
                                  loading="eager"
                                  unoptimized
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                );
              }

              // 2. CCAvenue
              if (method === "ccavenue") {
                const isSelected = paymentOption === "ccavenue";
                return (
                  <label
                    key="ccavenue"
                    onClick={() => handleSelectGateway("ccavenue")}
                    className={`relative block p-3.5 sm:p-4 transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-slate-50/90"
                        : "bg-white hover:bg-slate-50/50"
                    }`}
                  >
                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-slate-900" aria-hidden="true" />}
                    <div className="flex items-start gap-3">
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${isSelected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-sans font-bold text-[13.5px] sm:text-sm text-slate-900">
                            CCAvenue
                          </span>
                          <div className="flex items-center bg-[#8f0d14] px-2.5 py-0.5 rounded-md h-5 shrink-0">
                            <span className="text-white font-black text-[10px] tracking-tight">CCAvenue</span>
                          </div>
                        </div>

                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                          50+ Banks • Credit/Debit Cards, NetBanking &amp; Wallets
                        </p>
                      </div>
                    </div>
                  </label>
                );
              }

              // 3. Snapmint
              if (method === "snapmint") {
                const isSelected = paymentOption === "snapmint";
                return (
                  <label
                    key="snapmint"
                    onClick={() => handleSelectGateway("snapmint")}
                    className={`relative block p-3.5 sm:p-4 transition-colors duration-150 ${
                      isSnapmintIneligible
                        ? "bg-slate-50/70 opacity-75 cursor-not-allowed"
                        : isSelected
                        ? "bg-slate-50/90 cursor-pointer"
                        : "bg-white hover:bg-slate-50/50 cursor-pointer"
                    }`}
                  >
                    {isSelected && !isSnapmintIneligible && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-slate-900" aria-hidden="true" />
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                        isSnapmintIneligible
                          ? "border-slate-300 bg-slate-200"
                          : isSelected
                          ? "border-slate-900 bg-slate-900"
                          : "border-slate-300 bg-white"
                      }`}>
                        {isSelected && !isSnapmintIneligible && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-sans font-bold text-[13.5px] sm:text-sm text-slate-900 leading-snug">
                            Snapmint Cardless EMI
                          </span>
                          <div className="flex items-center bg-[#004851] px-2 py-0.5 rounded-md h-5 shrink-0">
                            <span className="text-[#00e396] font-bold text-[10.5px] tracking-tight">snap</span>
                            <span className="text-white font-bold text-[10.5px] tracking-tight">mint</span>
                          </div>
                        </div>

                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                          <span className="text-emerald-700 font-semibold">0% Interest EMI</span> without Credit Card
                          {snapmintMin > 0 ? ` • Min. ₹${snapmintMin.toLocaleString("en-IN")}` : ""}
                        </p>

                        {/* Snapmint Ineligible notice */}
                        {isSnapmintIneligible && (
                          <div className="mt-2.5 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200/80 text-amber-900 rounded-lg text-[11px] leading-relaxed">
                            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>
                              Add <strong>₹{(snapmintMin - (total || 0)).toLocaleString("en-IN")}</strong> more (min. ₹{snapmintMin.toLocaleString("en-IN")}) to unlock 0% EMI.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                );
              }

              // 4. Cash on Delivery (COD)
              if (method === "cod") {
                const isSelected = paymentOption === "cod";
                return (
                  <label
                    key="cod"
                    onClick={() => handleSelectGateway("cod")}
                    className={`relative block p-3.5 sm:p-4 transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-slate-50/90"
                        : "bg-white hover:bg-slate-50/50"
                    }`}
                  >
                    {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-slate-900" aria-hidden="true" />}
                    <div className="flex items-start gap-3">
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${isSelected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-sans font-bold text-[13.5px] sm:text-sm text-slate-900">
                            Cash on Delivery
                          </span>
                          {isCodWithAdvance ? (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                              {codAdvanceText} Advance
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                              COD
                            </span>
                          )}
                        </div>

                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                          Pay cash or UPI on delivery
                          {isCodHandlingFeeEnabled && (
                            <span className="text-slate-700 font-medium"> • +₹{codHandlingFee} handling fee</span>
                          )}
                        </p>

                        {/* Compact hint when not selected, rich split breakdown when selected */}
                        {isCodWithAdvance && !isSelected && (
                          <p className="text-[11px] text-slate-600 font-medium mt-1">
                            Pay {codAdvanceText} advance via PayU now, balance on delivery
                          </p>
                        )}

                        {isCodWithAdvance && isSelected && (
                          <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg space-y-2.5 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between gap-2 text-[11.5px] text-slate-700">
                              <span>
                                Pay <strong className="font-bold text-slate-900">{codAdvanceText} advance</strong> via <strong>PayU</strong> to confirm COD
                              </span>
                              <Image src="/icons/payment/payu.svg" alt="PayU" width={30} height={14} className="object-contain h-3.5 w-auto shrink-0" priority loading="eager" unoptimized />
                            </div>

                            {total !== undefined && total > 0 && advanceAmount > 0 && (
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                <div className="bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Pay Now (PayU)</span>
                                  <strong className="text-slate-900 font-black text-sm">₹{advanceAmount.toLocaleString("en-IN")}</strong>
                                </div>
                                <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-lg px-2.5 py-1.5">
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Pay on Delivery</span>
                                  <strong className="text-emerald-700 font-black text-sm">₹{balanceDue.toLocaleString("en-IN")}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                );
              }

              return null;
            })}
          </div>
        )}

        {/* Desktop Navigation & Place Order */}
        <div className="hidden lg:flex items-center justify-between gap-4 pt-3 mt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            disabled={isBusy}
            className="border border-slate-300 hover:border-slate-900 bg-white text-slate-700 hover:text-slate-950 text-xs uppercase font-bold px-5 py-3 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back to Shipping Details
          </button>

          <button
            type="button"
            onClick={handleAgreeToPay}
            disabled={isBusy || !paymentOption}
            className="bg-banner hover:bg-[#e8451c] text-white font-bold tracking-wider text-xs uppercase py-3.5 px-8 rounded-lg transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isBusy ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{busyButtonLabel}</span>
              </>
            ) : (
              "PLACE ORDER"
            )}
          </button>
        </div>
      </div>

      {/* Mobile Fixed Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-slate-200 z-[60] flex flex-col gap-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:hidden">
        {isRedirecting && (
          <div className="w-full text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-center font-medium">
            Connecting securely to payment gateway. Please wait and do not press back...
          </div>
        )}
        {!isRedirecting && paymentOption === "cod" && isCodWithAdvance && advanceAmount > 0 && (
          <div className="w-full text-[11px] text-slate-700 bg-slate-100/90 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center justify-between gap-2">
            <span className="truncate">
              Pay <strong className="text-slate-900">₹{advanceAmount.toLocaleString("en-IN")}</strong> now via <strong>PayU</strong> • ₹{balanceDue.toLocaleString("en-IN")} on delivery
            </span>
            <Image src="/icons/payment/payu.svg" alt="PayU" width={26} height={12} className="object-contain h-3 w-auto shrink-0" priority loading="eager" unoptimized />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          {/* Mobile Total Display */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Payable</span>
            <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {total !== undefined ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(total) : "₹0.00"}
            </span>
          </div>

          {/* Continue Button on Mobile */}
          <button
            type="button"
            onClick={handleAgreeToPay}
            disabled={isBusy || !paymentOption}
            className="shrink-0 h-10 bg-banner hover:bg-[#e8451c] text-white font-bold tracking-wider text-[11px] sm:text-xs uppercase px-5 rounded-lg transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            {isBusy ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{busyButtonLabel}</span>
              </>
            ) : paymentOption === "cod" && isCodWithAdvance && advanceAmount > 0 ? (
              `PAY ₹${advanceAmount.toLocaleString("en-IN")} ADVANCE`
            ) : (
              "PLACE ORDER"
            )}
          </button>
        </div>
      </div>

    </div>
  );
};
