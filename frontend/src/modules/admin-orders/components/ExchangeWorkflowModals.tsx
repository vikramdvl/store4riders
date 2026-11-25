"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  parseExchangeNote,
  findExchangeRequestNote,
  inferExchangeProgressFromNotes,
  buildWhatsAppExchangeFeeMessage,
  formatPrice,
} from "@store4riders/shared-utils";
import {
  useAdminHandleReturn,
  useAdminExchangePickup,
  useAdminExchangeQc,
  useAdminSettleExchangeFee,
  useAdminDispatchReplacement,
} from "@/core/hooks/useAdminOrders";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { useWarehouses } from "@/core/hooks/useWarehouses";
import {
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  ShieldCheckIcon,
  CurrencyRupeeIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";

export type ActiveExchangeActionModal =
  | { type: "approve"; order: any; exchangeId?: string }
  | { type: "pickup"; order: any; exchangeId?: string }
  | { type: "qc"; order: any; exchangeId?: string }
  | { type: "fee"; order: any; exchangeId?: string }
  | { type: "dispatch"; order: any; exchangeId?: string }
  | null;

export function resolveOrderExchangeState(order: any, configuredDefaultFee = 299, exchangeId?: string) {
  const exchangesList = Array.isArray(order?.exchanges) ? order.exchanges : [];
  const details =
    (exchangeId && exchangesList.find((ex: any) => ex?.exchangeId === exchangeId)) ||
    (order?.exchangeDetails && (!exchangeId || order.exchangeDetails.exchangeId === exchangeId)
      ? order.exchangeDetails
      : undefined) ||
    exchangesList[exchangesList.length - 1];
  const returnNote = findExchangeRequestNote(order?.notes);
  const parsed = parseExchangeNote(returnNote?.text);
  const inferred = inferExchangeProgressFromNotes(order?.notes, order?.status, configuredDefaultFee);

  const stage: string = details?.stage || inferred.stage;
  const feeAmount =
    typeof details?.shippingFee === "number" ? details.shippingFee : inferred.shippingFee;
  const feeStatus: string =
    details?.shippingFeeStatus || inferred.shippingFeeStatus;
  const qcStatus: string =
    details?.qcStatus || inferred.qcStatus;

  return {
    exchangeId: details?.exchangeId,
    items: Array.isArray(details?.items) ? details.items : [],
    requestedItemNames: details?.requestedItemNames || parsed.itemsList || "",
    stage,
    reasonType: details?.reasonType || parsed.reasonType,
    desiredReplacement: details?.desiredReplacement || parsed.replacementRequirement,
    customerNote: details?.customerNote || parsed.customerNote,
    rawNote: parsed.raw,
    feeAmount,
    feeStatus,
    feeCollectionMode: details?.shippingFeeCollectionMode || (feeStatus === "cod_on_replacement" ? "cod" : feeStatus === "waived" ? "waived" : "online"),
    feePaymentMethod: details?.shippingFeePaymentMethod || "",
    feePaymentRef: details?.shippingFeePaymentRef || "",
    feePaidAt: details?.shippingFeePaidAt,
    qcStatus,
    qcNotes: details?.qcNotes || inferred.qcNotes || "",
    qcChecklist: details?.qcChecklist,
    reverseAwb: details?.reverseAwb || inferred.reverseAwb || "",
    reverseCourier: details?.reverseCourier || "",
    reverseTrackingUrl: details?.reverseTrackingUrl || "",
    replacementAwb: details?.replacementAwb || inferred.replacementAwb || "",
    replacementCourier: details?.replacementCourier || "",
    replacementTrackingUrl: details?.replacementTrackingUrl || "",
    rejectionReason: details?.rejectionReason || inferred.rejectionReason || "",
  };
}

interface ExchangeWorkflowModalsProps {
  activeModal: ActiveExchangeActionModal;
  onClose: () => void;
  onActionSuccess?: (updatedOrder?: any) => void;
}

export const ExchangeWorkflowModals: React.FC<ExchangeWorkflowModalsProps> = ({
  activeModal,
  onClose,
  onActionSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: settings } = usePublicSettings();
  const { data: warehouses } = useWarehouses();
  const defaultFee = typeof settings?.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;

  const approveMutation = useAdminHandleReturn();
  const pickupMutation = useAdminExchangePickup();
  const qcMutation = useAdminExchangeQc();
  const feeMutation = useAdminSettleExchangeFee();
  const dispatchMutation = useAdminDispatchReplacement();

  // Approve modal state
  const [triggerCourier, setTriggerCourier] = useState<"none" | "shiprocket" | "delhivery" | "xpressbees" | "manual">("shiprocket");
  const [reverseWarehouseId, setReverseWarehouseId] = useState("");
  const [reverseCourier, setReverseCourier] = useState("Delhivery Reverse");
  const [reverseAwb, setReverseAwb] = useState("");
  const [reverseTrackingUrl, setReverseTrackingUrl] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [approveFee, setApproveFee] = useState<string>(String(defaultFee));

  // Pickup modal state
  const [pickupAction, setPickupAction] = useState<"schedule_reverse" | "mark_picked_up">("mark_picked_up");
  const [pickupProvider, setPickupProvider] = useState<"shiprocket" | "delhivery" | "xpressbees" | "manual">("shiprocket");

  // QC modal state
  const [qcResult, setQcResult] = useState<"passed" | "failed">("passed");
  const [tagsIntact, setTagsIntact] = useState(true);
  const [unusedCondition, setUnusedCondition] = useState(true);
  const [packagingIntact, setPackagingIntact] = useState(true);
  const [qcNotes, setQcNotes] = useState("");
  const [qcFee, setQcFee] = useState<string>(String(defaultFee));
  const [qcFeeMode, setQcFeeMode] = useState<"online" | "cod" | "waived">("online");

  // Fee modal state
  const [manualPaymentRef, setManualPaymentRef] = useState("");
  const [feeOverride, setFeeOverride] = useState<string>(String(defaultFee));
  const [feeNote, setFeeNote] = useState("");

  // Dispatch modal state
  const [dispatchProvider, setDispatchProvider] = useState<"shiprocket" | "delhivery" | "xpressbees" | "manual">("shiprocket");
  const [dispatchWarehouseId, setDispatchWarehouseId] = useState("");
  const [dispatchVariant, setDispatchVariant] = useState("");
  const [dispatchManualCourier, setDispatchManualCourier] = useState("Delhivery Surface");
  const [dispatchManualAwb, setDispatchManualAwb] = useState("");
  const [dispatchManualTrackingUrl, setDispatchManualTrackingUrl] = useState("");
  const [autoAssignAwb, setAutoAssignAwb] = useState(true);

  useEffect(() => {
    if (!activeModal) return;
    const state = resolveOrderExchangeState(activeModal.order, defaultFee, activeModal.exchangeId);
    const defWh = warehouses?.find((w: any) => w.isDefault) || warehouses?.[0];
    const resolvedWhId = activeModal.order.warehouseId || defWh?.id || String((defWh as any)?._id || "");

    if (activeModal.type === "approve") {
      setTriggerCourier("shiprocket");
      setReverseWarehouseId(resolvedWhId);
      setReverseCourier("Delhivery Reverse");
      setReverseAwb("");
      setReverseTrackingUrl("");
      setApproveNote("");
      setApproveFee(String(state.feeAmount));
    } else if (activeModal.type === "pickup") {
      setPickupAction(state.reverseAwb ? "mark_picked_up" : "schedule_reverse");
      setPickupProvider("shiprocket");
      setReverseWarehouseId(resolvedWhId);
      setReverseCourier(state.reverseCourier || "Delhivery Reverse");
      setReverseAwb(state.reverseAwb || "");
      setReverseTrackingUrl(state.reverseTrackingUrl || "");
    } else if (activeModal.type === "qc") {
      setQcResult("passed");
      setTagsIntact(true);
      setUnusedCondition(true);
      setPackagingIntact(true);
      setQcNotes("Original tags, packaging and unused condition verified at hub.");
      setQcFee(String(state.feeAmount));
      setQcFeeMode(
        state.feeStatus === "cod_on_replacement"
          ? "cod"
          : state.feeAmount <= 0 || state.feeStatus === "waived"
          ? "waived"
          : "online"
      );
    } else if (activeModal.type === "fee") {
      setManualPaymentRef("");
      setFeeOverride(String(state.feeAmount > 0 ? state.feeAmount : defaultFee));
      setFeeNote("");
    } else if (activeModal.type === "dispatch") {
      setDispatchProvider("shiprocket");
      setDispatchVariant(state.desiredReplacement || "");
      setDispatchWarehouseId(resolvedWhId);
      setDispatchManualCourier("Delhivery Surface");
      setDispatchManualAwb("");
      setDispatchManualTrackingUrl("");
      setAutoAssignAwb(true);
    }
  }, [activeModal, defaultFee, warehouses]);

  if (!mounted || typeof document === "undefined" || !activeModal) return null;

  const order = activeModal.order;
  const activeExchangeId = activeModal.exchangeId;
  const orderId = order.id || order._id;
  const orderNum = order.orderNumber || String(orderId).slice(-8).toUpperCase();
  const state = resolveOrderExchangeState(order, defaultFee, activeExchangeId);

  const handleCloseAfter = (updated?: any) => {
    onClose();
    if (onActionSuccess) onActionSuccess(updated);
  };

  const handleOpenWhatsAppFeeLink = () => {
    const rawPhone = order.shippingAddress?.phone || "";
    const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const orderUrl = `${origin}/account/orders/${encodeURIComponent(orderId)}`;
    const feeVal = Number(feeOverride) >= 0 ? Number(feeOverride) : state.feeAmount;

    const msg = buildWhatsAppExchangeFeeMessage({
      customerName: order.shippingAddress?.fullName || "Rider",
      orderNumber: orderNum,
      desiredReplacement: state.desiredReplacement,
      shippingFee: feeVal,
      orderUrl,
      upiMerchantVpa: settings?.upiMerchantVpa,
    });

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-neutral-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. APPROVE & REVERSE PICKUP MODAL */}
        {activeModal.type === "approve" && (
          <>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-neutral-900 uppercase text-base flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <span>Approve &amp; Schedule Pickup</span>
              </h3>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
              <div className="font-bold text-amber-950">Order #{orderNum}</div>
              <div className="text-neutral-700">
                <strong>Demanded:</strong> {state.desiredReplacement || "See customer note"}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                  Reverse Doorstep Pickup Carrier
                </label>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    {
                      id: "shiprocket",
                      label: "Auto-Schedule via Shiprocket Reverse",
                      desc: "Triggers Shiprocket Reverse API & assigns reverse courier",
                    },
                    {
                      id: "delhivery",
                      label: "Auto-Schedule via Delhivery Reverse (RVP)",
                      desc: "Creates Delhivery Pickup manifest directly from customer doorstep",
                    },
                    {
                      id: "xpressbees",
                      label: "Auto-Schedule via Xpressbees Reverse",
                      desc: "Creates Xpressbees RVP pickup from customer address to hub",
                    },
                    {
                      id: "manual",
                      label: "Enter Manual Reverse AWB",
                      desc: "Booked externally on carrier portal",
                    },
                    {
                      id: "none",
                      label: "Approve Only (Schedule Pickup Later)",
                      desc: "Moves status to Approved without triggering live courier job yet",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${
                        triggerCourier === opt.id
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="triggerCourier"
                        checked={triggerCourier === opt.id}
                        onChange={() => setTriggerCourier(opt.id as any)}
                        className="mt-0.5 text-brand focus:ring-brand accent-brand"
                      />
                      <div>
                        <div className="font-bold text-neutral-900">{opt.label}</div>
                        <div className="text-[11px] text-neutral-500">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {(triggerCourier === "shiprocket" || triggerCourier === "delhivery" || triggerCourier === "xpressbees") &&
                warehouses &&
                warehouses.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Exchange Destination Warehouse Hub
                    </label>
                    <select
                      value={reverseWarehouseId}
                      onChange={(e) => setReverseWarehouseId(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-lg bg-white text-xs font-semibold"
                    >
                      {warehouses.map((wh: any) => (
                        <option key={wh.id || String(wh._id)} value={wh.id || String(wh._id)}>
                          {wh.name} — {wh.city}, {wh.state} ({wh.pincode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {triggerCourier === "manual" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Reverse Courier *
                    </label>
                    <input
                      type="text"
                      value={reverseCourier}
                      onChange={(e) => setReverseCourier(e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded text-xs"
                      placeholder="Delhivery Reverse"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Reverse AWB *
                    </label>
                    <input
                      type="text"
                      value={reverseAwb}
                      onChange={(e) => setReverseAwb(e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded text-xs font-mono"
                      placeholder="e.g. REV123456789"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                    2-Way Exchange Shipping Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={approveFee}
                    onChange={(e) => setApproveFee(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                    Internal Approval Note
                  </label>
                  <input
                    type="text"
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    placeholder="e.g. Replacement XL stock confirmed"
                    className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-bold uppercase text-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  approveMutation.isPending ||
                  (triggerCourier === "manual" && (!reverseCourier.trim() || !reverseAwb.trim()))
                }
                onClick={() => {
                  approveMutation.mutate(
                    {
                      orderId,
                      ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                      action: "approve",
                      adminNote: approveNote || "Approved for gear exchange.",
                      shippingFee: approveFee !== "" ? Number(approveFee) : undefined,
                      triggerCourier,
                      warehouseId:
                        triggerCourier !== "none" && reverseWarehouseId ? reverseWarehouseId : undefined,
                      reverseCourier: triggerCourier === "manual" ? reverseCourier : undefined,
                      reverseAwb: triggerCourier === "manual" ? reverseAwb : undefined,
                      reverseTrackingUrl: triggerCourier === "manual" ? reverseTrackingUrl : undefined,
                    },
                    { onSuccess: handleCloseAfter }
                  );
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </>
        )}

        {/* 2. REVERSE PICKUP MODAL */}
        {activeModal.type === "pickup" && (
          <>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-neutral-900 uppercase text-base flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-blue-600" />
                <span>Reverse Pickup &amp; Transit</span>
              </h3>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickupAction("mark_picked_up")}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold uppercase cursor-pointer ${
                  pickupAction === "mark_picked_up"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-neutral-50 text-neutral-700 border-neutral-200"
                }`}
              >
                Mark Parcel Picked Up
              </button>
              <button
                type="button"
                onClick={() => setPickupAction("schedule_reverse")}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold uppercase cursor-pointer ${
                  pickupAction === "schedule_reverse"
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-neutral-50 text-neutral-700 border-neutral-200"
                }`}
              >
                Schedule / Trigger Reverse AWB
              </button>
            </div>

            {pickupAction === "schedule_reverse" && (
              <div className="space-y-3 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "shiprocket", label: "Shiprocket", activeClass: "bg-orange-600 text-white border-orange-600" },
                    { id: "delhivery", label: "Delhivery", activeClass: "bg-neutral-900 text-white border-neutral-900" },
                    { id: "xpressbees", label: "Xpressbees", activeClass: "bg-amber-600 text-white border-amber-600" },
                    { id: "manual", label: "Manual AWB", activeClass: "bg-neutral-800 text-white border-neutral-800" },
                  ].map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setPickupProvider(cp.id as any)}
                      className={`py-2 px-2 rounded border font-bold cursor-pointer ${
                        pickupProvider === cp.id ? cp.activeClass : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      {cp.label}
                    </button>
                  ))}
                </div>

                {pickupProvider !== "manual" && warehouses && warehouses.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Exchange Warehouse Hub
                    </label>
                    <select
                      value={reverseWarehouseId}
                      onChange={(e) => setReverseWarehouseId(e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded bg-white text-xs font-semibold"
                    >
                      {warehouses.map((wh: any) => (
                        <option key={wh.id || String(wh._id)} value={wh.id || String(wh._id)}>
                          {wh.name} — {wh.city}, {wh.state} ({wh.pincode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {pickupProvider === "manual" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={reverseCourier}
                      onChange={(e) => setReverseCourier(e.target.value)}
                      placeholder="Courier Name *"
                      className="p-2 border border-neutral-300 rounded bg-white text-xs"
                    />
                    <input
                      type="text"
                      value={reverseAwb}
                      onChange={(e) => setReverseAwb(e.target.value)}
                      placeholder="Reverse AWB *"
                      className="p-2 border border-neutral-300 rounded bg-white text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {pickupAction === "mark_picked_up" && (
              <div className="space-y-2.5 text-xs">
                <p className="text-neutral-600">
                  Confirm courier collected the old gear from <strong>{order.shippingAddress?.fullName}</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={reverseCourier}
                    onChange={(e) => setReverseCourier(e.target.value)}
                    placeholder="Reverse Courier (optional)"
                    className="p-2.5 border border-neutral-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={reverseAwb}
                    onChange={(e) => setReverseAwb(e.target.value)}
                    placeholder="Reverse AWB (optional)"
                    className="p-2.5 border border-neutral-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-bold uppercase text-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  pickupMutation.isPending ||
                  (pickupAction === "schedule_reverse" && pickupProvider === "manual" && (!reverseCourier.trim() || !reverseAwb.trim()))
                }
                onClick={() => {
                  pickupMutation.mutate(
                    {
                      orderId,
                      ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                      action: pickupAction,
                      provider: pickupAction === "schedule_reverse" ? pickupProvider : undefined,
                      warehouseId:
                        pickupAction === "schedule_reverse" && pickupProvider !== "manual" && reverseWarehouseId
                          ? reverseWarehouseId
                          : undefined,
                      reverseCourier: reverseCourier.trim() || undefined,
                      reverseAwb: reverseAwb.trim() || undefined,
                      reverseTrackingUrl: reverseTrackingUrl.trim() || undefined,
                    },
                    { onSuccess: handleCloseAfter }
                  );
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
              >
                {pickupMutation.isPending ? "Saving..." : pickupAction === "mark_picked_up" ? "Mark Picked Up" : "Trigger Reverse Pickup"}
              </button>
            </div>
          </>
        )}

        {/* 3. WAREHOUSE QC INSPECTION MODAL */}
        {activeModal.type === "qc" && (
          <>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-neutral-900 uppercase text-base flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-indigo-600" />
                <span>Warehouse Quality Check (QC)</span>
              </h3>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Mandatory Inspection Checklist (Order #{orderNum})
              </span>
              {[
                { label: "Original brand tags, labels & CE armor inserts intact", val: tagsIntact, set: setTagsIntact },
                { label: "Gear is 100% unused, unworn, clean & odour-free", val: unusedCondition, set: setUnusedCondition },
                { label: "Original branded box & helmet visor peel intact", val: packagingIntact, set: setPackagingIntact },
              ].map((chk, idx) => (
                <label key={idx} className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={chk.val}
                    onChange={(e) => chk.set(e.target.checked)}
                    className="w-4 h-4 text-brand rounded accent-brand"
                  />
                  <span className="font-medium text-neutral-800">{chk.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setQcResult("passed");
                  if (qcNotes.includes("failed")) {
                    setQcNotes("Original tags, packaging and unused condition verified at hub.");
                  }
                }}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                  qcResult === "passed"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-neutral-700 border-neutral-300"
                }`}
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>QC Passed</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQcResult("failed");
                  if (qcNotes.includes("verified")) {
                    setQcNotes("");
                  }
                }}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                  qcResult === "failed"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-neutral-700 border-neutral-300"
                }`}
              >
                <XCircleIcon className="w-4 h-4" />
                <span>QC Failed</span>
              </button>
            </div>

            {qcResult === "passed" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1.5">
                    Customer Shipping Fee Mode (Shown Directly to Customer on Website)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      {
                        id: "online",
                        title: "Pay Online Abhi",
                        desc: "Customer pays via PayU / UPI on My Orders",
                        activeClass: "bg-brand text-white border-brand",
                      },
                      {
                        id: "cod",
                        title: `COD ₹${qcFee || state.feeAmount}`,
                        desc: "Courier collects COD when replacement delivers",
                        activeClass: "bg-blue-600 text-white border-blue-600",
                      },
                      {
                        id: "waived",
                        title: "Waive Fee (₹0)",
                        desc: "Free replacement dispatch",
                        activeClass: "bg-neutral-900 text-white border-neutral-900",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setQcFeeMode(opt.id as any);
                          if (opt.id === "waived") {
                            setQcFee("0");
                          } else if (Number(qcFee) <= 0) {
                            setQcFee(String(defaultFee));
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          qcFeeMode === opt.id
                            ? opt.activeClass
                            : "bg-neutral-50 text-neutral-800 border-neutral-200 hover:border-neutral-400"
                        }`}
                      >
                        <div className="font-bold text-xs">{opt.title}</div>
                        <div className={`text-[10px] mt-0.5 ${qcFeeMode === opt.id ? "text-white/90" : "text-neutral-500"}`}>
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {qcFeeMode !== "waived" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      2-Way Shipping Fee Amount (₹)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qcFee}
                      onChange={(e) => setQcFee(e.target.value)}
                      className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-bold"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                QC Inspection Notes *
              </label>
              <textarea
                rows={3}
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder={
                  qcResult === "passed"
                    ? "Verified unused gear, tags intact..."
                    : "Explain exact defect / missing tags / scratch reason..."
                }
                className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-bold uppercase text-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={qcMutation.isPending || qcNotes.trim().length < 2}
                onClick={() => {
                  qcMutation.mutate(
                    {
                      orderId,
                      ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                      result: qcResult,
                      tagsIntact,
                      unusedCondition,
                      packagingIntact,
                      qcNotes: qcNotes.trim(),
                      shippingFee:
                        qcResult === "passed"
                          ? qcFeeMode === "waived"
                            ? 0
                            : qcFee !== ""
                            ? Number(qcFee)
                            : undefined
                          : undefined,
                      feeCollectionMode: qcResult === "passed" ? qcFeeMode : undefined,
                    },
                    { onSuccess: handleCloseAfter }
                  );
                }}
                className={`px-5 py-2 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer ${
                  qcResult === "passed" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {qcMutation.isPending ? "Saving..." : qcResult === "passed" ? "Confirm QC Passed" : "Confirm QC Failed"}
              </button>
            </div>
          </>
        )}

        {/* 4. HYBRID SHIPPING FEE SETTLEMENT MODAL */}
        {activeModal.type === "fee" && (
          <>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-neutral-900 uppercase text-base flex items-center gap-2">
                <CurrencyRupeeIcon className="w-5 h-5 text-amber-600" />
                <span>Collect Exchange Shipping Fee</span>
              </h3>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs flex items-center justify-between">
              <div>
                <div className="font-bold text-amber-950">Order #{orderNum}</div>
                <div className="text-amber-800">
                  Current Fee Status:{" "}
                  <strong className="uppercase">{state.feeStatus.replace(/_/g, " ")}</strong>
                </div>
              </div>
              <div className="w-28">
                <label className="text-[10px] font-bold uppercase text-amber-900 block mb-0.5">
                  Fee (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={feeOverride}
                  onChange={(e) => setFeeOverride(e.target.value)}
                  className="w-full p-1.5 border border-amber-300 rounded bg-white text-xs font-black text-neutral-900"
                />
              </div>
            </div>

            {/* Already Paid Receipt Banner OR Live Customer Mode Switcher */}
            {state.feeStatus === "paid_online" ? (
              <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-4 space-y-1.5 text-xs">
                <div className="font-black text-emerald-900 uppercase flex items-center gap-1.5">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                  <span>Paid Online by Customer ({state.feePaymentMethod?.toUpperCase() || "GATEWAY"})</span>
                </div>
                <p className="text-emerald-800">
                  Amount: <strong>{formatPrice(state.feeAmount)}</strong>
                  {state.feePaymentRef ? ` • Ref: ${state.feePaymentRef}` : ""}
                </p>
                <p className="text-[11px] text-emerald-700">
                  Payment is verified &amp; captured. You can dispatch replacement now.
                </p>
              </div>
            ) : (
              <>
                {/* Hybrid Option 1: Customer Online Pay via PayU / UPI on Website + WhatsApp */}
                <div className="border border-emerald-200 bg-emerald-50/70 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-700" />
                      <span>Option 1: Online Pay via PayU / UPI (Customer Portal)</span>
                    </div>
                    {state.feeStatus === "pending" && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Active on Customer Site
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-900">
                    Sets customer portal to &ldquo;Pay ₹{feeOverride || state.feeAmount} Online (PayU / UPI)&rdquo; and optionally shares link on WhatsApp.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={feeMutation.isPending || Number(feeOverride || state.feeAmount) <= 0}
                      onClick={() => {
                        feeMutation.mutate(
                          {
                            orderId,
                            ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                            settlementMode: "online_pending",
                            shippingFee: feeOverride !== "" ? Number(feeOverride) : undefined,
                          },
                          { onSuccess: handleCloseAfter }
                        );
                      }}
                      className="flex-1 py-2 px-3 bg-brand hover:bg-red-800 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
                    >
                      {state.feeStatus === "pending"
                        ? `Update Online Fee (₹${feeOverride || state.feeAmount})`
                        : `Enable Customer Online Pay (₹${feeOverride || state.feeAmount})`}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenWhatsAppFeeLink}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ChatBubbleLeftRightIcon className="w-4 h-4" />
                      <span>Send WhatsApp Link</span>
                    </button>
                  </div>
                </div>

                {/* Hybrid Option 2: Mark Paid Manually (UPI / Bank) */}
                <div className="border border-neutral-200 bg-neutral-50 rounded-xl p-3.5 space-y-2.5">
                  <div className="text-xs font-bold text-neutral-900">
                    Option 2: Mark Paid Manually (Customer sent UPI Screenshot / UTR)
                  </div>
                  <input
                    type="text"
                    value={manualPaymentRef}
                    onChange={(e) => setManualPaymentRef(e.target.value)}
                    placeholder="Enter UPI Ref / UTR / Txn ID *"
                    className="w-full p-2 border border-neutral-300 rounded-lg bg-white text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={feeMutation.isPending || !manualPaymentRef.trim()}
                    onClick={() => {
                      feeMutation.mutate(
                        {
                          orderId,
                          ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                          settlementMode: "paid_manual",
                          paymentRef: manualPaymentRef.trim(),
                          shippingFee: feeOverride !== "" ? Number(feeOverride) : undefined,
                          note: feeNote.trim() || undefined,
                        },
                        { onSuccess: handleCloseAfter }
                      );
                    }}
                    className="w-full py-2 bg-neutral-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
                  >
                    Mark Paid Manually (Verified)
                  </button>
                </div>

                {/* Hybrid Option 3: Dispatch as COD ₹299 */}
                <div className="border border-blue-200 bg-blue-50/70 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-blue-950">
                      Option 3: Cash on Delivery ₹{feeOverride || state.feeAmount} on Replacement
                    </div>
                    {state.feeStatus === "cod_on_replacement" && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-200 text-blue-950">
                        Active on Customer Site
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-blue-900">
                    Customer portal shows &ldquo;Cash on Delivery ₹{feeOverride || state.feeAmount}&rdquo; and courier collects only ₹{feeOverride || state.feeAmount} on delivery.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={feeMutation.isPending || Number(feeOverride || state.feeAmount) <= 0}
                      onClick={() => {
                        feeMutation.mutate(
                          {
                            orderId,
                            ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                            settlementMode: "cod_on_replacement",
                            shippingFee: feeOverride !== "" ? Number(feeOverride) : undefined,
                          },
                          { onSuccess: handleCloseAfter }
                        );
                      }}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
                    >
                      Set COD ₹{feeOverride || state.feeAmount} on Replacement
                    </button>
                    <button
                      type="button"
                      disabled={feeMutation.isPending}
                      onClick={() => {
                        feeMutation.mutate(
                          {
                            orderId,
                            ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                            settlementMode: "waived",
                            note: "Shipping fee waived by admin",
                          },
                          { onSuccess: handleCloseAfter }
                        );
                      }}
                      className="px-3 py-2 border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 rounded-lg text-xs font-bold uppercase cursor-pointer"
                    >
                      Waive (₹0)
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* 5. DISPATCH REPLACEMENT PRODUCT MODAL */}
        {activeModal.type === "dispatch" && (
          <>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-neutral-900 uppercase text-base flex items-center gap-2">
                <PaperAirplaneIcon className="w-5 h-5 text-emerald-600" />
                <span>Dispatch Replacement Product</span>
              </h3>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                ✕
              </button>
            </div>

            {/* Fee Verification Banner */}
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              state.feeStatus === "cod_on_replacement"
                ? "bg-blue-50 border-blue-200 text-blue-950"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}>
              <span className="font-bold">
                {state.feeStatus === "cod_on_replacement"
                  ? `COD Collection Mode: Courier will collect ${formatPrice(state.feeAmount)}`
                  : `Fee Settled (${state.feeStatus.replace(/_/g, " ")}) — Dispatch Prepaid (₹0)`}
              </span>
              <span className="font-black uppercase text-[10px] px-2 py-0.5 rounded bg-white border">
                {state.feeStatus === "cod_on_replacement" ? `COD ₹${state.feeAmount}` : "PREPAID"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                  Demanded Replacement Size / Color / SKU
                </label>
                <input
                  type="text"
                  value={dispatchVariant}
                  onChange={(e) => setDispatchVariant(e.target.value)}
                  placeholder="e.g. Size XL Matte Black"
                  className="w-full p-2.5 border border-neutral-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                  Dispatch Courier Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "shiprocket", label: "Shiprocket" },
                    { id: "delhivery", label: "Delhivery" },
                    { id: "xpressbees", label: "Xpressbees" },
                    { id: "manual", label: "Manual AWB" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDispatchProvider(p.id as any)}
                      className={`py-2 px-2 rounded-lg border font-bold text-xs cursor-pointer ${
                        dispatchProvider === p.id
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {dispatchProvider !== "manual" && warehouses && warehouses.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                    Dispatch Warehouse Hub
                  </label>
                  <select
                    value={dispatchWarehouseId}
                    onChange={(e) => setDispatchWarehouseId(e.target.value)}
                    className="w-full p-2.5 border border-neutral-300 rounded-lg bg-white text-xs font-semibold"
                  >
                    {warehouses.map((wh: any) => (
                      <option key={wh.id || String(wh._id)} value={wh.id || String(wh._id)}>
                        {wh.name} — {wh.city}, {wh.state} ({wh.pincode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dispatchProvider === "shiprocket" && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={autoAssignAwb}
                    onChange={(e) => setAutoAssignAwb(e.target.checked)}
                    className="w-4 h-4 text-brand rounded accent-brand"
                  />
                  <span>Auto-assign fastest courier &amp; generate AWB immediately in Shiprocket</span>
                </label>
              )}

              {dispatchProvider === "manual" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Courier Partner *
                    </label>
                    <input
                      type="text"
                      value={dispatchManualCourier}
                      onChange={(e) => setDispatchManualCourier(e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded bg-white text-xs"
                      placeholder="Delhivery / BlueDart"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Replacement AWB *
                    </label>
                    <input
                      type="text"
                      value={dispatchManualAwb}
                      onChange={(e) => setDispatchManualAwb(e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded bg-white text-xs font-mono"
                      placeholder="AWB123456789"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      Tracking URL (optional)
                    </label>
                    <input
                      type="text"
                      value={dispatchManualTrackingUrl}
                      onChange={(e) => setDispatchManualTrackingUrl(e.target.value)}
                      className="w-full p-2 border border-neutral-300 rounded bg-white text-xs"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-bold uppercase text-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  dispatchMutation.isPending ||
                  (dispatchProvider === "manual" && (!dispatchManualCourier.trim() || !dispatchManualAwb.trim()))
                }
                onClick={() => {
                  dispatchMutation.mutate(
                    {
                      orderId,
                      ...(activeExchangeId ? { exchangeId: activeExchangeId } : {}),
                      provider: dispatchProvider,
                      warehouseId: dispatchWarehouseId || undefined,
                      replacementVariant: dispatchVariant.trim() || undefined,
                      courierName: dispatchProvider === "manual" ? dispatchManualCourier.trim() : undefined,
                      awb: dispatchProvider === "manual" ? dispatchManualAwb.trim() : undefined,
                      trackingUrl: dispatchProvider === "manual" ? dispatchManualTrackingUrl.trim() || undefined : undefined,
                      autoAssignAwb,
                    },
                    { onSuccess: handleCloseAfter }
                  );
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
              >
                {dispatchMutation.isPending ? "Dispatching..." : "Dispatch Replacement"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
