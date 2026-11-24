"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@store4riders/shared-utils";
import { useAdminOrders, useAdminHandleReturn } from "@/core/hooks/useAdminOrders";
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
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { OrdersNavTabs } from "./OrdersNavTabs";

export interface ParsedExchangeNote {
  raw: string;
  reasonType: string;
  replacementRequirement: string;
  itemsList: string;
  customerNote: string;
}

export function parseExchangeNote(text?: string): ParsedExchangeNote {
  if (!text) {
    return {
      raw: "",
      reasonType: "Customer Exchange Request",
      replacementRequirement: "",
      itemsList: "",
      customerNote: ""
    };
  }

  // Strip common prefixes
  const clean = text.replace(/^(Exchange|Return)\s+requested:\s*/i, "").trim();

  // If piped format: "Type: ... | Item(s): ... | Replacement: ... | Note: ..."
  // or "Reason: ... | Item(s): ... | Desired Replacement: ... | Note: ..."
  if (clean.includes("|")) {
    const parts = clean.split("|").map(p => p.trim());
    let reasonType = "";
    let replacementRequirement = "";
    let itemsList = "";
    let customerNote = "";

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower.startsWith("reason:") || lower.startsWith("type:")) {
        reasonType = part.replace(/^(reason|type):\s*/i, "").trim();
      } else if (lower.startsWith("replacement:") || lower.startsWith("desired replacement:")) {
        replacementRequirement = part.replace(/^(replacement|desired replacement):\s*/i, "").trim();
      } else if (lower.startsWith("item(s):") || lower.startsWith("item:") || lower.startsWith("items:")) {
        itemsList = part.replace(/^items?(\(s\))?:\s*/i, "").trim();
      } else if (lower.startsWith("note:") || lower.startsWith("details:")) {
        customerNote = part.replace(/^(note|details):\s*/i, "").trim();
      }
    }

    return {
      raw: text,
      reasonType: reasonType || "Exchange Requested",
      replacementRequirement,
      itemsList,
      customerNote
    };
  }

  // Not pipe-separated - raw string
  return {
    raw: text,
    reasonType: "Exchange Requested",
    replacementRequirement: "",
    itemsList: "",
    customerNote: clean
  };
}

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

export const ExchangeRequestsModule = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("exchanges"); // "exchanges", "return_requested", "return_approved", "return_picked", "returned"
  const [rejectModalOrder, setRejectModalOrder] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailModalOrder, setDetailModalOrder] = useState<any | null>(null);

  const handleReturnMutation = useAdminHandleReturn();

  const { data, isLoading } = useAdminOrders({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter,
  });

  const orders = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 20);

  const getExchangeStatusBadge = (status: string) => {
    switch (status) {
      case "return_requested":
        return {
          label: "Pending Review",
          className: "bg-amber-100 text-amber-800 border-amber-200",
        };
      case "return_approved":
        return {
          label: "Exchange Approved",
          className: "bg-purple-100 text-purple-800 border-purple-200",
        };
      case "return_picked":
        return {
          label: "Picked Up by Courier",
          className: "bg-blue-100 text-blue-800 border-blue-200",
        };
      case "returned":
        return {
          label: "Exchange Completed",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
      default:
        return {
          label: status.replace(/_/g, " "),
          className: "bg-neutral-100 text-neutral-800 border-neutral-200",
        };
    }
  };

  const handleApprove = (order: any) => {
    const orderId = order.id || order._id;
    if (window.confirm(`Approve exchange request for Order #${order.orderNumber}? Our reverse pickup courier will be assigned.`)) {
      handleReturnMutation.mutate({
        orderId,
        action: "approve",
        adminNote: "Approved for size / item exchange by staff.",
      }, {
        onSuccess: () => {
          if (detailModalOrder?._id === order._id || detailModalOrder?.id === order.id) {
            setDetailModalOrder(null);
          }
        }
      });
    }
  };

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
    msg += `We have received your size/defect exchange request for Order *#${orderNum}*.\n\n`;
    msg += `Our team is reviewing the replacement availability for you. Would you like us to proceed with dispatching the exchange?\n\n`;
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
              {totalCount} Active
            </span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Review incoming size replacement and defective gear exchange requests per Store4Riders policy.
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
              Strict Size &amp; Defect Exchange Policy
            </h2>
            <p className="text-xs text-amber-800 mt-0.5">
              Only unwashed, unused gear with original manufacturer tags &amp; boxes is eligible. No cash refunds are permitted.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 border border-neutral-200 rounded-lg flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
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
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[
            { label: "All Exchanges", value: "exchanges" },
            { label: "Pending Review", value: "return_requested" },
            { label: "Approved", value: "return_approved" },
            { label: "Picked Up", value: "return_picked" },
            { label: "Completed", value: "returned" },
          ].map((pill) => (
            <button
              key={pill.value}
              onClick={() => {
                setStatusFilter(pill.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
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
          <table className="w-full text-left text-sm min-w-[1050px] divide-y divide-neutral-200">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-xs font-bold">
              <tr>
                <th className="px-4 py-3.5 w-[140px]">Order / Date</th>
                <th className="px-4 py-3.5 w-[180px]">Customer</th>
                <th className="px-4 py-3.5 w-[210px]">Item to Exchange</th>
                <th className="px-4 py-3.5 w-[300px]">Reason &amp; Request</th>
                <th className="px-4 py-3.5 w-[130px]">Status</th>
                <th className="px-4 py-3.5 w-[200px] text-right">Review Action</th>
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
                        No customer has requested an item exchange under the selected filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => {
                  const customerName = order.shippingAddress?.fullName || "Customer";
                  const customerPhone = order.shippingAddress?.phone || "";
                  const customerEmail = order.customerEmail || order.guestEmail || "";
                  const customerLocation = [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(", ");
                  const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
                  const badge = getExchangeStatusBadge(order.status);

                  // Extract exchange reason from order notes if present
                  const returnNote = order.notes?.slice().reverse().find((n: any) => 
                    typeof n.text === "string" && (n.text.toLowerCase().includes("return") || n.text.toLowerCase().includes("exchange"))
                  );

                  const parsed = parseExchangeNote(returnNote?.text);
                  const reasonBadgeClass = getReasonBadgeStyle(parsed.reasonType);

                  return (
                    <tr key={order.id || order._id} className="hover:bg-neutral-50/80 transition-colors">
                      {/* 1. Order / Date */}
                      <td className="px-4 py-3.5 align-top">
                        <Link 
                          href={`/admin/orders/${order.id || order._id}`}
                          className="font-mono font-bold text-neutral-900 hover:text-brand transition-colors inline-flex items-center gap-1"
                        >
                          <span>#{order.orderNumber || (order.id || order._id).slice(-8).toUpperCase()}</span>
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
                        <div className="font-bold text-neutral-900 text-xs truncate max-w-[170px]" title={customerName}>
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
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5 truncate max-w-[170px]" title={customerEmail}>
                            <EnvelopeIcon className="w-3 h-3 text-neutral-400 shrink-0" />
                            <a href={`mailto:${customerEmail}`} className="hover:text-brand transition-colors truncate">
                              {customerEmail}
                            </a>
                          </div>
                        )}
                        {customerLocation && (
                          <div className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[170px]" title={customerLocation}>
                            📍 {customerLocation}
                          </div>
                        )}
                      </td>

                      {/* 3. Item to Exchange */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-2 max-w-[200px]">
                          {order.items?.map((item: any, idx: number) => {
                            const imgUrl = item.image || item.product?.images?.[0]?.url || item.product?.image || "/no-image.svg";
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 rounded-lg shrink-0 relative overflow-hidden p-0.5">
                                  <Image
                                    src={imgUrl}
                                    alt={item.name || "Product"}
                                    fill
                                    className="object-contain"
                                    sizes="40px"
                                  />
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
                        <div className="space-y-1.5 max-w-[290px]">
                          {/* Reason Type Badge */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${reasonBadgeClass}`}>
                              {parsed.reasonType}
                            </span>
                          </div>

                          {/* Desired Replacement Requirement */}
                          {parsed.replacementRequirement ? (
                            <div className="bg-amber-50/90 border border-amber-200 rounded-md p-1.5 text-xs">
                              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                                Desired Replacement:
                              </span>
                              <span className="font-bold text-neutral-900 text-xs break-all">
                                {parsed.replacementRequirement}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-neutral-400 italic">
                              Replacement variant not specified.
                            </div>
                          )}

                          {/* Customer Note with word-wrap */}
                          {parsed.customerNote && (
                            <div className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md p-1.5">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                                Customer Note:
                              </span>
                              <p className="text-xs text-neutral-800 break-all line-clamp-2">
                                "{parsed.customerNote}"
                              </p>
                            </div>
                          )}

                          {/* Link to view full dialog */}
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

                      {/* 5. Status */}
                      <td className="px-4 py-3.5 align-top">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* 6. Review Action (Spacious, No Cut-Off) */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {order.status === "return_requested" && (
                            <>
                              <button
                                type="button"
                                disabled={handleReturnMutation.isPending}
                                onClick={() => handleApprove(order)}
                                title="Approve Exchange"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold uppercase hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
                              >
                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                disabled={handleReturnMutation.isPending}
                                onClick={() => setRejectModalOrder(order)}
                                title="Reject Exchange"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded text-xs font-bold uppercase hover:bg-red-700 transition-colors shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
                              >
                                <XCircleIcon className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {customerPhone && (
                            <button
                              type="button"
                              onClick={() => handleWhatsAppContact(order)}
                              title="Chat on WhatsApp"
                              className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors shrink-0 cursor-pointer"
                            >
                              <ChatBubbleLeftRightIcon className="w-4 h-4" />
                            </button>
                          )}

                          {customerPhone && (
                            <a
                              href={`tel:${cleanPhone}`}
                              title="Call customer"
                              className="p-1.5 border border-neutral-300 rounded hover:bg-neutral-100 text-neutral-700 transition-colors shrink-0"
                            >
                              <PhoneIcon className="w-4 h-4" />
                            </a>
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
          const returnNote = detailModalOrder.notes?.slice().reverse().find((n: any) => 
            typeof n.text === "string" && (n.text.toLowerCase().includes("return") || n.text.toLowerCase().includes("exchange"))
          );
          const parsed = parseExchangeNote(returnNote?.text);
          const badge = getExchangeStatusBadge(detailModalOrder.status);
          const reasonBadgeClass = getReasonBadgeStyle(parsed.reasonType);

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-neutral-200 space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <ArrowPathRoundedSquareIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-neutral-900 uppercase text-base tracking-tight">
                        Exchange Request Details
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono">
                        Order #{detailModalOrder.orderNumber || (detailModalOrder.id || detailModalOrder._id).slice(-8).toUpperCase()}
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
                <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Exchange Reason Category
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border ${reasonBadgeClass}`}>
                      {parsed.reasonType}
                    </span>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Order Status
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Replacement Box */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <span>🔄</span>
                    <span>Requested Replacement (Size / Color / Variant):</span>
                  </span>
                  <p className="text-sm font-black text-neutral-900 bg-white p-3 rounded-lg border border-amber-200 break-all">
                    {parsed.replacementRequirement || "Not specified by customer"}
                  </p>
                </div>

                {/* Customer Full Note */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 block">
                    Customer Explanation &amp; Notes:
                  </span>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-xs text-neutral-800 leading-relaxed break-all whitespace-pre-wrap">
                    {parsed.customerNote || parsed.raw || "No extra note provided."}
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
                            <Image
                              src={imgUrl}
                              alt={item.name || "Product"}
                              fill
                              className="object-contain"
                              sizes="48px"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-neutral-900 text-xs">
                              {item.name}
                            </p>
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

                  <div className="flex items-center gap-2">
                    {detailModalOrder.status === "return_requested" && (
                      <>
                        <button
                          type="button"
                          disabled={handleReturnMutation.isPending}
                          onClick={() => setRejectModalOrder(detailModalOrder)}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          Reject Exchange
                        </button>
                        <button
                          type="button"
                          disabled={handleReturnMutation.isPending}
                          onClick={() => handleApprove(detailModalOrder)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          Approve Exchange
                        </button>
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

      {/* Reject Modal */}
      {rejectModalOrder && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
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
