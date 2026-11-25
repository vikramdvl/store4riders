"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatPrice, parseExchangeNote, findExchangeRequestNote, inferExchangeProgressFromNotes, getExchangeWindowStatus, getOrderExchangesList, findExchangeForOrderItem } from "@store4riders/shared-utils";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  Receipt, 
  CreditCard, 
  Clock, 
  CheckCircle,
  MapPin,
  RefreshCw,
  Phone,
  FileText,
  ShieldCheck,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { ExchangeOrderModal } from "./ExchangeOrderModal";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { usePayExchangeFee } from "@/core/hooks/useOrderActions";
import { DirectUpiModal } from "@/modules/checkout/components/DirectUpiModal";

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
        <div className="h-4 w-32 bg-neutral-200 rounded mb-2" />
        <div className="h-8 w-64 bg-neutral-200 rounded mb-4" />
        <div className="h-28 bg-white border border-neutral-200 rounded-xl mb-4" />
        <div className="h-64 bg-white border border-neutral-200 rounded-xl" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="py-16 text-center bg-white border border-neutral-200 rounded-2xl p-6 font-sans">
        <div className="w-14 h-14 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <Package className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Order Not Found</h2>
        <p className="text-xs text-neutral-500 mb-5">We couldn't find the details for this order reference.</p>
        <Link href="/account/orders">
          <button className="bg-brand text-white font-bold px-6 py-2.5 text-xs tracking-wider uppercase transition-colors rounded-lg">
            Back to Orders
          </button>
        </Link>
      </div>
    );
  }

  const order = data.data;

  // Status Stepper Logic
  const getStatusStepIndex = (status?: string): number => {
    switch (status?.toLowerCase()) {
      case "pending_payment":
        return 0;
      case "confirmed":
        return 0; // Placed & Confirmed -> Checkmark on Order Placed
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
  const exchangesList = getOrderExchangesList(order);
  const exchangeDetails = exchangesList[exchangesList.length - 1] || order.exchangeDetails;
  const defaultConfiguredFee =
    typeof publicSettings?.exchangeShippingFee === "number" ? publicSettings.exchangeShippingFee : 299;
  const inferredExchange = inferExchangeProgressFromNotes(order.notes, order.status, defaultConfiguredFee);
  const exchangeStage = exchangeDetails?.stage || inferredExchange.stage;
  const isExchangeRejectedOrFailed = exchangeStage === "rejected" || exchangeStage === "qc_failed";
  const isUnderExchange =
    isExchangeRequested ||
    isExchangeApproved ||
    isExchangePicked ||
    isExchangeCompleted ||
    exchangesList.length > 0;

  const hasExchangeableItems = Array.isArray(order.items) && order.items.some((item: any) => {
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
        toast.success(result.message || "Exchange shipping fee verified! Your replacement is queued for dispatch.");
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
      const res = await apiClient.post("/orders/sync-payment", { orderId: order.orderNumber || order._id || order.id });
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

  return (
    <div className="flex flex-col w-full font-sans pb-12">
      
      {/* 1. Back Navigation */}
      <Link 
        href="/account/orders" 
        className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-brand text-xs font-bold uppercase tracking-wider mb-4 transition-colors w-fit py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Orders</span>
      </Link>

      {/* 2. Top Header Card: Order ID, Date & Invoice */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono font-black text-lg sm:text-2xl text-neutral-900 tracking-tight">
              Order #{order.orderNumber || (order._id || order.id).slice(-8).toUpperCase()}
            </h1>
            {order.paymentMethod && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded">
                {order.paymentMethod === "cod" ? "COD" : order.paymentMethod.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 font-medium mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>Placed on {formattedDate}</span>
          </p>
        </div>

        {/* Action Buttons Group (Invoice + Exchange) */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {/* Request Exchange Button (Strictly governed by Admin-configured returnWindowDays & remaining items) */}
          {wasDelivered && hasExchangeableItems && (() => {
            if (!exchangeWindowStatus.allowed && exchangeWindowStatus.reason === "disabled") return null;

            if (!exchangeWindowStatus.allowed && exchangeWindowStatus.reason === "expired") {
              return (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-500 text-xs font-bold uppercase tracking-wider shrink-0">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Exchange Window Closed ({configuredExchangeDays} Days)</span>
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
                className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-2xs shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Request Exchange</span>
              </button>
            );
          })()}

          {/* Active Exchange Badge */}
          {isUnderExchange && (
            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold uppercase tracking-wider shadow-2xs shrink-0">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Exchange In Progress</span>
            </div>
          )}

          {/* Invoice Button (Only if confirmed/delivered) */}
          {!isCancelled && !isFailed && !isPendingPayment && (
            <button 
              type="button"
              onClick={handleDownloadInvoice}
              disabled={isGeneratingInvoice}
              className="w-full sm:w-auto border border-neutral-300 hover:border-neutral-900 text-neutral-800 bg-white hover:bg-neutral-50 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-neutral-600" />
              <span>{isGeneratingInvoice ? "Preparing PDF..." : "Download Tax Invoice"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Status Stepper OR Payment Issue Alert */}
      {isFailed || isPendingPayment ? (
        /* Failed / Awaiting Payment Alert Box */
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 sm:p-6 mb-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 font-bold shrink-0 text-base sm:text-lg">
                ⚠️
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-sm sm:text-base text-amber-950 uppercase tracking-tight">
                  {isPendingPayment ? "Payment Awaiting Bank Confirmation" : "Payment Incomplete or Cancelled"}
                </h3>
                <p className="text-xs text-amber-900 font-medium mt-0.5 leading-relaxed">
                  {order.failureReason || (isPendingPayment ? "We are waiting for your bank to confirm the transaction." : "Transaction was declined or cancelled at the payment gateway.")}
                </p>
              </div>
            </div>

            {/* Actions: Refresh & WhatsApp */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                type="button"
                onClick={handleSyncPayment}
                disabled={isCheckingStatus}
                className="flex-1 sm:flex-initial bg-white hover:bg-neutral-50 text-neutral-800 border border-amber-300 font-bold text-xs px-3.5 py-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <span className={isCheckingStatus ? "animate-spin inline-block" : ""}>🔄</span>
                <span>{isCheckingStatus ? "Checking with Bank..." : "Refresh Status"}</span>
              </button>
              <a
                href={`https://wa.me/918789494263?text=${encodeURIComponent(`Hi Store4Riders, my payment status is pending for Order #${order.orderNumber}. Can you please help?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
              >
                <span>💬 WhatsApp</span>
              </a>
            </div>
          </div>

          {syncMessage && (
            <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs text-neutral-800 font-medium">
              {syncMessage}
            </div>
          )}

          {/* RBI Timelines Guidance */}
          <div className="bg-white/85 border border-amber-200/90 rounded-lg p-3 sm:p-4 text-xs text-neutral-700 flex flex-col gap-2">
            <span className="font-bold text-neutral-900 flex items-center gap-1.5">
              <span>🏛️</span> If money was deducted from your bank account:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex flex-col">
                <span className="font-bold text-neutral-900">⚡ UPI / GPay / PhonePe</span>
                <span className="text-neutral-600 mt-0.5">Auto-refund in <strong>24 to 48 Hours</strong></span>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex flex-col">
                <span className="font-bold text-neutral-900">💳 Debit / Credit Cards</span>
                <span className="text-neutral-600 mt-0.5">Auto-refund in <strong>3 to 5 Working Days</strong></span>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex flex-col">
                <span className="font-bold text-neutral-900">🏦 NetBanking</span>
                <span className="text-neutral-600 mt-0.5">Auto-refund in <strong>2 to 4 Working Days</strong></span>
              </div>
            </div>
            <span className="text-[10px] text-neutral-500 italic">
              *As per RBI Circular DPSS.CO.PD No.629/02.01.014/2019-20, banks automatically credit back unconfirmed transaction debits without manual forms.
            </span>
          </div>
        </div>
      ) : isCancelled ? (
        /* Cancelled State */
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 sm:p-5 rounded-xl mb-6 text-xs sm:text-sm font-bold flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
            ✕
          </div>
          <span>This order has been cancelled.</span>
        </div>
      ) : (
        /* Responsive Mobile + Desktop Stepper */
        <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 mb-6 shadow-2xs">
          <div className="relative pb-2">
            
            {/* Background Track Line */}
            <div className="absolute left-[12%] right-[12%] top-3.5 sm:top-4 h-1 bg-neutral-100 rounded-full z-0" />
            
            {/* Active Progress Fill */}
            <div 
              className="absolute left-[12%] top-3.5 sm:top-4 h-1 bg-emerald-500 rounded-full z-0 transition-all duration-500"
              style={{ width: `${(Math.max(0, currentStatusIndex) / 3) * 76}%` }}
            />

            {/* Steps Row */}
            <div className="relative z-10 flex justify-between w-full">
              {[
                { key: "confirmed", label: "Confirmed" },
                { key: "processing", label: "Processing" },
                { key: "shipped", label: "Shipped" },
                { key: "delivered", label: "Delivered" },
              ].map((step, index) => {
                const isActive = currentStatusIndex >= index;
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 text-center px-0.5">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isActive 
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-xs" 
                        : "bg-white border-neutral-300 text-neutral-300"
                    }`}>
                      {isActive ? (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-neutral-300" />
                      )}
                    </div>
                    {/* Clear label on ALL screen sizes */}
                    <span className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-tight mt-1.5 leading-tight ${
                      isActive ? "text-neutral-900" : "text-neutral-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* 3.1 Exchange Status Banners & 5-Stage Lifecycle Trackers (Supports per-item multi-exchanges) */}
      {isUnderExchange && (exchangesList.length > 0 ? exchangesList : [undefined]).map((exItem: any, exIdx: number) => {
        const activeEx = exItem;
        const exStageVal = activeEx?.stage || inferredExchange.stage;
        const isExReq = exStageVal === "requested";
        const isExApp = exStageVal === "approved";
        const isExPick = exStageVal === "picked_up";
        const isExComp = exStageVal === "completed";
        const feeAmount = typeof activeEx?.shippingFee === "number"
          ? activeEx.shippingFee
          : inferredExchange.shippingFee;
        const feeStatus = activeEx?.shippingFeeStatus || inferredExchange.shippingFeeStatus;
        const qcStatusVal = activeEx?.qcStatus || inferredExchange.qcStatus;
        const qcPassed = qcStatusVal === "passed" || isExComp;
        const qcFailed = exStageVal === "qc_failed" || qcStatusVal === "failed";
        const isRejected = exStageVal === "rejected";
        const isExRejOrFailed = isRejected || qcFailed;
        const effectiveReverseAwb = activeEx?.reverseAwb || (!activeEx ? inferredExchange.reverseAwb : undefined);
        const effectiveReplacementAwb = activeEx?.replacementAwb || (!activeEx ? inferredExchange.replacementAwb : undefined);
        const effectiveRejectionReason = activeEx?.rejectionReason || (!activeEx ? inferredExchange.rejectionReason : undefined);
        const effectiveQcNotes = activeEx?.qcNotes || (!activeEx ? inferredExchange.qcNotes : undefined);
        const feeSettled =
          feeAmount <= 0 ||
          ["paid_online", "paid_manual", "cod_on_replacement", "waived"].includes(feeStatus);
        const replacementDispatched =
          exStageVal === "replacement_dispatched" || exStageVal === "completed" || isExComp;
        const needsFeePayment = qcPassed && feeStatus === "pending" && feeAmount > 0;
        const exchangeItemsLabel = Array.isArray(activeEx?.items) && activeEx.items.length > 0
          ? activeEx.items.map((i: any) => `${i.name}${i.variantId ? ` [${i.variantId}]` : ""} x${i.quantity || 1}`).join(", ")
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
            label: feeStatus === "cod_on_replacement" ? `COD ₹${feeAmount}` : feeSettled ? "Fee Settled" : `Fee ₹${feeAmount}`,
            active: feeSettled || replacementDispatched || isExComp,
          },
          {
            label: isExComp ? "Completed" : "Replacement Sent",
            active: replacementDispatched || isExComp,
          },
        ];

        return (
          <div key={activeEx?.exchangeId || `ex_${exIdx}`} className={`rounded-xl p-4 sm:p-5 mb-6 shadow-xs flex flex-col gap-4 border ${
            isExRejOrFailed
              ? "bg-red-50/70 border-red-300"
              : isExComp
              ? "bg-emerald-50/60 border-emerald-300"
              : "bg-gradient-to-r from-amber-50 to-orange-50/70 border-amber-300"
          }`}>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold shrink-0 ${
                  isExRejOrFailed
                    ? "bg-red-100 border-red-300 text-red-700"
                    : isExComp
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                    : "bg-amber-100 border-amber-300 text-amber-800"
                }`}>
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm sm:text-base text-neutral-900 uppercase tracking-tight">
                      {isRejected && "Exchange Request Not Approved"}
                      {qcFailed && "Warehouse Quality Check Failed"}
                      {!isExRejOrFailed && isExComp && "Exchange Completed — Replacement Delivered"}
                      {!isExRejOrFailed && !isExComp && replacementDispatched && "Replacement Product Dispatched!"}
                      {!isExRejOrFailed && !isExComp && !replacementDispatched && needsFeePayment && `QC Passed — Pay ₹${feeAmount} Shipping Fee`}
                      {!isExRejOrFailed && !isExComp && !replacementDispatched && !needsFeePayment && qcPassed && "QC Passed & Fee Settled — Packing Replacement"}
                      {!isExRejOrFailed && !qcPassed && isExPick && "Gear Picked Up — In Transit for Warehouse QC"}
                      {!isExRejOrFailed && !qcPassed && !isExPick && isExApp && "Exchange Approved — Doorstep Pickup Scheduled"}
                      {!isExRejOrFailed && !qcPassed && !isExPick && !isExApp && isExReq && "Exchange Request Submitted — Under Review"}
                    </h3>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                      isExRejOrFailed
                        ? "bg-red-100 text-red-800 border-red-300"
                        : isExComp || replacementDispatched
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : qcPassed
                        ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                        : isExPick
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : isExApp
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}>
                      {isRejected ? "Rejected" : qcFailed ? "QC Failed" : isExComp ? "Completed" : replacementDispatched ? "Dispatched" : needsFeePayment ? "Pay Shipping Fee" : qcPassed ? "Ready to Dispatch" : isExPick ? "In Transit" : isExApp ? "Pickup Scheduled" : "In Review"}
                    </span>
                  </div>
                  {exchangeItemsLabel && (
                    <p className="text-xs font-bold text-amber-950 mt-1">
                      Item(s): {exchangeItemsLabel}
                    </p>
                  )}
                  <p className="text-xs text-neutral-700 font-medium mt-1 leading-relaxed">
                    {isRejected && (effectiveRejectionReason || "Your exchange request was declined per store policy.")}
                    {qcFailed && (effectiveQcNotes || "Exchange gear did not meet unused/original-tag QC criteria. Our support team will contact you.")}
                    {!isExRejOrFailed && isExComp && "Your gear exchange has been successfully delivered. Ride safe with Store4Riders!"}
                    {!isExRejOrFailed && !isExComp && replacementDispatched && (
                      feeStatus === "cod_on_replacement"
                        ? `Your replacement is on the way! Keep ₹${feeAmount} ready (Cash or UPI) to pay the delivery partner upon arrival.`
                        : "Your replacement gear is on the way! Use the tracking details below to follow delivery."
                    )}
                    {!isExRejOrFailed && !isExComp && !replacementDispatched && needsFeePayment && `Your exchange gear passed quality inspection! As per store exchange policy, settle the ₹${feeAmount} 2-way pickup & replacement shipping charges below to unlock immediate replacement dispatch.`}
                    {!isExRejOrFailed && !isExComp && !replacementDispatched && !needsFeePayment && qcPassed && "QC and courier fee settlement are complete! Our warehouse is packing your replacement item now."}
                    {!isExRejOrFailed && !qcPassed && isExPick && "Courier has collected your parcel and is bringing it to our warehouse for quality inspection (24-48 hours post arrival)."}
                    {!isExRejOrFailed && !qcPassed && !isExPick && isExApp && "Approved! Our courier partner will collect the packaged gear within 2-3 business days. Please keep original tags and box intact."}
                    {!isExRejOrFailed && !qcPassed && !isExPick && !isExApp && isExReq && "Our team is reviewing your exchange request and verifying replacement size stock (within 48 hours)."}
                  </p>
                </div>
              </div>

              <a
                href={`https://wa.me/${whatsappFormattedPhone}?text=${encodeURIComponent(`Hi Store4Riders, I need assistance with my Exchange Request for Order #${order.orderNumber}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
              >
                <span>💬 WhatsApp Exchange Support</span>
              </a>
            </div>

            {/* Hybrid Payment Mode Sync: Online Pay (PayU/UPI) OR Admin-Selected COD / Paid Banner */}
            {needsFeePayment && (
              <div className="bg-white border-2 border-brand/30 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand block">
                      Online Payment Requested By Store
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-neutral-900">
                      Pay 2-Way Exchange Shipping Fee: {formatPrice(feeAmount)}
                    </h4>
                  </div>
                  <span className="text-lg font-black text-brand bg-red-50 px-3 py-1 rounded-lg border border-red-200 w-fit">
                    {formatPrice(feeAmount)}
                  </span>
                </div>

                {/* Gateway Pills */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Choose Payment Method:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableFeeGateways.map((gw) => (
                      <button
                        key={gw}
                        type="button"
                        onClick={() => setSelectedFeeGateway(gw)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedFeeGateway === gw
                            ? "bg-neutral-900 text-white border-neutral-900 shadow-2xs"
                            : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {gw === "payu"
                            ? "PayU (UPI / Cards / NetBanking)"
                            : gw === "ccavenue"
                            ? "CCAvenue (UPI / Cards / NetBanking)"
                            : "Direct UPI QR / GPay"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 flex-wrap">
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={payExchangeFeeMutation.isPending}
                      onClick={() => handlePayExchangeFee(activeEx?.exchangeId)}
                      className="w-full sm:w-auto bg-brand hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {payExchangeFeeMutation.isPending
                          ? "Initializing Gateway..."
                          : selectedFeeGateway === "payu"
                          ? `Pay ₹${feeAmount} via PayU`
                          : selectedFeeGateway === "ccavenue"
                          ? `Pay ₹${feeAmount} via CCAvenue`
                          : `Pay ₹${feeAmount} Online (UPI)`}
                      </span>
                    </button>

                    {activeEx?.shippingFeeGatewayOrderId && (
                      <button
                        type="button"
                        disabled={isSyncingFeeStatus}
                        onClick={() => handleSyncExchangeFeePayment(activeEx.shippingFeeGatewayOrderId)}
                        className="w-full sm:w-auto bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 font-bold text-xs px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFeeStatus ? "animate-spin" : ""}`} />
                        <span>{isSyncingFeeStatus ? "Checking PayU..." : "Already Paid? Refresh Status"}</span>
                      </button>
                    )}
                  </div>

                  <a
                    href={`https://wa.me/${whatsappFormattedPhone}?text=${encodeURIComponent(`Hi Store4Riders, my exchange for Order #${order.orderNumber} passed QC. Please switch my replacement shipping fee (Rs. ${feeAmount}) to Cash on Delivery (COD).`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-neutral-600 hover:text-neutral-900 underline underline-offset-2 text-center sm:text-right"
                  >
                    Want Cash on Delivery (₹{feeAmount} COD)? Request via WhatsApp →
                  </a>
                </div>
              </div>
            )}

            {!isExRejOrFailed && qcPassed && feeStatus === "cod_on_replacement" && !isExComp && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 block">
                    Cash On Delivery Approved By Store
                  </span>
                  <h4 className="text-sm sm:text-base font-black text-blue-950">
                    Pay ₹{feeAmount} COD When Replacement Arrives
                  </h4>
                  <p className="text-xs text-blue-900 leading-relaxed">
                    No online advance payment is needed. Pay ₹{feeAmount} (Cash or UPI) directly to the delivery partner upon receiving your replacement parcel.
                  </p>
                </div>
                <span className="text-base font-black text-blue-900 bg-white px-3.5 py-2 rounded-lg border border-blue-300 shrink-0 w-fit">
                  COD: ₹{feeAmount}
                </span>
              </div>
            )}

            {!isExRejOrFailed && qcPassed && (feeStatus === "paid_online" || feeStatus === "paid_manual") && !isExComp && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-black uppercase text-emerald-900 block">
                    ✓ Exchange Shipping Fee Paid ({formatPrice(feeAmount)})
                  </span>
                  <span className="text-emerald-800">
                    {activeEx?.shippingFeePaymentMethod
                      ? `Method: ${String(activeEx.shippingFeePaymentMethod).toUpperCase()}`
                      : "Verified"}
                    {activeEx?.shippingFeePaymentRef ? ` • Ref: ${activeEx.shippingFeePaymentRef}` : ""}
                  </span>
                </div>
                <span className="font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200 w-fit">
                  Cleared for Dispatch
                </span>
              </div>
            )}

            {/* Structured Exchange Summary + Reverse / Forward Courier Tracking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Requested Replacement Details */}
              <div className="bg-white/90 border border-amber-200/80 rounded-lg p-3 space-y-1.5">
                <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-400 block">
                  Exchange Request Summary
                </span>
                <p className="font-bold text-neutral-900">
                  Reason: {activeEx?.reasonType || parsedNote.reasonType}
                </p>
                {(activeEx?.desiredReplacement || (!activeEx ? parsedNote.replacementRequirement : "")) && (
                  <p className="text-neutral-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-semibold">
                    Replacement Demanded: {activeEx?.desiredReplacement || parsedNote.replacementRequirement}
                  </p>
                )}
                {(activeEx?.customerNote || (!activeEx ? parsedNote.customerNote : "")) && (
                  <p className="text-neutral-600 break-all">
                    Note: &ldquo;{activeEx?.customerNote || parsedNote.customerNote}&rdquo;
                  </p>
                )}
              </div>

              {/* Logistics & Fee Status Card */}
              <div className="bg-white/90 border border-amber-200/80 rounded-lg p-3 space-y-2">
                <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-400 block">
                  Courier &amp; Shipping Fee Tracker
                </span>

                {/* Reverse Pickup AWB */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-500">Reverse Pickup AWB:</span>
                  {effectiveReverseAwb ? (
                    <span className="font-mono font-bold text-neutral-900 inline-flex items-center gap-1">
                      {activeEx?.reverseCourier ? `${activeEx.reverseCourier}: ` : ""}
                      {effectiveReverseAwb}
                      {activeEx?.reverseTrackingUrl && (
                        <a href={activeEx.reverseTrackingUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">Pending assignment</span>
                  )}
                </div>

                {/* Shipping Fee Status */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-500">2-Way Shipping Fee:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    feeStatus === "paid_online" || feeStatus === "paid_manual"
                      ? "bg-emerald-100 text-emerald-800"
                      : feeStatus === "cod_on_replacement"
                      ? "bg-blue-100 text-blue-800"
                      : feeStatus === "waived"
                      ? "bg-neutral-100 text-neutral-700"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {feeStatus === "paid_online" && `Paid Online (₹${feeAmount})`}
                    {feeStatus === "paid_manual" && `Paid via UPI/Bank (₹${feeAmount})`}
                    {feeStatus === "cod_on_replacement" && `COD on Delivery (₹${feeAmount})`}
                    {feeStatus === "waived" && "Waived (₹0)"}
                    {feeStatus === "pending" && (qcPassed ? `Due: ₹${feeAmount}` : `₹${feeAmount} (Pay post QC)`)}
                  </span>
                </div>

                {/* Forward Replacement AWB */}
                {effectiveReplacementAwb && (
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-neutral-100">
                    <span className="text-emerald-700 font-semibold">Replacement AWB:</span>
                    <span className="font-mono font-bold text-emerald-900 inline-flex items-center gap-1">
                      {activeEx?.replacementCourier ? `${activeEx.replacementCourier}: ` : ""}
                      {effectiveReplacementAwb}
                      {activeEx?.replacementTrackingUrl && (
                        <a href={activeEx.replacementTrackingUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 5-Stage Exchange Stepper */}
            {!isRejected && (
              <div className="pt-2 border-t border-amber-200/80">
                <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center">
                  {stepStates.map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.failed
                          ? "bg-red-600 text-white shadow-xs"
                          : step.active
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-neutral-200 text-neutral-500"
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-tight leading-tight ${
                        step.failed ? "text-red-700" : step.active ? "text-neutral-900" : "text-neutral-400"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 3.2 Delivered Order Exchange Option Card */}
      {wasDelivered && hasExchangeableItems && exchangeWindowStatus.allowed && (
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl p-4 sm:p-5 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 text-amber-400 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white tracking-tight uppercase">
                Need a Size Replacement or Gear Exchange?
              </h3>
              <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed max-w-xl">
                Wrong size? Select an individual item below or click Request Exchange for unwashed, unused gear with original manufacturer tags intact.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreselectedExchangeItemId(null);
              setIsExchangeModalOpen(true);
            }}
            className="w-full sm:w-auto bg-brand hover:bg-red-800 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Request Exchange</span>
          </button>
        </div>
      )}

      {/* 4. Two Column Layout: Items (Left) & Delivery/Payment (Right) */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        
        {/* Left Column: Items List */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="border-b border-neutral-100 p-3.5 sm:p-4 bg-neutral-50/70 flex items-center justify-between">
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-neutral-600" />
                <span>Items in Order ({order.items?.length || 0})</span>
              </h2>
            </div>
            
            <div className="divide-y divide-neutral-100">
              {order.items?.map((item: any, idx: number) => {
                const itemKey = String(item._id || item.id || item.productId || idx);
                const itemImg = item.image || item.product?.images?.[0]?.url || item.product?.image || "/no-image.svg";
                const itemSlug = item.slug || item.product?.slug || "";
                const itemName = item.name || item.product?.name || "Riding Gear";
                const unitPrice = item.price ?? item.unitPrice ?? 0;
                const lineTotal = unitPrice * (item.quantity || 1);
                const matchedItemExchange = findExchangeForOrderItem(order, item);
                const itemHasActiveExchange = Boolean(
                  matchedItemExchange && !["rejected", "qc_failed"].includes(matchedItemExchange.stage)
                );
                const canExchangeThisItem =
                  wasDelivered && exchangeWindowStatus.allowed && !itemHasActiveExchange;

                return (
                  <div key={itemKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4">
                    <div className="flex gap-3 sm:gap-4 items-center min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-neutral-50 border border-neutral-100 rounded-lg shrink-0 flex items-center justify-center p-1 overflow-hidden">
                        <Image 
                          src={itemImg} 
                          alt={itemName} 
                          fill 
                          className="object-contain p-1 mix-blend-multiply" 
                          sizes="(max-width: 640px) 64px, 80px"
                        />
                      </div>
                      
                      {/* Details */}
                      <div className="flex flex-col flex-1 min-w-0">
                        {itemSlug ? (
                          <Link href={`/${itemSlug}`}>
                            <p className="text-xs sm:text-sm font-bold text-neutral-900 line-clamp-2 leading-snug hover:text-brand transition-colors">
                              {itemName}
                            </p>
                          </Link>
                        ) : (
                          <p className="text-xs sm:text-sm font-bold text-neutral-900 line-clamp-2 leading-snug">
                            {itemName}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500 mt-1">
                          {item.variantId && <span>Variant: <strong className="text-neutral-800">{item.variantId}</strong></span>}
                          <span>Qty: <strong className="text-neutral-800">{item.quantity}</strong></span>
                          <span>Price: <strong className="text-neutral-800">{formatPrice(unitPrice)}</strong></span>
                        </div>

                        <div className="mt-1.5 flex items-baseline gap-1">
                          <span className="text-[10px] text-neutral-400 uppercase font-bold">Item Total:</span>
                          <span className="text-xs sm:text-sm font-black text-neutral-900">{formatPrice(lineTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Per-item Exchange Status or Action Button */}
                    <div className="flex items-center gap-2 shrink-0 sm:self-center">
                      {matchedItemExchange && (
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                          matchedItemExchange.stage === "rejected" || matchedItemExchange.stage === "qc_failed"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : matchedItemExchange.stage === "completed" || matchedItemExchange.stage === "replacement_dispatched"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          Exchange: {String(matchedItemExchange.stage || "requested").replace(/_/g, " ")}
                        </span>
                      )}

                      {canExchangeThisItem && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreselectedExchangeItemId(itemKey);
                            setIsExchangeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 text-neutral-800 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-600" />
                          <span>Exchange Item</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Summaries (Payment + Shipping) */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-4">
          
          {/* Order Financial Summary */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-900 mb-3 pb-3 border-b border-neutral-100 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-neutral-500" />
              <span>Payment Breakdown</span>
            </h2>
            
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-neutral-900">{formatPrice(order.pricing?.subtotal || order.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Shipping / Delivery</span>
                <span className="font-semibold text-neutral-900">
                  {order.pricing?.shipping > 0 ? formatPrice(order.pricing.shipping) : "FREE"}
                </span>
              </div>
              {order.paymentMethod === "cod" && (order.pricing?.codHandlingFee || 0) > 0 && (
                <div className="flex justify-between text-amber-800">
                  <span>COD Cash Handling Fee</span>
                  <span className="font-semibold text-amber-900">+{formatPrice(order.pricing?.codHandlingFee || 0)}</span>
                </div>
              )}
              {order.pricing?.tax > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span className="flex items-center gap-1">
                    GST ({typeof order.pricing?.taxRate === "number" ? order.pricing.taxRate : 18}%)
                  </span>
                  <span className="font-semibold text-neutral-900">{formatPrice(order.pricing?.tax)}</span>
                </div>
              )}
              {((order.pricing?.couponDiscount || 0) > 0 || (order.pricing?.discount || 0) > 0) && (
                <div className="flex justify-between text-emerald-600">
                  <span>
                    Coupon Discount {order.pricing?.couponCode ? `(${order.pricing.couponCode})` : ""}
                  </span>
                  <span className="font-bold">
                    -{formatPrice(order.pricing?.couponDiscount || order.pricing?.discount || 0)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-3 mt-1 border-t border-dashed border-neutral-200">
                <span className="font-bold text-neutral-900 uppercase text-xs tracking-wider">Grand Total</span>
                <span className="text-lg sm:text-xl font-black text-brand">
                  {formatPrice(order.pricing?.total || order.totalAmount || 0)}
                </span>
              </div>

              {/* COD Partial Advance Breakdown */}
              {order.paymentMethod === "cod" && (order.pricing?.codPartialPaymentAmount || 0) > 0 && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1">
                  <div className="flex justify-between text-amber-900 font-medium">
                    <span>Advance Paid Online:</span>
                    <span className="font-bold">{formatPrice(order.pricing?.codPartialPaymentAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-red-700 font-bold border-t border-amber-200/60 pt-1">
                    <span>Due on Delivery:</span>
                    <span>{formatPrice(order.pricing?.codAmountToCollect ?? (order.pricing?.total - (order.pricing?.codPartialPaymentAmount || 0)))}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address & Mode */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-900 mb-3 pb-3 border-b border-neutral-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-neutral-500" />
              <span>Delivery Details</span>
            </h2>
            
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <p className="font-bold text-neutral-900 text-sm">{order.shippingAddress?.fullName}</p>
                <p className="text-neutral-600 leading-relaxed text-xs mt-0.5">
                  {order.shippingAddress?.street || order.shippingAddress?.addressLine1}
                  {order.shippingAddress?.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ""}<br />
                  {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
                </p>
                {order.shippingAddress?.phone && (
                  <p className="text-neutral-700 text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <Phone className="w-3 h-3 text-neutral-400" />
                    <span>{order.shippingAddress.phone}</span>
                  </p>
                )}
              </div>

              {/* Payment Mode Tag */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Payment Method:
                </span>
                <span className="font-bold text-xs text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : order.paymentMethod?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* WhatsApp Support Assistance */}
          <a
            href={`https://wa.me/${whatsappFormattedPhone}?text=${encodeURIComponent(`Hi Store4Riders, I have a query regarding my Order #${order.orderNumber}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs p-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-center"
          >
            <span>💬 Need help with this order? Chat on WhatsApp</span>
          </a>

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
