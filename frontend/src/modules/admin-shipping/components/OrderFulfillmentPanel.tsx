"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { 
  XMarkIcon, 
  TruckIcon, 
  DocumentTextIcon, 
  MapPinIcon, 
  CheckCircleIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  PrinterIcon,
  BuildingStorefrontIcon,
  ScaleIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  CheckIcon
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  formatPrice,
  estimateOrderPackageDimensions,
  calculateVolumetricWeight,
  calculateChargeableWeight,
  type IEstimatedPackageResult,
  type IPackageSpecInputItem,
} from "@store4riders/shared-utils";
import { useAdminOrderById } from "@/core/hooks/useOrderById";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { useWarehouses, useSyncShiprocketWarehouses } from "@/core/hooks/useWarehouses";
import { usePushToShiprocket, useCreateDirectShipment } from "@/core/hooks/useAdminShipments";
import { ShippingLabelModal } from "./ShippingLabelModal";
import { AdminTrackingModal } from "./AdminTrackingModal";

interface OrderFulfillmentPanelProps {
  orderId: string;
  onClose: () => void;
}

type CourierOption = {
  id: string;
  name: string;
  badge: string;
  prefix: string;
  color: string;
};

const COURIER_PARTNERS: CourierOption[] = [
  {
    id: "shiprocket",
    name: "Shiprocket",
    badge: "Aggregator (Default)",
    prefix: "SR",
    color: "border-orange-500 bg-orange-50/50 text-orange-950",
  },
  {
    id: "xpressbees",
    name: "Xpressbees",
    badge: "Express Surface & Air",
    prefix: "XPR",
    color: "border-purple-500 bg-purple-50/50 text-purple-950",
  },
  {
    id: "delhivery",
    name: "Delhivery",
    badge: "Direct Surface / Air",
    prefix: "DLV",
    color: "border-slate-700 bg-slate-50 text-slate-900",
  },
];

export const OrderFulfillmentPanel: React.FC<OrderFulfillmentPanelProps> = ({ orderId, onClose }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: order, isLoading: isOrderLoading } = useAdminOrderById(orderId);
  const { data: publicSettings } = usePublicSettings();
  const { data: warehouses = [], isLoading: isWarehousesLoading } = useWarehouses();
  const directShipmentMutation = useCreateDirectShipment();
  const pushToShiprocketMutation = usePushToShiprocket();
  const syncShiprocketMutation = useSyncShiprocketWarehouses();

  const [selectedCourierId, setSelectedCourierId] = useState<string>("shiprocket");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [packageWeight, setPackageWeight] = useState<string>("1.0");
  const [dimensions, setDimensions] = useState({ length: 15, breadth: 15, height: 10 });
  const [isAutoDimensions, setIsAutoDimensions] = useState<boolean>(false);
  const [hasUserEditedPackage, setHasUserEditedPackage] = useState<boolean>(false);
  const [packageEstimate, setPackageEstimate] = useState<IEstimatedPackageResult | null>(null);
  const [autoAssignAwb, setAutoAssignAwb] = useState<boolean>(false);
  const [createdShipment, setCreatedShipment] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState<boolean>(false);
  const [showTrackingModal, setShowTrackingModal] = useState<boolean>(false);
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState<boolean>(false);
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState<string>("");
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  // Sync recipient phone from order once loaded
  useEffect(() => {
    if (order?.shippingAddress?.phone && !recipientPhone) {
      const cleaned = (order.shippingAddress.phone || "").replace(/\D/g, "").slice(-10);
      setRecipientPhone(cleaned);
    }
  }, [order?.shippingAddress?.phone]);

  // Close warehouse dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
    }
    if (isWarehouseDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isWarehouseDropdownOpen]);

  // Close warehouse dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isWarehouseDropdownOpen) {
        setIsWarehouseDropdownOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWarehouseDropdownOpen]);

  // Auto-select warehouse when loaded
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && !selectedWarehouseId) {
      const matchOrder = warehouses.find((w: any) => String(w._id || w.id) === String(order?.warehouseId));
      if (matchOrder) {
        setSelectedWarehouseId(String(matchOrder._id || matchOrder.id));
      } else {
        const defaultWh = warehouses.find((w: any) => w.isDefault) || warehouses[0];
        if (defaultWh) {
          setSelectedWarehouseId(String(defaultWh._id || defaultWh.id));
        }
      }
    }
  }, [warehouses, order?.warehouseId, selectedWarehouseId]);

  // Pre-calculate weight & smart package box dimensions from order items and warehouse presets
  useEffect(() => {
    if (order?.items && order.items.length > 0) {
      const specItems: IPackageSpecInputItem[] = order.items.map((item: any) => {
        const prod = item.product || {};
        const variant = (prod.variants || []).find(
          (v: any) => v.id === item.variantId || v.sku === item.sku
        );
        return {
          sku: item.sku,
          quantity: item.quantity || 1,
          weight: Number(item.weight) > 0 ? Number(item.weight) : Number(variant?.weight) > 0 ? Number(variant.weight) : Number(prod.weight) > 0 ? Number(prod.weight) : undefined,
          weightUnit: item.weightUnit || variant?.weightUnit || prod.weightUnit || "kg",
          length: Number(item.length) > 0 ? Number(item.length) : Number(variant?.length) > 0 ? Number(variant.length) : Number(prod.length) > 0 ? Number(prod.length) : undefined,
          breadth: Number(item.breadth || item.width) > 0 ? Number(item.breadth || item.width) : Number(variant?.breadth) > 0 ? Number(variant.breadth) : Number(prod.breadth) > 0 ? Number(prod.breadth) : undefined,
          height: Number(item.height) > 0 ? Number(item.height) : Number(variant?.height) > 0 ? Number(variant.height) : Number(prod.height) > 0 ? Number(prod.height) : undefined,
          dimensionUnit: item.dimensionUnit || variant?.dimensionUnit || prod.dimensionUnit || "cm",
        };
      });

      const estimated = estimateOrderPackageDimensions(specItems, publicSettings?.packagePresets);
      setPackageEstimate(estimated);

      if (!hasUserEditedPackage) {
        const estWeight = Math.max(0.1, estimated.weight);
        setPackageWeight(String(estWeight));
        setIsAutoDimensions(estimated.hasProductDimensions);
        setDimensions({
          length: estimated.length,
          breadth: estimated.breadth,
          height: estimated.height,
        });
      }
    }
  }, [order?.items, publicSettings?.packagePresets, hasUserEditedPackage]);

  const selectedCourier = COURIER_PARTNERS.find((c) => c.id === selectedCourierId) || COURIER_PARTNERS[0];

  const numWeight = parseFloat(packageWeight) || 0.5;
  const numLength = Number(dimensions.length) || 15;
  const numBreadth = Number(dimensions.breadth) || 15;
  const numHeight = Number(dimensions.height) || 10;
  const volumetricWeight = Number(calculateVolumetricWeight(numLength, numBreadth, numHeight).toFixed(2));
  const billableWeight = Number(calculateChargeableWeight(numWeight, volumetricWeight).toFixed(2));

  const handlePushToShiprocket = () => {
    setErrorMessage(null);
    const weightVal = parseFloat(packageWeight);
    if (isNaN(weightVal) || weightVal <= 0) {
      const msg = "Please enter a valid package weight (e.g. 0.5 kg).";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const cleanPhone = (recipientPhone || order?.shippingAddress?.phone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      const msg = "Customer mobile number is required by Shiprocket. Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (/^(\d)\1{9}$/.test(cleanPhone) || cleanPhone === "1234567890" || cleanPhone === "0123456789") {
      const msg = `Mobile number '${cleanPhone}' is a dummy/repeating number. Shiprocket strictly rejects dummy numbers. Please enter the customer's real mobile number above.`;
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    pushToShiprocketMutation.mutate(
      {
        orderId,
        warehouseId: selectedWarehouseId || undefined,
        weightKg: weightVal,
        length: numLength,
        breadth: numBreadth,
        height: numHeight,
        autoAssignAwb,
        recipientPhone: cleanPhone,
      },
      {
        onSuccess: (data: any) => {
          setCreatedShipment({
            ...data,
            courierName: data?.courierName || (data?.awb ? "Shiprocket" : "Shiprocket Dashboard"),
            provider: "shiprocket",
            awb: data?.awb || null,
            labelUrl: data?.labelUrl || null,
            packedAt: new Date().toISOString(),
          });
          toast.success(
            data?.awb
              ? `AWB ${data.awb} generated and order dispatched via Shiprocket!`
              : "Order sent to Shiprocket Dashboard successfully!"
          );
        },
        onError: (err: any) => {
          const res = err.response?.data;
          const msg = res?.error || res?.message || (typeof res === "string" ? res : null) || err.message || "Failed to dispatch via Shiprocket";
          setErrorMessage(msg);
          toast.error(msg);
        },
      }
    );
  };

  const handleDirectDispatch = () => {
    setErrorMessage(null);
    const weightVal = parseFloat(packageWeight);
    if (isNaN(weightVal) || weightVal <= 0) {
      const msg = "Please enter a valid package weight (e.g. 0.5 kg).";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!selectedWarehouseId) {
      const msg = "Please select a pickup warehouse location.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const cleanPhone = (recipientPhone || order?.shippingAddress?.phone || "").replace(/\D/g, "").slice(-10);
    directShipmentMutation.mutate(
      {
        orderId,
        provider: selectedCourierId as "delhivery" | "xpressbees",
        warehouseId: selectedWarehouseId,
        weightKg: weightVal,
        length: numLength,
        breadth: numBreadth,
        height: numHeight,
        recipientPhone: cleanPhone || undefined,
      },
      {
        onSuccess: (data: any) => {
          setCreatedShipment({
            ...data,
            courierName: data?.courierName || selectedCourier.name,
            provider: selectedCourierId,
            awb: data?.awb || null,
            labelUrl: data?.labelUrl || null,
            packedAt: new Date().toISOString(),
          });
          toast.success(
            data?.awb
              ? `AWB ${data.awb} generated and dispatched via ${selectedCourier.name}!`
              : `Order dispatched via ${selectedCourier.name}!`
          );
        },
        onError: (err: any) => {
          const res = err.response?.data;
          const msg = res?.error || res?.message || err.message || `Failed to dispatch via ${selectedCourier.name}`;
          setErrorMessage(msg);
          toast.error(msg);
        },
      }
    );
  };

  const orderNum = order?.orderNumber || orderId;
  const isCod = order?.paymentMethod?.toLowerCase() === "cod";
  const isPaymentFailed = order?.status === "failed";
  const isPendingPayment = order?.status === "pending_payment";
  const isCancelled = order?.status === "cancelled";
  const isUnsettled = isPaymentFailed || isPendingPayment || isCancelled;

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <TruckIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pack &amp; Dispatch Order #{orderNum}
              </h2>
              <p className="text-xs text-slate-500">
                Assign pickup warehouse, package dimensions, and courier partner for dispatch
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {isOrderLoading ? (
            <div className="space-y-4 py-8">
              <div className="h-20 bg-slate-100 w-full rounded-xl animate-pulse" />
              <div className="h-32 bg-slate-100 w-full rounded-xl animate-pulse" />
            </div>
          ) : !order ? (
            <div className="text-red-500 text-center py-10 font-bold">Order not found.</div>
          ) : createdShipment ? (
            /* SUCCESS VIEW */
            <div className="flex flex-col items-center text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {createdShipment.awb
                    ? "Order Dispatched & AWB Assigned!"
                    : "Order Sent to Shiprocket Dashboard!"}
                </h3>
                <p className="text-slate-500 mt-1 text-xs max-w-sm mx-auto">
                  {createdShipment.awb
                    ? `Package registered at ${format(new Date(createdShipment.packedAt || Date.now()), "dd MMM, hh:mm a")}. Handover scheduled via ${createdShipment.courierName || "Courier Partner"}.`
                    : `Order created in your Shiprocket account (Shipment ID: #${createdShipment.providerShipmentId || createdShipment.shipmentId}). You can now open Shiprocket Dashboard, verify specs, and manually select your courier partner.`}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 w-full text-left rounded-xl space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Courier Status</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{createdShipment.courierName || (createdShipment.awb ? "Shiprocket" : "Manual Courier Selection")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {createdShipment.awb ? "Tracking AWB" : "Shiprocket Shipment ID"}
                    </span>
                    <p className="font-mono text-sm font-bold text-brand mt-0.5">
                      {createdShipment.awb || `#${createdShipment.providerShipmentId || createdShipment.shipmentId}`}
                    </p>
                  </div>
                </div>

                {createdShipment.awb && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-start">
                    <button
                      type="button"
                      onClick={() => setShowTrackingModal(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <TruckIcon className="w-4 h-4 text-blue-600" />
                      <span>View Live Status in Modal</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
                {createdShipment.awb ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (createdShipment.labelUrl) {
                        window.open(createdShipment.labelUrl, "_blank");
                      } else {
                        setShowLabelModal(true);
                      }
                    }}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-brand text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    <span>Print 4×6″ Shipping Label</span>
                  </button>
                ) : (
                  <a
                    href="https://app.shiprocket.in/orders"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <TruckIcon className="w-4 h-4" />
                    <span>Open Shiprocket Dashboard ↗</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors border border-slate-200 cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </div>
            </div>
          ) : (
            /* CLEAN FULFILLMENT FORM */
            <>
              {/* Warning if payment is unsettled */}
              {isUnsettled && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-red-900">
                    <span>⚠️ Payment Not Verified</span>
                  </div>
                  <p>
                    {isPaymentFailed
                      ? "The payment transaction for this order failed. Do not pack or dispatch this order."
                      : "Payment is pending at the gateway. Wait until funds are confirmed before dispatching."}
                  </p>
                </div>
              )}

              {/* Order Destination & Items Summary */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">Customer Destination</span>
                      {order.shippingAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            const fullAddr = [
                              order.shippingAddress?.fullName,
                              order.shippingAddress?.phone ? `Phone: ${order.shippingAddress.phone}` : null,
                              [order.shippingAddress?.addressLine1, order.shippingAddress?.addressLine2 || order.shippingAddress?.street].filter(Boolean).join(", "),
                              `${order.shippingAddress?.city}, ${order.shippingAddress?.state} - ${order.shippingAddress?.pincode}`,
                              order.shippingAddress?.country || "India"
                            ].filter(Boolean).join("\n");
                            navigator.clipboard.writeText(fullAddr);
                            toast.success("Full address copied to clipboard!");
                          }}
                          className="text-[10px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 font-semibold"
                          title="Copy full address"
                        >
                          <ClipboardDocumentIcon className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      )}
                    </div>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {order.shippingAddress?.fullName}
                    </span>
                    {(order.shippingAddress?.addressLine1 || order.shippingAddress?.street) && (
                      <span className="text-slate-700 block mt-0.5 font-medium leading-relaxed">
                        {[order.shippingAddress?.addressLine1, order.shippingAddress?.addressLine2 || order.shippingAddress?.street].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <span className="text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                      <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {order.shippingAddress?.city}, {order.shippingAddress?.state} ({order.shippingAddress?.pincode})
                    </span>

                    {/* Recipient Phone with inline editor so test/dummy numbers can be fixed */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold block">
                          Recipient Mobile (Shiprocket / Courier SMS)
                        </label>
                        {recipientPhone && (/^(\d)\1{9}$/.test(recipientPhone) || recipientPhone === "1234567890") && (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Dummy Number
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1.5 bg-slate-200 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-700">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="10-digit mobile number"
                          className={`flex-1 px-3 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 ${
                            recipientPhone && (/^(\d)\1{9}$/.test(recipientPhone) || !/^[6-9]\d{9}$/.test(recipientPhone))
                              ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500 bg-amber-50/30"
                              : "border-slate-300 focus:border-brand focus:ring-brand"
                          }`}
                        />
                      </div>
                      {recipientPhone && !/^[6-9]\d{9}$/.test(recipientPhone) && (
                        <p className="text-[10px] text-amber-700 font-semibold mt-1">
                          ⚠️ Shiprocket requires a valid 10-digit Indian number starting with 6, 7, 8, or 9.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Payment &amp; Amount</span>
                    <div className="mt-1 flex flex-col gap-1">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {formatPrice(order.pricing?.total || 0)}
                      </span>
                      {isCod ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 w-fit">
                          COD • Collect {formatPrice(order.pricing?.codAmountToCollect || order.pricing?.total || 0)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 w-fit">
                          PREPAID (Paid in Full)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(() => {
                  const totalUnits = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
                  const distinctCount = order.items?.length || 0;

                  return (
                    <div className="pt-2.5 border-t border-slate-200/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">
                          Items to Pack &amp; Inspect
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] font-mono shadow-xs">
                            {totalUnits} {totalUnits === 1 ? "Unit" : "Units Total"}
                          </span>
                          {distinctCount > 1 && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              ({distinctCount} Products)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {order.items?.map((item: any, idx: number) => {
                          const imgUrl = item.image || item.product?.images?.[0]?.url || item.product?.image || "/no-image.svg";
                          const qty = item.quantity || 1;

                          return (
                            <div 
                              key={item.productId + (item.variantId || "") + idx}
                              className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="relative w-10 h-10 bg-slate-50 border border-slate-200 rounded-md shrink-0 overflow-hidden p-0.5">
                                  <Image
                                    src={imgUrl}
                                    alt={item.name || "Product"}
                                    fill
                                    className="object-contain"
                                    sizes="40px"
                                  />
                                  <div className="absolute top-0.5 left-0.5 bg-slate-900/90 text-white font-mono font-bold text-[8px] px-1 rounded">
                                    #{idx + 1}
                                  </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-slate-900 text-xs truncate block" title={item.name}>
                                    {item.name}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-mono mt-0.5">
                                    <span>SKU: {item.sku || "N/A"}</span>
                                    {item.variantId && <span>• {item.variantId}</span>}
                                    {Number(item.weight) > 0 && (
                                      <span className="text-slate-700 font-semibold">
                                        • {item.weight} {item.weightUnit || "kg"}
                                      </span>
                                    )}
                                    {Number(item.length) > 0 && Number(item.breadth) > 0 && Number(item.height) > 0 ? (
                                      <span className="text-emerald-700 font-semibold">
                                        • {item.length}×{item.breadth}×{item.height} {item.dimensionUnit || "cm"}
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-sans font-semibold">
                                        • L×B×H missing
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center">
                                <span className="px-2 py-1 rounded bg-amber-500 text-white font-black text-xs font-mono shadow-xs">
                                  {qty} {qty === 1 ? "PC" : "PCS"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Step 1: Select Courier Partner */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  1. Select Courier Partner
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {COURIER_PARTNERS.map((courier) => {
                    const isSelected = selectedCourierId === courier.id;
                    return (
                      <button
                        key={courier.id}
                        type="button"
                        onClick={() => setSelectedCourierId(courier.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? `${courier.color} ring-2 ring-brand font-bold shadow-sm`
                            : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-black">{courier.name}</div>
                          <div className="text-[10px] opacity-75 mt-0.5 leading-tight">{courier.badge}</div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-black uppercase text-brand mt-2 block">✓ Selected</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Pickup Warehouse & Packaging Specifications */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <BuildingStorefrontIcon className="w-4 h-4 text-brand" />
                    <span>2. Pickup Warehouse &amp; Packaging Specs</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">Configured for Shiprocket &amp; Logistics</span>
                </div>

                {/* Warehouse Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <span>Pickup Warehouse Location <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        syncShiprocketMutation.mutate(undefined, {
                          onSuccess: (res: any) => {
                            toast.success(res?.message || "Shiprocket warehouse addresses imported successfully!");
                          },
                          onError: (err: any) => {
                            toast.error(err.response?.data?.message || err.message || "Failed to import from Shiprocket");
                          }
                        });
                      }}
                      disabled={syncShiprocketMutation.isPending}
                      className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 py-0.5 px-2 rounded hover:bg-orange-50 border border-orange-200 transition-colors cursor-pointer"
                    >
                      <ArrowPathIcon className={`w-3 h-3 ${syncShiprocketMutation.isPending ? "animate-spin" : ""}`} />
                      <span>{syncShiprocketMutation.isPending ? "Importing..." : "Sync Shiprocket Warehouses"}</span>
                    </button>
                  </div>
                  {isWarehousesLoading ? (
                    <div className="h-9 bg-slate-200 animate-pulse rounded-lg" />
                  ) : warehouses.length === 0 ? (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                      <p className="font-medium">No pickup warehouses found on the website.</p>
                      <button
                        type="button"
                        onClick={() => syncShiprocketMutation.mutate(undefined, {
                          onSuccess: () => toast.success("Shiprocket warehouse addresses imported!"),
                          onError: (err: any) => toast.error(err.response?.data?.message || err.message)
                        })}
                        disabled={syncShiprocketMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${syncShiprocketMutation.isPending ? "animate-spin" : ""}`} />
                        <span>{syncShiprocketMutation.isPending ? "Importing..." : "Import Warehouses from Shiprocket"}</span>
                      </button>
                    </div>
                  ) : (
                    <div ref={warehouseDropdownRef} className="relative w-full">
                      {/* Trigger Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen);
                          if (!isWarehouseDropdownOpen) setWarehouseSearchQuery("");
                        }}
                        className={`w-full px-3 py-2 border rounded-xl text-left bg-white shadow-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isWarehouseDropdownOpen
                            ? "border-brand ring-2 ring-brand/10"
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        {(() => {
                          const activeWh = warehouses.find((w: any) => String(w._id || w.id) === selectedWarehouseId);
                          if (!activeWh) {
                            return <span className="text-xs text-slate-500 font-medium">Select a pickup warehouse...</span>;
                          }
                          return (
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {activeWh.name}
                                </span>
                                {activeWh.isDefault && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                                    Default
                                  </span>
                                )}
                                {activeWh.shiprocketLocationId && (
                                  <span className="font-mono text-[9px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded truncate max-w-[140px]">
                                    SR: {activeWh.shiprocketLocationId}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 truncate mt-0.5">
                                {activeWh.city}, {activeWh.state} ({activeWh.pincode})
                              </span>
                            </div>
                          );
                        })()}
                        <ChevronDownIcon
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                            isWarehouseDropdownOpen ? "rotate-180 text-brand" : ""
                          }`}
                        />
                      </button>

                      {/* Dropdown Menu */}
                      {isWarehouseDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-72">
                          {/* Search Input */}
                          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
                            <div className="relative">
                              <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                autoFocus
                                value={warehouseSearchQuery}
                                onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                                placeholder="Search by name, city, state, or PIN..."
                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                              {warehouseSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setWarehouseSearchQuery("")}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5 cursor-pointer"
                                >
                                  <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Options List */}
                          <div className="overflow-y-auto divide-y divide-slate-100 p-1 overscroll-contain">
                            {(() => {
                              const activeWarehouses = (warehouses || []).filter((w: any) => w.isActive !== false);
                              const q = warehouseSearchQuery.toLowerCase().trim();
                              const filtered = activeWarehouses.filter((w: any) => {
                                if (!q) return true;
                                const nameMatch = (w.name || "").toLowerCase().includes(q);
                                const cityMatch = (w.city || "").toLowerCase().includes(q);
                                const stateMatch = (w.state || "").toLowerCase().includes(q);
                                const pinMatch = String(w.pincode || "").includes(q);
                                const srMatch = (w.shiprocketLocationId || "").toLowerCase().includes(q);
                                return nameMatch || cityMatch || stateMatch || pinMatch || srMatch;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                                    <p>No warehouses matching &ldquo;<span className="font-semibold text-slate-700">{warehouseSearchQuery}</span>&rdquo;</p>
                                    <button
                                      type="button"
                                      onClick={() => setWarehouseSearchQuery("")}
                                      className="text-brand hover:underline font-bold text-[11px] cursor-pointer"
                                    >
                                      Clear search filter
                                    </button>
                                  </div>
                                );
                              }

                              return filtered.map((w: any) => {
                                const wId = String(w._id || w.id);
                                const isSelected = wId === selectedWarehouseId;
                                return (
                                  <button
                                    key={wId}
                                    type="button"
                                    onClick={() => {
                                      setSelectedWarehouseId(wId);
                                      setIsWarehouseDropdownOpen(false);
                                      setWarehouseSearchQuery("");
                                    }}
                                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 rounded-lg transition-colors cursor-pointer ${
                                      isSelected
                                        ? "bg-orange-50 border-l-4 border-l-brand"
                                        : "hover:bg-slate-50 active:bg-slate-100"
                                    }`}
                                  >
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-xs font-bold truncate ${isSelected ? "text-orange-950" : "text-slate-900"}`}>
                                          {w.name}
                                        </span>
                                        {w.isDefault && (
                                          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                                            Default
                                          </span>
                                        )}
                                        {w.shiprocketLocationId && (
                                          <span className="font-mono text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded truncate max-w-[130px]">
                                            SR: {w.shiprocketLocationId}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {w.city}, {w.state} ({w.pincode})
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <CheckIcon className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>

                          {/* Footer Info */}
                          <div className="px-3 py-1.5 bg-slate-50 text-[10px] text-slate-400 font-medium border-t border-slate-100 flex items-center justify-between">
                            <span>
                              {warehouses.filter((w: any) => w.isActive !== false).length} total pickup locations
                            </span>
                            <span>Click to select</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(() => {
                    const selectedWh = warehouses.find((w: any) => String(w._id || w.id) === selectedWarehouseId);
                    if (!selectedWh) return null;
                    return (
                      <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <BuildingStorefrontIcon className="w-3.5 h-3.5 text-brand" />
                            <span>{selectedWh.name}</span>
                          </span>
                          {selectedWh.shiprocketLocationId && (
                            <span className="font-mono text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded">
                              Shiprocket: &quot;{selectedWh.shiprocketLocationId}&quot;
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 font-medium leading-relaxed pt-0.5">
                          {[selectedWh.addressLine1, selectedWh.addressLine2].filter(Boolean).join(", ")}
                        </p>
                        <p className="text-slate-500 font-medium">
                          {selectedWh.city}, {selectedWh.state} — <span className="font-mono font-bold text-slate-800">{selectedWh.pincode}</span> ({selectedWh.country || "India"})
                        </p>
                        <p className="text-slate-500 text-[11px] pt-1 border-t border-slate-100/80 flex items-center gap-2">
                          <span><strong>Contact:</strong> {selectedWh.contactPerson || "Manager"}</span>
                          <span>•</span>
                          <span><strong>Phone:</strong> {selectedWh.phone}</span>
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Dead Weight and Package Dimensions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700">Package Weight &amp; Box Dimensions</span>
                  {hasUserEditedPackage ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      <span>✓ Custom / Preset Box Applied ({numLength}×{numBreadth}×{numHeight} cm)</span>
                    </span>
                  ) : isAutoDimensions ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <span>
                        ✓ Catalog Specs ({packageEstimate?.itemsWithDimensionsCount || 0}/{packageEstimate?.totalDistinctItemsCount || 0} items)
                        {packageEstimate?.matchedPreset ? ` • Fit: ${packageEstimate.matchedPreset.name}` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                      Using default box (15×15×10 cm) — verify before dispatch
                    </span>
                  )}
                </div>

                {/* 1-Click Master Box Presets */}
                {publicSettings?.packagePresets && publicSettings.packagePresets.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Quick Select Warehouse Carton Preset
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {publicSettings.packagePresets.map((preset) => {
                        const isActive =
                          Number(dimensions.length) === Number(preset.length) &&
                          Number(dimensions.breadth) === Number(preset.breadth) &&
                          Number(dimensions.height) === Number(preset.height);
                        const isRecommended = packageEstimate?.matchedPreset?.name === preset.name;
                        return (
                          <button
                            key={`${preset.name}-${preset.length}-${preset.breadth}-${preset.height}`}
                            type="button"
                            onClick={() => {
                              setHasUserEditedPackage(true);
                              setDimensions({
                                length: Math.max(1, Number(preset.length)),
                                breadth: Math.max(1, Number(preset.breadth)),
                                height: Math.max(1, Number(preset.height)),
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? "bg-brand text-white border-brand shadow-xs"
                                : "bg-white text-slate-700 border-slate-300 hover:border-brand hover:text-brand"
                            }`}
                          >
                            <span>{preset.name}</span>
                            <span className={`font-mono text-[10px] ${isActive ? "text-white/90" : "text-slate-500"}`}>
                              ({preset.length}×{preset.breadth}×{preset.height})
                            </span>
                            {isRecommended && !isActive && (
                              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1 rounded">
                                Fit
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {packageEstimate && (packageEstimate.missingWeightSkus.length > 0 || packageEstimate.missingDimensionSkus.length > 0) && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                    {packageEstimate.missingWeightSkus.length > 0 && (
                      <p>
                        <strong>Missing catalog weight (0.5 kg fallback used):</strong>{" "}
                        <span className="font-mono">{packageEstimate.missingWeightSkus.join(", ")}</span>
                      </p>
                    )}
                    {packageEstimate.missingDimensionSkus.length > 0 && (
                      <p>
                        <strong>Missing catalog L×B×H:</strong>{" "}
                        <span className="font-mono">{packageEstimate.missingDimensionSkus.join(", ")}</span> — weigh &amp; measure the final carton before generating AWB.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Weight (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      value={packageWeight}
                      onChange={(e) => {
                        setHasUserEditedPackage(true);
                        setPackageWeight(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-brand shadow-xs"
                      placeholder="1.0"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Length (cm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={dimensions.length}
                      onChange={(e) => {
                        setHasUserEditedPackage(true);
                        setDimensions({ ...dimensions, length: Math.max(1, Number(e.target.value) || 1) });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-brand shadow-xs"
                      placeholder="15"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Breadth (cm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={dimensions.breadth}
                      onChange={(e) => {
                        setHasUserEditedPackage(true);
                        setDimensions({ ...dimensions, breadth: Math.max(1, Number(e.target.value) || 1) });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-brand shadow-xs"
                      placeholder="15"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Height (cm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={dimensions.height}
                      onChange={(e) => {
                        setHasUserEditedPackage(true);
                        setDimensions({ ...dimensions, height: Math.max(1, Number(e.target.value) || 1) });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-brand shadow-xs"
                      placeholder="10"
                    />
                  </div>
                </div>

                {/* Volumetric & Billable Weight Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <ScaleIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Volumetric:</span>
                    <span className="font-mono font-semibold text-slate-800">{volumetricWeight} kg</span>
                    <span className="text-[10px] text-slate-400">((L×B×H)/5000)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Billable Weight:</span>
                    <span className="font-mono font-black text-brand text-xs px-2 py-0.5 rounded bg-brand/10">
                      {billableWeight} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Shiprocket Mode Option: Dashboard vs Immediate AWB */}
              {selectedCourierId === "shiprocket" && (
                <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoAssignAwb}
                      onChange={(e) => setAutoAssignAwb(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                    <div className="text-xs text-slate-800 leading-snug">
                      <span className="font-bold text-slate-900 block">
                        Auto-assign courier partner &amp; generate AWB immediately
                      </span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">
                        {autoAssignAwb
                          ? "Shiprocket API will instantly book courier and generate waybill label."
                          : "Recommended: Sends order to your Shiprocket Dashboard so you can inspect dimensions and manually select your preferred courier inside Shiprocket."}
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* Direct Carrier Info Badge (Delhivery / Xpressbees) */}
              {selectedCourierId !== "shiprocket" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-700">
                  <span className="font-semibold">Direct Automated Dispatch via {selectedCourier.name} API</span>
                  <span className="text-[11px] text-slate-500">Instant AWB &amp; Label Generation</span>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                  {errorMessage}
                </div>
              )}

              {/* Primary Action Button */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                {selectedCourierId === "shiprocket" ? (
                  <button
                    type="button"
                    disabled={pushToShiprocketMutation.isPending || isUnsettled}
                    onClick={handlePushToShiprocket}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <TruckIcon className="w-4 h-4" />
                    <span>
                      {pushToShiprocketMutation.isPending
                        ? (autoAssignAwb ? "Generating AWB via Shiprocket..." : "Sending to Shiprocket Dashboard...")
                        : (autoAssignAwb ? "Dispatch & Generate AWB via Shiprocket" : "Send Order to Shiprocket Dashboard")}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={directShipmentMutation.isPending || isUnsettled}
                    onClick={handleDirectDispatch}
                    className="w-full py-3 bg-slate-900 hover:bg-brand text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <TruckIcon className="w-4 h-4" />
                    <span>
                      {directShipmentMutation.isPending
                        ? `Booking Shipment with ${selectedCourier.name}...`
                        : `Dispatch via ${selectedCourier.name} API (Auto AWB)`}
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4x6 Thermal Shipping Label Modal */}
      {showLabelModal && (
        <ShippingLabelModal
          order={{
            ...order,
            shipment: {
              ...createdShipment,
              courierName: createdShipment.courierName,
              awb: createdShipment.awb,
              trackingUrl: createdShipment.trackingUrl,
            },
          }}
          onClose={() => setShowLabelModal(false)}
        />
      )}

      {/* Live Carrier Tracking Modal */}
      {showTrackingModal && (
        <AdminTrackingModal
          order={{
            ...order,
            shipment: {
              ...createdShipment,
              courierName: createdShipment.courierName,
              awb: createdShipment.awb,
              trackingUrl: createdShipment.trackingUrl,
            },
          }}
          onClose={() => setShowTrackingModal(false)}
        />
      )}
    </div>,
    document.body
  );
};
