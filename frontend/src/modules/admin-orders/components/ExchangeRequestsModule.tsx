"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import {
  formatPrice,
  parseExchangeNote,
  type ParsedExchangeNote,
} from "@store4riders/shared-utils";
import {
  useAdminOrders,
  useAdminHandleReturn,
  useAdminCompleteExchange,
} from "@/core/hooks/useAdminOrders";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { format } from "date-fns";
import {
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathRoundedSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ShieldCheckIcon,
  EyeIcon,
  TruckIcon,
  CurrencyRupeeIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { OrdersNavTabs } from "./OrdersNavTabs";
import {
  ExchangeWorkflowModals,
  resolveOrderExchangeState,
  type ActiveExchangeActionModal,
} from "./ExchangeWorkflowModals";

export { parseExchangeNote, type ParsedExchangeNote };

function getReasonBadgeStyle(reasonType: string = "") {
  const r = reasonType.toLowerCase();
  if (r.includes("defect") || r.includes("damage")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (r.includes("color") || r.includes("graphic")) {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }
  if (r.includes("size") || r.includes("fit") || r.includes("comfort")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (r.includes("wrong") || r.includes("incorrect")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-neutral-100 text-neutral-800 border-neutral-200";
}

function getStageDisplayBadge(stage: string, status: string) {
  switch (stage) {
    case "rejected":
      return { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" };
    case "qc_failed":
      return { label: "QC Failed", className: "bg-red-100 text-red-800 border-red-200" };
    case "completed":
      return { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "replacement_dispatched":
      return { label: "Replacement Sent", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "fee_settled":
      return { label: "Ready to Dispatch", className: "bg-indigo-100 text-indigo-800 border-indigo-200" };
    case "qc_passed":
      return { label: "QC Passed • Fee Due", className: "bg-amber-100 text-amber-900 border-amber-300" };
    case "picked_up":
      return { label: "Picked Up • Needs QC", className: "bg-blue-100 text-blue-800 border-blue-200" };
    case "approved":
      return { label: "Pickup Scheduled", className: "bg-purple-100 text-purple-800 border-purple-200" };
    case "requested":
      return { label: "Pending Review", className: "bg-amber-100 text-amber-800 border-amber-200" };
    default:
      return {
        label: (status || "pending").replace(/_/g, " "),
        className: "bg-neutral-100 text-neutral-800 border-neutral-200",
      };
  }
}

export const ExchangeRequestsModule = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("exchanges");
  const [rejectModalOrder, setRejectModalOrder] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailModalOrder, setDetailModalOrder] = useState<any | null>(null);
  const [activeWorkflowModal, setActiveWorkflowModal] = useState<ActiveExchangeActionModal>(null);

  const { data: settings } = usePublicSettings();
  const defaultFee = typeof settings?.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;

  const handleReturnMutation = useAdminHandleReturn();
  const completeMutation = useAdminCompleteExchange();

  const { data, isLoading } = useAdminOrders({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter,
  });

  const orders = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 20);

  const handleConfirmReject = () => {
    if (!rejectModalOrder) return;
    const orderId = rejectModalOrder.id || rejectModalOrder._id;
    handleReturnMutation.mutate(
      {
        orderId,
        action: "reject",
        adminNote: rejectReason || "Exchange request rejected per store policy guidelines.",
      },
      {
        onSuccess: () => {
          setRejectModalOrder(null);
          setRejectReason("");
          if (detailModalOrder?._id === orderId || detailModalOrder?.id === orderId) {
            setDetailModalOrder(null);
          }
        },
      }
    );
  };

  const handleWhatsAppContact = (order: any) => {
    const rawPhone = order.shippingAddress?.phone || "";
    const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const customerName = order.shippingAddress?.fullName || "Rider";
    const orderNum = order.orderNumber || order.id || order._id;

    let msg = `*Store4Riders — Exchange Support*\n\n`;
    msg += `Hello *${customerName}*,\n\n`;
    msg += `We have received your size/gear exchange request for Order *#${orderNum}*.\n\n`;
    msg += `Our team is coordinating your reverse pickup and replacement. Let us know if you need any assistance!\n\n`;
    msg += `Best regards,\nStore4Riders Exchange Team`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 uppercase flex items-center gap-2">
            <span>Customer Exchange Requests</span>
            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-mono font-bold">
              {totalCount} Total
            </span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Review exchanges, schedule reverse pickups, run warehouse QC, settle shipping fees ({formatPrice(defaultFee)}), and dispatch replacements.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <OrdersNavTabs />

      {/* Policy Reminder Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Strict Exchange-Only Lifecycle (Pickup ➔ QC ➔ Fee ➔ Replacement)
            </h2>
            <p className="text-xs text-amber-800 mt-0.5">
              1. Approve &amp; schedule Reverse Pickup • 2. Inspect exchange parcel (QC Pass/Fail) • 3. Collect 2-way fee (Online / WhatsApp / COD ₹{defaultFee}) • 4. Dispatch replacement AWB.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 border border-neutral-200 rounded-lg flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="relative w-full lg:w-80 shrink-0">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search order #, customer, phone, product..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-brand"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { label: "All Exchanges", value: "exchanges" },
            { label: "Pending Review", value: "return_requested" },
            { label: "Pickup Scheduled", value: "return_approved" },
            { label: "Picked / QC Queue", value: "return_picked" },
            { label: "Awaiting Fee", value: "awaiting_fee" },
            { label: "Ready Dispatch", value: "fee_settled" },
            { label: "Replacement Sent", value: "replacement_dispatched" },
            { label: "Completed", value: "returned" },
            { label: "QC Failed", value: "qc_failed" },
          ].map((pill) => (
            <button
              key={pill.value}
              onClick={() => {
                setStatusFilter(pill.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === pill.value
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1180px] divide-y divide-neutral-200">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-xs font-bold">
              <tr>
                <th className="px-4 py-3.5 w-[135px]">Order / Date</th>
                <th className="px-4 py-3.5 w-[175px]">Customer</th>
                <th className="px-4 py-3.5 w-[205px]">Item to Exchange</th>
                <th className="px-4 py-3.5 w-[280px]">Reason &amp; Request</th>
                <th className="px-4 py-3.5 w-[175px]">Stage &amp; Fee / AWB</th>
                <th className="px-4 py-3.5 w-[220px] text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      Loading Exchange Requests...
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center font-bold">
                        <ArrowPathRoundedSquareIcon className="w-5 h-5" />
                      </div>
                      <div className="text-neutral-900 font-bold">No Exchange Requests Found</div>
                      <p className="text-xs text-neutral-400 max-w-sm text-center">
                        No exchange requests match the selected stage filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => {
                  const orderId = order.id || order._id;
                  const customerName = order.shippingAddress?.fullName || "Customer";
                  const customerPhone = order.shippingAddress?.phone || "";
                  const customerEmail = order.customerEmail || order.guestEmail || "";
                  const customerLocation = [order.shippingAddress?.city, order.shippingAddress?.state]
                    .filter(Boolean)
                    .join(", ");
                  const cleanPhone = customerPhone.replace(/[^0-9]/g, "");

                  const exState = resolveOrderExchangeState(order, defaultFee);
                  const badge = getStageDisplayBadge(exState.stage, order.status);
                  const reasonBadgeClass = getReasonBadgeStyle(exState.reasonType);
                  const isFeeSettled =
                    exState.feeAmount <= 0 ||
                    ["paid_online", "paid_manual", "cod_on_replacement", "waived"].includes(exState.feeStatus);

                  return (
                    <tr key={orderId} className="hover:bg-neutral-50/80 transition-colors">
                      {/* 1. Order / Date */}
                      <td className="px-4 py-3.5 align-top">
                        <Link
                          href={`/admin/orders/${orderId}`}
                          className="font-mono font-bold text-neutral-900 hover:text-brand transition-colors inline-flex items-center gap-1"
                        >
                          <span>#{order.orderNumber || String(orderId).slice(-8).toUpperCase()}</span>
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-neutral-400" />
                        </Link>
                        <div className="text-xs text-neutral-500 mt-1">
                          {format(new Date(order.createdAt), "MMM dd, yyyy")}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {format(new Date(order.createdAt), "hh:mm a")}
                        </div>
                      </td>

                      {/* 2. Customer Info */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-neutral-900 text-xs truncate max-w-[165px]" title={customerName}>
                          {customerName}
                        </div>
                        {customerPhone && (
                          <div className="flex items-center gap-1 text-xs text-neutral-600 mt-1 font-mono">
                            <PhoneIcon className="w-3 h-3 text-neutral-400 shrink-0" />
                            <a href={`tel:${cleanPhone}`} className="hover:text-brand transition-colors">
                              {customerPhone}
                            </a>
                          </div>
                        )}
                        {customerEmail && (
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5 truncate max-w-[165px]" title={customerEmail}>
                            <EnvelopeIcon className="w-3 h-3 text-neutral-400 shrink-0" />
                            <a href={`mailto:${customerEmail}`} className="hover:text-brand transition-colors truncate">
                              {customerEmail}
                            </a>
                          </div>
                        )}
                        {customerLocation && (
                          <div className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[165px]" title={customerLocation}>
                            📍 {customerLocation}
                          </div>
                        )}
                      </td>

                      {/* 3. Item to Exchange */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-2 max-w-[195px]">
                          {order.items?.map((item: any, idx: number) => {
                            const imgUrl =
                              item.image || item.product?.images?.[0]?.url || item.product?.image || "/no-image.svg";
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 rounded-lg shrink-0 relative overflow-hidden p-0.5">
                                  <Image src={imgUrl} alt={item.name || "Product"} fill className="object-contain" sizes="40px" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-neutral-900 text-xs truncate" title={item.name}>
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 flex-wrap">
                                    <span>Qty: {item.quantity}</span>
                                    {item.variantId && <span className="bg-neutral-100 px-1 rounded">{item.variantId}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* 4. Reason / Notes (Structured & Readable) */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-1.5 max-w-[270px]">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${reasonBadgeClass}`}>
                            {exState.reasonType}
                          </span>

                          {exState.desiredReplacement ? (
                            <div className="bg-amber-50/90 border border-amber-200 rounded-md p-1.5 text-xs">
                              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                                Desired Replacement:
                              </span>
                              <span className="font-bold text-neutral-900 text-xs break-all">
                                {exState.desiredReplacement}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-neutral-400 italic">Replacement variant not specified.</div>
                          )}

                          {exState.customerNote && (
                            <div className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md p-1.5">
                              <p className="text-[11px] text-neutral-800 break-all line-clamp-2">
                                &ldquo;{exState.customerNote}&rdquo;
                              </p>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setDetailModalOrder(order)}
                            className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1 pt-0.5 cursor-pointer"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>View Full Request Details</span>
                          </button>
                        </div>
                      </td>

                      {/* 5. Stage & Logistics / Fee Sub-badges */}
                      <td className="px-4 py-3.5 align-top space-y-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${badge.className}`}>
                          {badge.label}
                        </span>

                        {exState.reverseAwb && (
                          <div className="text-[10px] font-mono bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded truncate max-w-[165px]" title={`Reverse: ${exState.reverseCourier} ${exState.reverseAwb}`}>
                            REV: {exState.reverseAwb}
                          </div>
                        )}

                        {exState.qcStatus === "passed" && (
                          <div
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border inline-block ${
                              exState.feeStatus === "paid_online" || exState.feeStatus === "paid_manual"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : exState.feeStatus === "cod_on_replacement"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : exState.feeStatus === "waived"
                                ? "bg-neutral-100 text-neutral-700 border-neutral-200"
                                : "bg-amber-50 text-amber-900 border-amber-300"
                            }`}
                          >
                            {exState.feeStatus === "paid_online" &&
                              `Fee Paid Online${exState.feePaymentMethod ? ` (${exState.feePaymentMethod.toUpperCase()})` : ""} • ₹${exState.feeAmount}`}
                            {exState.feeStatus === "paid_manual" && `Fee Paid UPI (₹${exState.feeAmount})`}
                            {exState.feeStatus === "cod_on_replacement" && `COD ₹${exState.feeAmount} Set`}
                            {exState.feeStatus === "waived" && "Fee Waived"}
                            {exState.feeStatus === "pending" && `Awaiting Online Pay (₹${exState.feeAmount})`}
                          </div>
                        )}
                        {exState.feeStatus === "paid_online" && exState.feePaymentRef && (
                          <div className="text-[10px] font-mono text-emerald-800 truncate max-w-[165px]" title={exState.feePaymentRef}>
                            Ref: {exState.feePaymentRef}
                          </div>
                        )}

                        {exState.replacementAwb && (
                          <div className="text-[10px] font-mono bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded truncate max-w-[165px]" title={`Repl: ${exState.replacementCourier} ${exState.replacementAwb}`}>
                            REPL: {exState.replacementAwb}
                          </div>
                        )}
                      </td>

                      {/* 6. Contextual Workflow Action Column */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {order.status === "return_requested" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setActiveWorkflowModal({ type: "approve", order })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded text-[11px] font-bold uppercase hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <CheckCircleIcon className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectModalOrder(order)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded text-[11px] font-bold uppercase hover:bg-red-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <XCircleIcon className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {(exState.stage === "approved" || exState.stage === "picked_up") && exState.qcStatus !== "passed" && (
                              <>
                                {exState.stage === "approved" && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveWorkflowModal({ type: "pickup", order })}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold uppercase hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    <TruckIcon className="w-3.5 h-3.5" />
                                    <span>Pickup</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActiveWorkflowModal({ type: "qc", order })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded text-[11px] font-bold uppercase hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                                  <span>Do QC</span>
                                </button>
                              </>
                            )}

                            {exState.qcStatus === "passed" &&
                              exState.stage !== "replacement_dispatched" &&
                              exState.stage !== "completed" && (
                                <>
                                  {!isFeeSettled && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveWorkflowModal({ type: "fee", order })}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded text-[11px] font-bold uppercase hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
                                    >
                                      <CurrencyRupeeIcon className="w-3.5 h-3.5" />
                                      <span>Collect Fee</span>
                                    </button>
                                  )}
                                  {isFeeSettled && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setActiveWorkflowModal({ type: "dispatch", order })}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded text-[11px] font-bold uppercase hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                      >
                                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                                        <span>Dispatch Repl.</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveWorkflowModal({ type: "fee", order })}
                                        title="Change Fee / COD Mode"
                                        className="p-1.5 border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-100 cursor-pointer"
                                      >
                                        <CurrencyRupeeIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </>
                              )}

                            {exState.stage === "replacement_dispatched" && (
                              <button
                                type="button"
                                disabled={completeMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`Mark replacement delivered and complete exchange for Order #${order.orderNumber}?`)) {
                                    completeMutation.mutate(orderId);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 text-white rounded text-[11px] font-bold uppercase hover:bg-black transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                <span>Mark Delivered</span>
                              </button>
                            )}
                          </div>

                          {/* Quick Contact Icons */}
                          {customerPhone && (
                            <div className="flex items-center justify-end gap-1.5">
                              {exState.qcStatus === "passed" && exState.feeStatus === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => setActiveWorkflowModal({ type: "fee", order })}
                                  className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer mr-1"
                                >
                                  Or Dispatch COD →
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleWhatsAppContact(order)}
                                title="Chat on WhatsApp"
                                className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="Call customer"
                                className="p-1.5 border border-neutral-300 rounded hover:bg-neutral-100 text-neutral-700 transition-colors"
                              >
                                <PhoneIcon className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-200 flex justify-between items-center text-sm">
            <span className="text-neutral-500 text-xs">
              Page <span className="font-bold text-neutral-900">{page}</span> of{" "}
              <span className="font-bold text-neutral-900">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-neutral-300 rounded text-xs font-bold uppercase disabled:opacity-50 hover:bg-neutral-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-neutral-300 rounded text-xs font-bold uppercase disabled:opacity-50 hover:bg-neutral-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Exchange Details Modal */}
      {detailModalOrder && mounted && typeof document !== "undefined" && createPortal(
        (() => {
          const customerName = detailModalOrder.shippingAddress?.fullName || "Customer";
          const customerPhone = detailModalOrder.shippingAddress?.phone || "";
          const customerEmail = detailModalOrder.customerEmail || detailModalOrder.guestEmail || "";
          const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
          const exState = resolveOrderExchangeState(detailModalOrder, defaultFee);
          const badge = getStageDisplayBadge(exState.stage, detailModalOrder.status);
          const reasonBadgeClass = getReasonBadgeStyle(exState.reasonType);
          const isFeeSettled =
            exState.feeAmount <= 0 ||
            ["paid_online", "paid_manual", "cod_on_replacement", "waived"].includes(exState.feeStatus);

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setDetailModalOrder(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-neutral-200 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <ArrowPathRoundedSquareIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-neutral-900 uppercase text-base tracking-tight">
                        Exchange Request Dossier
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono">
                        Order #{detailModalOrder.orderNumber || String(detailModalOrder.id || detailModalOrder._id).slice(-8).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setDetailModalOrder(null)}
                    className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Status & Reason Banner */}
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Reason Category
                    </span>
                    <span className={`mt-1 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${reasonBadgeClass}`}>
                      {exState.reasonType}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Exchange Stage
                    </span>
                    <span className={`mt-1 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Shipping Fee (₹{exState.feeAmount})
                    </span>
                    <span className="mt-1 inline-block font-bold text-xs text-neutral-900 uppercase">
                      {exState.feeStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Logistics & QC Summary */}
                {(exState.reverseAwb || exState.qcNotes || exState.replacementAwb) && (
                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2 text-xs">
                    {exState.reverseAwb && (
                      <div>
                        <strong>Reverse Pickup:</strong> {exState.reverseCourier} — <span className="font-mono font-bold">{exState.reverseAwb}</span>
                      </div>
                    )}
                    {exState.qcNotes && (
                      <div>
                        <strong>QC Verdict ({exState.qcStatus.toUpperCase()}):</strong> {exState.qcNotes}
                      </div>
                    )}
                    {exState.feePaymentRef && (
                      <div>
                        <strong>Fee Payment Ref:</strong> <span className="font-mono">{exState.feePaymentRef}</span>
                      </div>
                    )}
                    {exState.replacementAwb && (
                      <div>
                        <strong>Replacement Forward AWB:</strong> {exState.replacementCourier} — <span className="font-mono font-bold text-emerald-800">{exState.replacementAwb}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Replacement Box */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <span>🔄</span>
                    <span>Requested Replacement (Size / Color / Variant):</span>
                  </span>
                  <p className="text-sm font-black text-neutral-900 bg-white p-3 rounded-lg border border-amber-200 break-all">
                    {exState.desiredReplacement || "Not specified by customer"}
                  </p>
                </div>

                {/* Customer Full Note */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 block">
                    Customer Explanation &amp; Notes:
                  </span>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-xs text-neutral-800 leading-relaxed break-all whitespace-pre-wrap">
                    {exState.customerNote || exState.rawNote || "No extra note provided."}
                  </div>
                </div>

                {/* Items in this Order */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 block">
                    Item(s) Ordered:
                  </span>
                  <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                    {detailModalOrder.items?.map((item: any, idx: number) => {
                      const imgUrl = item.image || item.product?.images?.[0]?.url || item.product?.image || "/no-image.svg";
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white">
                          <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 rounded-lg shrink-0 relative overflow-hidden p-1">
                            <Image src={imgUrl} alt={item.name || "Product"} fill className="object-contain" sizes="48px" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-neutral-900 text-xs">{item.name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                              {item.variantId && <span>Variant: <strong className="text-neutral-800">{item.variantId}</strong></span>}
                              <span>Qty: {item.quantity}</span>
                              {item.sku && <span>SKU: {item.sku}</span>}
                              <span>• {formatPrice(item.price ?? item.unitPrice ?? 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Customer Contact Card */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-neutral-900 text-sm block">{customerName}</span>
                    <span className="text-neutral-500 block">{customerEmail}</span>
                    {detailModalOrder.shippingAddress && (
                      <span className="text-neutral-500 block mt-0.5">
                        📍 {[detailModalOrder.shippingAddress.addressLine1, detailModalOrder.shippingAddress.city, detailModalOrder.shippingAddress.state, detailModalOrder.shippingAddress.pincode].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {customerPhone && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppContact(detailModalOrder)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </button>
                    )}
                    {customerPhone && (
                      <a
                        href={`tel:${cleanPhone}`}
                        className="px-3 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <PhoneIcon className="w-4 h-4" />
                        <span>{customerPhone}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-100 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailModalOrder(null)}
                    className="px-4 py-2.5 border border-neutral-300 rounded-lg text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    Close
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {detailModalOrder.status === "return_requested" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectModalOrder(detailModalOrder)}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                        >
                          Reject Exchange
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWorkflowModal({ type: "approve", order: detailModalOrder })}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                        >
                          Approve &amp; Pickup
                        </button>
                      </>
                    )}

                    {(exState.stage === "approved" || exState.stage === "picked_up") && exState.qcStatus !== "passed" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveWorkflowModal({ type: "pickup", order: detailModalOrder })}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                        >
                          Pickup / Reverse AWB
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWorkflowModal({ type: "qc", order: detailModalOrder })}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                        >
                          Perform Warehouse QC
                        </button>
                      </>
                    )}

                    {exState.qcStatus === "passed" && exState.stage !== "replacement_dispatched" && exState.stage !== "completed" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveWorkflowModal({ type: "fee", order: detailModalOrder })}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                        >
                          {isFeeSettled ? "Fee / COD Options" : `Collect Fee (₹${exState.feeAmount})`}
                        </button>
                        {isFeeSettled && (
                          <button
                            type="button"
                            onClick={() => setActiveWorkflowModal({ type: "dispatch", order: detailModalOrder })}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                          >
                            Dispatch Replacement
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Workflow Stage Action Modals */}
      <ExchangeWorkflowModals
        activeModal={activeWorkflowModal}
        onClose={() => setActiveWorkflowModal(null)}
        onActionSuccess={() => setDetailModalOrder(null)}
      />

      {/* Reject Modal */}
      {rejectModalOrder && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-neutral-900 uppercase text-base flex items-center gap-2">
                <XCircleIcon className="w-5 h-5 text-red-600" />
                <span>Reject Exchange Request</span>
              </h3>
              <button
                onClick={() => setRejectModalOrder(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              You are rejecting the exchange request for Order #
              <span className="font-bold text-neutral-900">
                {rejectModalOrder.orderNumber}
              </span>
              . Please provide a clear explanation for the customer (e.g., tags missing, outside exchange window, sign of wear).
            </p>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Reason for Rejection (Required)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this item cannot be accepted for exchange..."
                className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOrder(null)}
                className="px-4 py-2 border border-neutral-300 rounded text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={handleReturnMutation.isPending || !rejectReason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {handleReturnMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
