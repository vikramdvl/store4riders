"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import {
  formatPrice,
  parseExchangeNote,
  findExchangeRequestNote,
  inferExchangeProgressFromNotes,
  getExchangeWindowStatus,
  getOrderExchangesList,
  findExchangeForOrderItem,
} from "@store4riders/shared-utils";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Package,
  Truck,
  Receipt,
  CreditCard,
  Clock,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Phone,
  FileText,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  Landmark,
  Zap,
  XCircle,
  Headphones,
  ChevronRight,
  Check,
  Home,
} from "lucide-react";
import { ExchangeOrderModal } from "./ExchangeOrderModal";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { usePayExchangeFee } from "@/core/hooks/useOrderActions";
import { DirectUpiModal } from "@/modules/checkout/components/DirectUpiModal";

function getOrderHeaderBadge(status: string = "") {
  switch (status.toLowerCase()) {
    case "pending_payment":
      return {
        label: "Awaiting Payment",
        classes: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case "processing":
    case "packed":
      return {
        label: "Processing",
        classes: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "shipped":
      return {
        label: "In Transit",
        classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "delivered":
      return {
        label: "Delivered",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "return_requested":
    case "return_approved":
    case "return_picked":
      return {
        label: "Exchange In Progress",
        classes: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case "returned":
      return {
        label: "Exchange Completed",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        classes: "bg-red-50 text-red-700 border-red-200",
      };
    case "failed":
      return {
        label: "Payment Failed",
        classes: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        label: status ? status.replace(/_/g, " ").toUpperCase() : "CONFIRMED",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
  }
}

export function OrderDetails({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const { data: publicSettings } = usePublicSettings();
  const payExchangeFeeMutation = usePayExchangeFee();

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${orderId}`);
      return res.data;
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      const ord = (query.state.data as any)?.data;
      const st = String(ord?.status || "").toLowerCase();
      const exStage = String(ord?.exchangeDetails?.stage || "").toLowerCase();
      const isActiveExchange =
        ["return_requested", "return_approved", "return_picked"].includes(st) ||
        (Boolean(exStage) && !["completed", "rejected", "qc_failed"].includes(exStage));
      return isActiveExchange ? 15000 : false;
    },
  });

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSyncingFeeStatus, setIsSyncingFeeStatus] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [preselectedExchangeItemId, setPreselectedExchangeItemId] = useState<string | null>(null);
  const [selectedFeeGateway, setSelectedFeeGateway] = useState<"payu" | "ccavenue" | "upi">("payu");
  const [upiFeeModalData, setUpiFeeModalData] = useState<{
    isOpen: boolean;
    orderNumber: string;
    amount: number;
    upiUri: string;
    payeeName?: string;
    payeeVpa?: string;
  }>({
    isOpen: false,
    orderNumber: "",
    amount: 0,
    upiUri: "",
  });

  // Handle gateway redirect callback toast (?exchangeFeePaid=true|false)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const feeParam = params.get("exchangeFeePaid");
    if (feeParam === "true") {
      toast.success("Exchange shipping fee paid successfully! Your replacement is queued for dispatch.");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      window.history.replaceState(null, "", window.location.pathname);
    } else if (feeParam === "false") {
      toast.error("Exchange shipping fee payment was cancelled or failed. Please try again.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [orderId, queryClient]);

  const availableFeeGateways = React.useMemo(() => {
    const enabled = Array.isArray(publicSettings?.enabledGateways) ? publicSettings.enabledGateways : [];
    const list: ("payu" | "ccavenue" | "upi")[] = [];
    if (enabled.length === 0 || enabled.includes("payu")) list.push("payu");
    if (enabled.includes("ccavenue")) list.push("ccavenue");
    if (publicSettings?.upiMerchantVpa) list.push("upi");
    if (list.length === 0) list.push("payu");
    return list;
  }, [publicSettings?.enabledGateways, publicSettings?.upiMerchantVpa]);

  useEffect(() => {
    if (!availableFeeGateways.includes(selectedFeeGateway)) {
      setSelectedFeeGateway(availableFeeGateways[0]);
    }
  }, [availableFeeGateways, selectedFeeGateway]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 w-full animate-pulse font-sans">
        <div className="h-24 bg-white border border-slate-200 rounded-xl" />
        <div className="h-28 bg-white border border-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-white border border-slate-200 rounded-xl" />
          <div className="h-64 bg-white border border-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="py-16 px-4 text-center bg-white border border-slate-200 rounded-xl shadow-2xs font-sans">
        <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Package className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Order Not Found</h2>
        <p className="text-xs sm:text-sm text-slate-500 mb-5">
          We couldn&apos;t find the details for this order reference.
        </p>
        <Link
          href="/account/orders"
          className="inline-flex items-center justify-center min-h-[44px] bg-brand hover:bg-brand-dark text-white font-bold px-6 py-2.5 text-xs tracking-wider uppercase transition-colors rounded-lg"
        >
          Back to All Orders
        </Link>
      </div>
    );
  }

  const order = data.data;
  const resolvedOrderId = order._id || order.id || orderId;
  const statusBadge = getOrderHeaderBadge(order.status);

  // Status Stepper Logic
  const getStatusStepIndex = (status?: string): number => {
    switch (status?.toLowerCase()) {
      case "pending_payment":
      case "confirmed":
        return 0;
      case "processing":
      case "packed":
        return 1;
      case "shipped":
        return 2;
      case "delivered":
      case "return_requested":
      case "return_approved":
      case "return_picked":
      case "returned":
        return 3;
      default:
        return 0;
    }
  };

  const currentStatusIndex = getStatusStepIndex(order.status);
  const isCancelled = order.status?.toLowerCase() === "cancelled";
  const isFailed = order.status?.toLowerCase() === "failed";
  const isPendingPayment = order.status?.toLowerCase() === "pending_payment";
  const isDelivered = order.status?.toLowerCase() === "delivered";
  const isExchangeRequested = order.status?.toLowerCase() === "return_requested";
  const isExchangeApproved = order.status?.toLowerCase() === "return_approved";
  const isExchangePicked = order.status?.toLowerCase() === "return_picked";
  const isExchangeCompleted = order.status?.toLowerCase() === "returned";
  const wasDelivered =
    isDelivered || isExchangeRequested || isExchangeApproved || isExchangePicked || isExchangeCompleted;
  const isTrackable = ["processing", "packed", "shipped", "delivered"].includes(
    String(order.status || "").toLowerCase()
  );

  const exchangesList = getOrderExchangesList(order);
  const exchangeDetails = exchangesList[exchangesList.length - 1] || order.exchangeDetails;
  const defaultConfiguredFee =
    typeof publicSettings?.exchangeShippingFee === "number" ? publicSettings.exchangeShippingFee : 299;
  const inferredExchange = inferExchangeProgressFromNotes(order.notes, order.status, defaultConfiguredFee);
  const exchangeStage = exchangeDetails?.stage || inferredExchange.stage;
  const isUnderExchange =
    isExchangeRequested ||
    isExchangeApproved ||
    isExchangePicked ||
    isExchangeCompleted ||
    exchangesList.length > 0;

  const hasExchangeableItems =
    Array.isArray(order.items) &&
    order.items.some((item: any) => {
      const matched = findExchangeForOrderItem(order, item);
      return !matched || ["rejected", "qc_failed"].includes(matched.stage);
    });

  const configuredExchangeDays =
    typeof publicSettings?.returnWindowDays === "number" ? publicSettings.returnWindowDays : undefined;
  const exchangeWindowStatus = getExchangeWindowStatus(
    order?.deliveredAt || order?.updatedAt,
    configuredExchangeDays
  );

  const exchangeNote = findExchangeRequestNote(order.notes);
  const parsedNote = parseExchangeNote(exchangeNote?.text);

  const whatsappDigits = (publicSettings?.whatsappNumber || "+91 7263007788").replace(/\D/g, "");
  const whatsappFormattedPhone = whatsappDigits.startsWith("91") ? whatsappDigits : `91${whatsappDigits}`;

  const handlePayExchangeFee = (exchangeId?: string) => {
    const idToPay = order._id || order.id || order.orderNumber;
    payExchangeFeeMutation.mutate(
      { orderId: idToPay, paymentMethod: selectedFeeGateway, exchangeId },
      {
        onSuccess: (res: any) => {
          if (res?.paymentMethod === "upi" && res?.gatewayResponse) {
            const gw = res.gatewayResponse;
            setUpiFeeModalData({
              isOpen: true,
              orderNumber: gw.orderNumber || res.gatewayOrderId || res.orderNumber,
              amount: Number(gw.amount || res.amount),
              upiUri: gw.upiUri,
              payeeName: gw.payeeName,
              payeeVpa: gw.payeeVpa,
            });
          }
        },
      }
    );
  };

  const handleSyncExchangeFeePayment = async (specificGatewayOrderId?: string) => {
    const gwOrderId = specificGatewayOrderId || order?.exchangeDetails?.shippingFeeGatewayOrderId;
    if (!gwOrderId) return;
    try {
      setIsSyncingFeeStatus(true);
      const res = await apiClient.post("/orders/sync-payment", { orderId: gwOrderId });
      const result = res.data?.data;
      if (result?.isConfirmed) {
        toast.success(
          result.message || "Exchange shipping fee verified! Your replacement is queued for dispatch."
        );
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      } else {
        toast.info(result?.message || "Payment is still pending confirmation at the gateway.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not verify exchange fee payment status.");
    } finally {
      setIsSyncingFeeStatus(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      setIsGeneratingInvoice(true);
      toast.loading("Generating tax invoice...", { id: "invoice" });
      const res = await apiClient.get(`/orders/${order._id || order.id}/invoice`);
      if (res.data?.data?.invoiceUrl) {
        window.open(res.data.data.invoiceUrl, "_blank");
        toast.success("Invoice opened in new tab!", { id: "invoice" });
      } else {
        toast.error("Failed to generate invoice", { id: "invoice" });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error generating invoice", { id: "invoice" });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleSyncPayment = async () => {
    try {
      setIsCheckingStatus(true);
      const res = await apiClient.post("/orders/sync-payment", {
        orderId: order.orderNumber || order._id || order.id,
      });
      const result = res.data?.data;
      if (result?.isConfirmed) {
        toast.success(result.message || "Payment verified with bank! Order confirmed.");
        window.location.reload();
      } else {
        setSyncMessage(result?.message || "Payment has not been captured yet by the gateway.");
        toast.info(result?.message || "Transaction not confirmed yet.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not check payment status.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const orderSteps = [
    { key: "confirmed", label: "Order Placed", shortLabel: "Placed", icon: Check },
    { key: "processing", label: "Processing", shortLabel: "Packed", icon: Package },
    { key: "shipped", label: "Shipped", shortLabel: "Shipped", icon: Truck },
    { key: "delivered", label: "Delivered", shortLabel: "Delivered", icon: Home },
  ];

  return (
    <div className="flex flex-col w-full font-sans gap-4 sm:gap-5 pb-10">
      {/* 1. Desktop Back Navigation (Mobile uses sticky bar in AccountLayoutModule) */}
      <Link
        href="/account/orders"
        className="hidden lg:inline-flex items-center gap-1.5 text-slate-500 hover:text-brand text-xs font-bold uppercase tracking-wider transition-colors w-fit py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Orders</span>
      </Link>

      {/* 2. Top Header Card: Order ID, Status, Date & Quick Actions */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-6 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono font-bold text-lg sm:text-2xl text-slate-900 tracking-tight">
                Order #{order.orderNumber || String(resolvedOrderId).slice(-8).toUpperCase()}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.classes}`}
              >
                {statusBadge.label}
              </span>
              {order.paymentMethod && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  {order.paymentMethod === "cod" ? "COD" : order.paymentMethod.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Placed on {formattedDate}</span>
            </p>
          </div>

          <div className="flex items-baseline sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Order Total
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-900">
              {formatPrice(order.pricing?.total || order.totalAmount || 0)}
            </span>
          </div>
        </div>

        {/* Primary Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-3 border-t border-slate-100 flex-wrap">
          {isTrackable && (
            <Link
              href={`/account/orders/${resolvedOrderId}/tracking`}
              className="w-full sm:w-auto min-h-[44px] bg-slate-900 hover:bg-black text-white text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-2 shadow-2xs"
            >
              <Truck className="w-4 h-4" />
              <span>Track Shipment</span>
            </Link>
          )}

          {!isCancelled && !isFailed && !isPendingPayment && (
            <button
              type="button"
              onClick={handleDownloadInvoice}
              disabled={isGeneratingInvoice}
              className="w-full sm:w-auto min-h-[44px] border border-slate-300 hover:border-slate-900 text-slate-800 bg-white hover:bg-slate-50 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-slate-600" />
              <span>{isGeneratingInvoice ? "Preparing PDF..." : "Download Tax Invoice"}</span>
            </button>
          )}

          {wasDelivered &&
            hasExchangeableItems &&
            (() => {
              if (!exchangeWindowStatus.allowed && exchangeWindowStatus.reason === "disabled") {
                return null;
              }
              if (!exchangeWindowStatus.allowed && exchangeWindowStatus.reason === "expired") {
                return (
                  <div className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Exchange Closed ({configuredExchangeDays}d)</span>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  onClick={() => {
                    setPreselectedExchangeItemId(null);
                    setIsExchangeModalOpen(true);
                  }}
                  className="w-full sm:w-auto min-h-[44px] bg-brand hover:bg-brand-dark text-white text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Request Exchange</span>
                </button>
              );
            })()}

          {isUnderExchange && (
            <span className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
              <span>Exchange Active</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Order Progress Stepper OR Payment Issue / Cancelled Alert */}
      {isFailed || isPendingPayment ? (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 sm:p-6 shadow-2xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="font-bold text-sm sm:text-base text-amber-950">
                  {isPendingPayment
                    ? "Payment Awaiting Bank Confirmation"
                    : "Payment Incomplete or Cancelled"}
                </h2>
                <p className="text-xs text-amber-900 font-medium mt-0.5 leading-relaxed">
                  {order.failureReason ||
                    (isPendingPayment
                      ? "We are waiting for your bank to confirm the transaction."
                      : "Transaction was declined or cancelled at the payment gateway.")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                type="button"
                onClick={handleSyncPayment}
                disabled={isCheckingStatus}
                className="flex-1 sm:flex-initial min-h-[44px] bg-white hover:bg-slate-50 text-slate-800 border border-amber-300 font-bold text-xs px-4 py-2.5 rounded-lg shadow-2xs transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? "animate-spin" : ""}`} />
                <span>{isCheckingStatus ? "Checking..." : "Refresh Status"}</span>
              </button>
              <a
                href={`https://wa.me/918789494263?text=${encodeURIComponent(
                  `Hi Store4Riders, my payment status is pending for Order #${order.orderNumber}. Can you please help?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Support</span>
              </a>
            </div>
          </div>

          {syncMessage && (
            <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 font-medium">
              {syncMessage}
            </div>
          )}

          {/* RBI Timelines Guidance */}
          <div className="bg-white/90 border border-amber-200/90 rounded-lg p-3.5 sm:p-4 text-xs text-slate-700 flex flex-col gap-2.5">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-amber-700 shrink-0" />
              <span>If money was deducted from your bank account:</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex flex-col">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600" /> UPI / GPay / PhonePe
                </span>
                <span className="text-slate-600 mt-0.5">
                  Auto-refund in <strong>24 to 48 Hours</strong>
                </span>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex flex-col">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" /> Debit / Credit Cards
                </span>
                <span className="text-slate-600 mt-0.5">
                  Auto-refund in <strong>3 to 5 Working Days</strong>
                </span>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex flex-col">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-amber-600" /> NetBanking
                </span>
                <span className="text-slate-600 mt-0.5">
                  Auto-refund in <strong>2 to 4 Working Days</strong>
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500">
              *As per RBI guidelines, banks automatically credit back unconfirmed transaction debits.
            </span>
          </div>
        </div>
      ) : isCancelled ? (
        <div className="bg-red-50 border border-red-200 text-red-900 p-4 sm:p-5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold">Order Cancelled</p>
            <p className="text-xs text-red-700 font-normal mt-0.5">
              This order was cancelled and will not be shipped.
            </p>
          </div>
        </div>
      ) : (
        /* Clean Flipkart-Style Order Progress Card */
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Order Progress
            </h2>
            {isTrackable && (
              <Link
                href={`/account/orders/${resolvedOrderId}/tracking`}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
              >
                <span>Live Courier Tracking</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="relative pt-1">
            <div className="absolute left-[12.5%] right-[12.5%] top-5 h-1 bg-slate-100 rounded-full z-0" />
            <div
              className="absolute left-[12.5%] top-5 h-1 bg-emerald-500 rounded-full z-0 transition-all duration-500"
              style={{ width: `${(Math.max(0, currentStatusIndex) / 3) * 75}%` }}
            />

            <div className="relative z-10 grid grid-cols-4 gap-1">
              {orderSteps.map((step, index) => {
                const isDone = currentStatusIndex >= index;
                const isCurrent = currentStatusIndex === index;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center text-center px-0.5">
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                        isDone
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-xs"
                          : "bg-white border-slate-300 text-slate-300"
                      } ${isCurrent ? "ring-4 ring-emerald-500/15" : ""}`}
                    >
                      <StepIcon className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                    <span
                      className={`text-[11px] font-semibold mt-2 leading-tight hidden sm:block ${
                        isDone ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    <span
                      className={`text-[10px] font-semibold mt-1.5 leading-tight sm:hidden ${
                        isDone ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {step.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3.1 Exchange Status Trackers */}
      {isUnderExchange &&
        (exchangesList.length > 0 ? exchangesList : [undefined]).map((exItem: any, exIdx: number) => {
          const activeEx = exItem;
          const exStageVal = activeEx?.stage || inferredExchange.stage;
          const isExReq = exStageVal === "requested";
          const isExApp = exStageVal === "approved";
          const isExPick = exStageVal === "picked_up";
          const isExComp = exStageVal === "completed";
          const feeAmount =
            typeof activeEx?.shippingFee === "number"
              ? activeEx.shippingFee
              : inferredExchange.shippingFee;
          const feeStatus = activeEx?.shippingFeeStatus || inferredExchange.shippingFeeStatus;
          const qcStatusVal = activeEx?.qcStatus || inferredExchange.qcStatus;
          const qcPassed = qcStatusVal === "passed" || isExComp;
          const qcFailed = exStageVal === "qc_failed" || qcStatusVal === "failed";
          const isRejected = exStageVal === "rejected";
          const isExRejOrFailed = isRejected || qcFailed;
          const effectiveReverseAwb =
            activeEx?.reverseAwb || (!activeEx ? inferredExchange.reverseAwb : undefined);
          const effectiveReplacementAwb =
            activeEx?.replacementAwb || (!activeEx ? inferredExchange.replacementAwb : undefined);
          const effectiveRejectionReason =
            activeEx?.rejectionReason || (!activeEx ? inferredExchange.rejectionReason : undefined);
          const effectiveQcNotes =
            activeEx?.qcNotes || (!activeEx ? inferredExchange.qcNotes : undefined);
          const feeSettled =
            feeAmount <= 0 ||
            ["paid_online", "paid_manual", "cod_on_replacement", "waived"].includes(feeStatus);
          const replacementDispatched =
            exStageVal === "replacement_dispatched" || exStageVal === "completed" || isExComp;
          const needsFeePayment = qcPassed && feeStatus === "pending" && feeAmount > 0;
          const exchangeItemsLabel =
            Array.isArray(activeEx?.items) && activeEx.items.length > 0
              ? activeEx.items
                  .map((i: any) => `${i.name}${i.variantId ? ` [${i.variantId}]` : ""} x${i.quantity || 1}`)
                  .join(", ")
              : activeEx?.requestedItemNames || parsedNote.itemsList;

          const stepStates = [
            { label: "Request Placed", active: true },
            {
              label: "Pickup Scheduled",
              active: isExApp || isExPick || qcPassed || replacementDispatched || isExComp,
            },
            {
              label: qcFailed ? "QC Failed" : "Warehouse QC",
              active: qcPassed || qcFailed || replacementDispatched || isExComp,
              failed: qcFailed,
            },
            {
              label:
                feeStatus === "cod_on_replacement"
                  ? `COD ₹${feeAmount}`
                  : feeSettled
                  ? "Fee Settled"
                  : `Fee ₹${feeAmount}`,
              active: feeSettled || replacementDispatched || isExComp,
            },
            {
              label: isExComp ? "Completed" : "Replacement Sent",
              active: replacementDispatched || isExComp,
            },
          ];

          const activeStepCount = stepStates.filter((s) => s.active).length;
          const progressPct = Math.min(100, Math.max(0, ((activeStepCount - 1) / 4) * 80));

          return (
            <div
              key={activeEx?.exchangeId || `ex_${exIdx}`}
              className="bg-white rounded-xl shadow-2xs border border-slate-200/90 overflow-hidden divide-y divide-slate-100"
            >
              {/* 1. Clean Exchange Header */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isExRejOrFailed
                        ? "bg-red-50 text-red-600"
                        : isExComp || replacementDispatched
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900">
                        {isRejected && "Exchange Request Not Approved"}
                        {qcFailed && "Warehouse Quality Check Failed"}
                        {!isExRejOrFailed && isExComp && "Exchange Completed — Replacement Delivered"}
                        {!isExRejOrFailed &&
                          !isExComp &&
                          replacementDispatched &&
                          "Replacement Product Dispatched!"}
                        {!isExRejOrFailed &&
                          !isExComp &&
                          !replacementDispatched &&
                          needsFeePayment &&
                          `QC Passed — Pay ₹${feeAmount} Shipping Fee`}
                        {!isExRejOrFailed &&
                          !isExComp &&
                          !replacementDispatched &&
                          !needsFeePayment &&
                          qcPassed &&
                          "QC Passed & Fee Settled — Packing Replacement"}
                        {!isExRejOrFailed &&
                          !qcPassed &&
                          isExPick &&
                          "Gear Picked Up — In Transit for Warehouse QC"}
                        {!isExRejOrFailed &&
                          !qcPassed &&
                          !isExPick &&
                          isExApp &&
                          "Exchange Approved — Doorstep Pickup Scheduled"}
                        {!isExRejOrFailed &&
                          !qcPassed &&
                          !isExPick &&
                          !isExApp &&
                          isExReq &&
                          "Exchange Request Submitted — Under Review"}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                          isExRejOrFailed
                            ? "bg-red-50 text-red-700 border-red-200"
                            : isExComp || replacementDispatched
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : qcPassed
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : isExPick
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : isExApp
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {isRejected
                          ? "Rejected"
                          : qcFailed
                          ? "QC Failed"
                          : isExComp
                          ? "Completed"
                          : replacementDispatched
                          ? "Dispatched"
                          : needsFeePayment
                          ? "Action Needed"
                          : qcPassed
                          ? "Ready to Dispatch"
                          : isExPick
                          ? "In Transit"
                          : isExApp
                          ? "Pickup Scheduled"
                          : "In Review"}
                      </span>
                    </div>

                    {exchangeItemsLabel && (
                      <p className="text-xs font-medium text-slate-700 mt-1">
                        {exchangeItemsLabel}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {isRejected &&
                        (effectiveRejectionReason || "Your exchange request was declined per store policy.")}
                      {qcFailed &&
                        (effectiveQcNotes ||
                          "Exchange gear did not meet unused/original-tag QC criteria. Our support team will contact you.")}
                      {!isExRejOrFailed &&
                        isExComp &&
                        "Your gear exchange has been successfully delivered. Ride safe with Store4Riders!"}
                      {!isExRejOrFailed &&
                        !isExComp &&
                        replacementDispatched &&
                        (feeStatus === "cod_on_replacement"
                          ? `Your replacement is on the way! Keep ₹${feeAmount} ready (Cash or UPI) to pay on delivery.`
                          : "Your replacement gear is on the way. Track it using the AWB below.")}
                      {!isExRejOrFailed &&
                        !isExComp &&
                        !replacementDispatched &&
                        needsFeePayment &&
                        `Quality check passed. Pay the ₹${feeAmount} 2-way pickup & replacement shipping fee to start dispatch.`}
                      {!isExRejOrFailed &&
                        !isExComp &&
                        !replacementDispatched &&
                        !needsFeePayment &&
                        qcPassed &&
                        "QC and courier fee settlement are complete. Our warehouse is packing your replacement item."}
                      {!isExRejOrFailed &&
                        !qcPassed &&
                        isExPick &&
                        "Courier has collected your parcel for warehouse quality inspection (24–48 hrs post arrival)."}
                      {!isExRejOrFailed &&
                        !qcPassed &&
                        !isExPick &&
                        isExApp &&
                        "Approved! Courier partner will pick up the gear within 2–3 business days. Keep tags & box intact."}
                      {!isExRejOrFailed &&
                        !qcPassed &&
                        !isExPick &&
                        !isExApp &&
                        isExReq &&
                        "Our team is reviewing your request and verifying replacement stock."}
                    </p>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${whatsappFormattedPhone}?text=${encodeURIComponent(
                    `Hi Store4Riders, I need assistance with my Exchange Request for Order #${order.orderNumber}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto min-h-[38px] bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Support</span>
                </a>
              </div>

              {/* 2. 5-Stage Exchange Stepper (With Connecting Track) */}
              {!isRejected && (
                <div className="px-4 sm:px-5 py-4 bg-slate-50/40">
                  {/* Mobile vertical timeline */}
                  <div className="flex flex-col gap-2.5 sm:hidden">
                    {stepStates.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            step.failed
                              ? "bg-red-600 text-white"
                              : step.active
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {step.active && !step.failed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            step.failed
                              ? "text-red-700"
                              : step.active
                              ? "text-slate-900"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Desktop 5-col stepper with connecting line */}
                  <div className="hidden sm:block relative pt-1">
                    <div className="absolute left-[10%] right-[10%] top-[17px] h-0.5 bg-slate-200 z-0" />
                    <div
                      className="absolute left-[10%] top-[17px] h-0.5 bg-emerald-500 z-0 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                    <div className="relative z-10 grid grid-cols-5 gap-2 text-center">
                      {stepStates.map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                              step.failed
                                ? "bg-red-600 border-red-600 text-white"
                                : step.active
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-white border-slate-300 text-slate-400"
                            }`}
                          >
                            {step.active && !step.failed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <span
                            className={`text-[11px] font-semibold leading-tight ${
                              step.failed
                                ? "text-red-700"
                                : step.active
                                ? "text-slate-900"
                                : "text-slate-400"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Fee Settlement Strip */}
              {needsFeePayment && (
                <div className="p-4 sm:p-5 bg-rose-50/35 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                        2-Way Exchange Shipping Fee
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select a payment gateway to dispatch your replacement
                      </p>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-slate-900">
                      {formatPrice(feeAmount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableFeeGateways.map((gw) => (
                      <button
                        key={gw}
                        type="button"
                        onClick={() => setSelectedFeeGateway(gw)}
                        className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
                          selectedFeeGateway === gw
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {gw === "payu"
                            ? "PayU"
                            : gw === "ccavenue"
                            ? "CCAvenue"
                            : "Direct UPI"}
                        </span>
                        <span
                          className={`text-[10px] hidden sm:inline ${
                            selectedFeeGateway === gw ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          {gw === "upi" ? "QR / GPay" : "UPI • Cards • NetBanking"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 flex-wrap">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={payExchangeFeeMutation.isPending}
                        onClick={() => handlePayExchangeFee(activeEx?.exchangeId)}
                        className="w-full sm:w-auto min-h-[44px] bg-brand hover:bg-brand-dark text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>
                          {payExchangeFeeMutation.isPending
                            ? "Initializing..."
                            : selectedFeeGateway === "payu"
                            ? `Pay ₹${feeAmount} via PayU`
                            : selectedFeeGateway === "ccavenue"
                            ? `Pay ₹${feeAmount} via CCAvenue`
                            : `Pay ₹${feeAmount} via UPI`}
                        </span>
                      </button>

                      {activeEx?.shippingFeeGatewayOrderId && (
                        <button
                          type="button"
                          disabled={isSyncingFeeStatus}
                          onClick={() =>
                            handleSyncExchangeFeePayment(activeEx.shippingFeeGatewayOrderId)
                          }
                          className="w-full sm:w-auto min-h-[44px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isSyncingFeeStatus ? "animate-spin" : ""}`}
                          />
                          <span>
                            {isSyncingFeeStatus ? "Checking..." : "Already Paid? Refresh"}
                          </span>
                        </button>
                      )}
                    </div>

                    <a
                      href={`https://wa.me/${whatsappFormattedPhone}?text=${encodeURIComponent(
                        `Hi Store4Riders, my exchange for Order #${order.orderNumber} passed QC. Please switch my replacement shipping fee (Rs. ${feeAmount}) to Cash on Delivery (COD).`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 text-center sm:text-right"
                    >
                      Prefer COD (₹{feeAmount})? Request on WhatsApp
                    </a>
                  </div>
                </div>
              )}

              {!isExRejOrFailed && qcPassed && feeStatus === "cod_on_replacement" && !isExComp && (
                <div className="px-4 sm:px-5 py-3.5 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-blue-950">
                      Pay ₹{feeAmount} COD When Replacement Arrives
                    </p>
                    <p className="text-xs text-blue-800 mt-0.5">
                      Pay ₹{feeAmount} (Cash or UPI) directly to the delivery partner upon arrival.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-900 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shrink-0 w-fit">
                    COD: ₹{feeAmount}
                  </span>
                </div>
              )}

              {!isExRejOrFailed &&
                qcPassed &&
                (feeStatus === "paid_online" || feeStatus === "paid_manual") &&
                !isExComp && (
                  <div className="px-4 sm:px-5 py-3.5 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Exchange Shipping Fee Paid ({formatPrice(feeAmount)})</span>
                      </span>
                      <span className="text-emerald-800 mt-0.5 block">
                        {activeEx?.shippingFeePaymentMethod
                          ? `Method: ${String(activeEx.shippingFeePaymentMethod).toUpperCase()}`
                          : "Verified"}
                        {activeEx?.shippingFeePaymentRef
                          ? ` • Ref: ${activeEx.shippingFeePaymentRef}`
                          : ""}
                      </span>
                    </div>
                    <span className="font-semibold text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-200 w-fit">
                      Cleared for Dispatch
                    </span>
                  </div>
                )}

              {/* 4. Clean 2-Column Metadata Footer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
                <div className="p-4 sm:px-5 space-y-2 min-w-0">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">
                    Exchange Summary
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-slate-600">
                      <span className="text-slate-400">Reason: </span>
                      <strong className="text-slate-900 font-semibold">
                        {activeEx?.reasonType || parsedNote.reasonType}
                      </strong>
                    </p>
                    {(activeEx?.desiredReplacement ||
                      (!activeEx ? parsedNote.replacementRequirement : "")) && (
                      <p className="text-slate-600">
                        <span className="text-slate-400">Requested: </span>
                        <strong className="text-slate-900 font-semibold">
                          {activeEx?.desiredReplacement || parsedNote.replacementRequirement}
                        </strong>
                      </p>
                    )}
                    {(activeEx?.customerNote || (!activeEx ? parsedNote.customerNote : "")) && (
                      <p className="text-slate-500 [overflow-wrap:anywhere]">
                        <span className="text-slate-400">Note: </span>
                        &ldquo;{activeEx?.customerNote || parsedNote.customerNote}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:px-5 space-y-2 min-w-0">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">
                    Courier &amp; Fee Tracker
                  </span>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Reverse Pickup AWB</span>
                    {effectiveReverseAwb ? (
                      <span className="font-mono font-semibold text-slate-900 inline-flex items-center gap-1">
                        {activeEx?.reverseCourier ? `${activeEx.reverseCourier}: ` : ""}
                        {effectiveReverseAwb}
                        {activeEx?.reverseTrackingUrl && (
                          <a
                            href={activeEx.reverseTrackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">Pending assignment</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">2-Way Shipping Fee</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                        feeStatus === "paid_online" || feeStatus === "paid_manual"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : feeStatus === "cod_on_replacement"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : feeStatus === "waived"
                          ? "bg-slate-100 text-slate-700 border border-slate-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {feeStatus === "paid_online" && `Paid Online (₹${feeAmount})`}
                      {feeStatus === "paid_manual" && `Paid via UPI/Bank (₹${feeAmount})`}
                      {feeStatus === "cod_on_replacement" && `COD on Delivery (₹${feeAmount})`}
                      {feeStatus === "waived" && "Waived (₹0)"}
                      {feeStatus === "pending" &&
                        (qcPassed ? `Due: ₹${feeAmount}` : `₹${feeAmount} (Post QC)`)}
                    </span>
                  </div>

                  {effectiveReplacementAwb && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                      <span className="text-emerald-700 font-semibold">Replacement AWB</span>
                      <span className="font-mono font-bold text-emerald-900 inline-flex items-center gap-1">
                        {activeEx?.replacementCourier ? `${activeEx.replacementCourier}: ` : ""}
                        {effectiveReplacementAwb}
                        {activeEx?.replacementTrackingUrl && (
                          <a
                            href={activeEx.replacementTrackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      {/* 3.2 Delivered Order Exchange CTA Card */}
      {wasDelivered && hasExchangeableItems && exchangeWindowStatus.allowed && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Need a Size Replacement or Gear Exchange?
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-xl">
                Wrong size? Exchange individual items below for unused gear with original manufacturer
                tags intact.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreselectedExchangeItemId(null);
              setIsExchangeModalOpen(true);
            }}
            className="w-full sm:w-auto min-h-[44px] bg-brand hover:bg-brand-dark text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-2xs shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Request Exchange</span>
          </button>
        </div>
      )}

      {/* 4. Two Column Layout: Items (Left) & Delivery/Payment (Right) */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-start">
        {/* Left Column: Items List */}
        <div className="w-full flex-1 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            <div className="border-b border-slate-100 px-4 py-3.5 bg-slate-50/70 flex items-center justify-between">
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-brand" />
                <span>Items in Order ({order.items?.length || 0})</span>
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {order.items?.map((item: any, idx: number) => {
                const itemKey = String(item._id || item.id || item.productId || idx);
                const itemImg =
                  item.image ||
                  item.product?.images?.[0]?.url ||
                  item.product?.image ||
                  "/no-image.svg";
                const itemSlug = item.slug || item.product?.slug || "";
                const itemName = item.name || item.product?.name || "Riding Gear";
                const unitPrice = item.price ?? item.unitPrice ?? 0;
                const lineTotal = unitPrice * (item.quantity || 1);
                const matchedItemExchange = findExchangeForOrderItem(order, item);
                const itemHasActiveExchange = Boolean(
                  matchedItemExchange &&
                    !["rejected", "qc_failed"].includes(matchedItemExchange.stage)
                );
                const canExchangeThisItem =
                  wasDelivered && exchangeWindowStatus.allowed && !itemHasActiveExchange;

                const imageNode = (
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 border border-slate-200/80 rounded-lg shrink-0 flex items-center justify-center p-1 overflow-hidden">
                    <Image
                      src={itemImg}
                      alt={itemName}
                      fill
                      className="object-contain p-1 mix-blend-multiply"
                      sizes="(max-width: 640px) 64px, 80px"
                    />
                  </div>
                );

                return (
                  <div
                    key={itemKey}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4"
                  >
                    <div className="flex gap-3 sm:gap-4 items-start sm:items-center min-w-0 flex-1">
                      {itemSlug ? <Link href={`/${itemSlug}`}>{imageNode}</Link> : imageNode}

                      <div className="flex flex-col flex-1 min-w-0">
                        {itemSlug ? (
                          <Link href={`/${itemSlug}`}>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug hover:text-brand transition-colors">
                              {itemName}
                            </p>
                          </Link>
                        ) : (
                          <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                            {itemName}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {item.variantId && (
                            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded">
                              {item.variantId}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-600 font-medium">
                            Qty: <strong className="text-slate-900">{item.quantity}</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            {formatPrice(unitPrice)} each
                          </span>
                        </div>

                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">
                            Item Total:
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {formatPrice(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Per-item Exchange Status or Action Button */}
                    {(matchedItemExchange || canExchangeThisItem) && (
                      <div className="flex items-center gap-2 shrink-0 sm:self-center">
                        {matchedItemExchange && (
                          <span
                            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                              matchedItemExchange.stage === "rejected" ||
                              matchedItemExchange.stage === "qc_failed"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : matchedItemExchange.stage === "completed" ||
                                  matchedItemExchange.stage === "replacement_dispatched"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            Exchange:{" "}
                            {String(matchedItemExchange.stage || "requested").replace(/_/g, " ")}
                          </span>
                        )}

                        {canExchangeThisItem && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreselectedExchangeItemId(itemKey);
                              setIsExchangeModalOpen(true);
                            }}
                            className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:border-slate-900 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Exchange Item</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Summaries (Payment + Shipping + Help) */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-4">
          {/* Order Financial Summary */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-3 pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Payment Breakdown</span>
            </h2>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatPrice(order.pricing?.subtotal || order.totalAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping / Delivery</span>
                <span className="font-semibold text-emerald-700">
                  {order.pricing?.shipping > 0 ? (
                    <span className="text-slate-900">{formatPrice(order.pricing.shipping)}</span>
                  ) : (
                    "FREE"
                  )}
                </span>
              </div>
              {order.paymentMethod === "cod" && (order.pricing?.codHandlingFee || 0) > 0 && (
                <div className="flex justify-between text-amber-800">
                  <span>COD Cash Handling Fee</span>
                  <span className="font-semibold text-amber-900">
                    +{formatPrice(order.pricing?.codHandlingFee || 0)}
                  </span>
                </div>
              )}
              {order.pricing?.tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    GST ({typeof order.pricing?.taxRate === "number" ? order.pricing.taxRate : 18}%)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatPrice(order.pricing?.tax)}
                  </span>
                </div>
              )}
              {((order.pricing?.couponDiscount || 0) > 0 || (order.pricing?.discount || 0) > 0) && (
                <div className="flex justify-between text-emerald-600">
                  <span>
                    Coupon Discount{" "}
                    {order.pricing?.couponCode ? `(${order.pricing.couponCode})` : ""}
                  </span>
                  <span className="font-bold">
                    -{formatPrice(order.pricing?.couponDiscount || order.pricing?.discount || 0)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 mt-1 border-t border-dashed border-slate-200">
                <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                  Grand Total
                </span>
                <span className="text-lg sm:text-xl font-black text-brand">
                  {formatPrice(order.pricing?.total || order.totalAmount || 0)}
                </span>
              </div>

              {/* COD Partial Advance Breakdown */}
              {order.paymentMethod === "cod" && (order.pricing?.codPartialPaymentAmount || 0) > 0 && (
                <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1">
                  <div className="flex justify-between text-amber-900 font-medium">
                    <span>Advance Paid Online:</span>
                    <span className="font-bold">
                      {formatPrice(order.pricing?.codPartialPaymentAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-red-700 font-bold border-t border-amber-200/60 pt-1">
                    <span>Due on Delivery:</span>
                    <span>
                      {formatPrice(
                        order.pricing?.codAmountToCollect ??
                          order.pricing?.total - (order.pricing?.codPartialPaymentAmount || 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address & Mode */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-3 pb-3 border-b border-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>Delivery Details</span>
            </h2>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <p className="font-bold text-slate-900 text-sm">{order.shippingAddress?.fullName}</p>
                <p className="text-slate-600 leading-relaxed text-xs mt-1">
                  {order.shippingAddress?.street || order.shippingAddress?.addressLine1}
                  {order.shippingAddress?.addressLine2
                    ? `, ${order.shippingAddress.addressLine2}`
                    : ""}
                  <br />
                  {order.shippingAddress?.city}, {order.shippingAddress?.state} –{" "}
                  <strong className="text-slate-900">{order.shippingAddress?.pincode}</strong>
                </p>
                {order.shippingAddress?.phone && (
                  <p className="text-slate-700 text-xs mt-2 flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{order.shippingAddress.phone}</span>
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Payment Method
                </span>
                <span className="font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md">
                  {order.paymentMethod === "cod"
                    ? "Cash on Delivery"
                    : order.paymentMethod?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Support & Store Routes Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col gap-2.5">
            <a
              href={`https://wa.me/${whatsappFormattedPhone}?text=${encodeURIComponent(
                `Hi Store4Riders, I have a query regarding my Order #${order.orderNumber}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-center"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Need help? Chat on WhatsApp</span>
            </a>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
              <Link
                href="/contact-store4riders"
                className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Headphones className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Rider Support</span>
              </Link>
              <Link
                href="/returns-replacements-store4riders"
                className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Exchange Policy</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Request Modal */}
      <ExchangeOrderModal
        order={order}
        isOpen={isExchangeModalOpen}
        preselectedItemId={preselectedExchangeItemId}
        onClose={() => {
          setIsExchangeModalOpen(false);
          setPreselectedExchangeItemId(null);
        }}
      />

      {/* Direct UPI Shipping Fee Payment Modal */}
      <DirectUpiModal
        isOpen={upiFeeModalData.isOpen}
        onClose={() => setUpiFeeModalData((prev) => ({ ...prev, isOpen: false }))}
        orderNumber={upiFeeModalData.orderNumber}
        amount={upiFeeModalData.amount}
        upiUri={upiFeeModalData.upiUri}
        payeeName={upiFeeModalData.payeeName}
        payeeVpa={upiFeeModalData.payeeVpa}
        skipCartClear={true}
        onSuccess={() => {
          setUpiFeeModalData((prev) => ({ ...prev, isOpen: false }));
          queryClient.invalidateQueries({ queryKey: ["order", orderId] });
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }}
      />
    </div>
  );
}
