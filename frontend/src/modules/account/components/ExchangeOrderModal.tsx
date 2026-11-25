"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { formatPrice, findExchangeForOrderItem } from "@store4riders/shared-utils";
import { useRequestReturn } from "@/core/hooks/useOrderActions";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { 
  X, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Palette
} from "lucide-react";

interface ExchangeOrderModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  preselectedItemId?: string | null;
}

interface ExchangeReasonOption {
  id: string;
  label: string;
  placeholder: string;
  badge?: string;
}

const EXCHANGE_REASONS: ExchangeReasonOption[] = [
  { 
    id: "size_small", 
    label: "Size Too Small — Need a Larger Size",
    placeholder: "e.g. Need Size XL (instead of L), or Euro 44 boot size"
  },
  { 
    id: "size_large", 
    label: "Size Too Large — Need a Smaller Size",
    placeholder: "e.g. Need Size S (instead of M), or Euro 41 boot size"
  },
  { 
    id: "color_change", 
    label: "Color / Graphic Exchange — Need Different Color",
    placeholder: "e.g. Need Matte Black instead of Gloss White, or Fluo Yellow Graphic",
    badge: "Color"
  },
  { 
    id: "defect", 
    label: "Defective or Damaged Piece Received",
    placeholder: "e.g. Same size/model in pristine defect-free condition"
  },
  { 
    id: "fit_issue", 
    label: "Fitting / Comfort / Cut Issue",
    placeholder: "e.g. Need relaxed fit cut or Euro 43 wide-fit"
  },
  { 
    id: "wrong_item", 
    label: "Incorrect Item or Graphic Delivered by Mistake",
    placeholder: "e.g. Need correct model/graphic originally ordered"
  },
  { 
    id: "others", 
    label: "Others (Specify details below)",
    placeholder: "e.g. Explain specific replacement or exchange needed",
    badge: "Other"
  },
];

interface FormErrors {
  items?: string;
  desiredRequirement?: string;
  details?: string;
  policy?: string;
  server?: string;
}

// Clean and sanitize string inputs to eliminate XSS / Script Injection attacks
const sanitizeText = (input: string): string => {
  return input
    .replace(/<[^>]*>?/gm, "") // Strip HTML & script tags
    .replace(/[<>{}$`\\]/g, "") // Strip dangerous script & command characters
    .trim();
};

export const ExchangeOrderModal: React.FC<ExchangeOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  preselectedItemId,
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [reasonId, setReasonId] = useState<string>(EXCHANGE_REASONS[0].id);
  const [desiredRequirement, setDesiredRequirement] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [confirmedPolicy, setConfirmedPolicy] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const { mutate: requestReturn, isPending } = useRequestReturn();
  const { data: publicSettings } = usePublicSettings();
  const activeExchangeDays =
    typeof publicSettings?.returnWindowDays === "number" ? publicSettings.returnWindowDays : undefined;
  const activeExchangeFee =
    typeof publicSettings?.exchangeShippingFee === "number" ? publicSettings.exchangeShippingFee : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-select preselected item (or first eligible item) when order opens
  useEffect(() => {
    if (order?.items && order.items.length > 0) {
      const getItemKey = (item: any, idx: number) => String(item._id || item.id || item.productId || idx);
      const isItemBlocked = (item: any) => {
        const matched = findExchangeForOrderItem(order, item);
        return Boolean(matched && !["rejected", "qc_failed"].includes(matched.stage));
      };

      if (preselectedItemId) {
        const targetIdx = order.items.findIndex(
          (item: any, idx: number) => getItemKey(item, idx) === preselectedItemId && !isItemBlocked(item)
        );
        if (targetIdx >= 0) {
          setSelectedItemIds([getItemKey(order.items[targetIdx], targetIdx)]);
          setErrors({});
          return;
        }
      }

      const firstEligibleIdx = order.items.findIndex((item: any) => !isItemBlocked(item));
      if (firstEligibleIdx >= 0) {
        setSelectedItemIds([getItemKey(order.items[firstEligibleIdx], firstEligibleIdx)]);
      } else {
        setSelectedItemIds([]);
      }
    }
    setErrors({});
  }, [order, isOpen, preselectedItemId]);

  if (!isOpen || !order || !mounted || typeof document === "undefined") {
    return null;
  }

  const orderNum = order.orderNumber || (order._id || order.id || "").slice(-8).toUpperCase();
  const currentReason = EXCHANGE_REASONS.find((r) => r.id === reasonId) || EXCHANGE_REASONS[0];

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) => {
      const updated = prev.includes(id) 
        ? prev.filter((item) => item !== id) 
        : [...prev, id];
      
      if (updated.length > 0) {
        setErrors((e) => ({ ...e, items: undefined }));
      }
      return updated;
    });
  };

  const handleRequirementChange = (val: string) => {
    setDesiredRequirement(val);
    if (errors.desiredRequirement && val.trim().length >= 2) {
      setErrors((e) => ({ ...e, desiredRequirement: undefined }));
    }
  };

  const handleDetailsChange = (val: string) => {
    if (val.length <= 500) {
      setDetails(val);
      if (errors.details && val.trim().length >= 10) {
        setErrors((e) => ({ ...e, details: undefined }));
      }
    }
  };

  const handlePolicyChange = (checked: boolean) => {
    setConfirmedPolicy(checked);
    if (checked && errors.policy) {
      setErrors((e) => ({ ...e, policy: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // 1. Items validation
    if (!selectedItemIds || selectedItemIds.length === 0) {
      newErrors.items = "Please select at least one item you wish to exchange.";
    }

    // 2. Desired Requirement validation & sanitization
    const sanitizedReq = sanitizeText(desiredRequirement);
    if (!sanitizedReq) {
      newErrors.desiredRequirement = "Please enter your requested replacement size, color, or variant.";
    } else if (sanitizedReq.length < 2) {
      newErrors.desiredRequirement = "Replacement requirement must be at least 2 characters long.";
    } else if (sanitizedReq.length > 100) {
      newErrors.desiredRequirement = "Replacement requirement cannot exceed 100 characters.";
    } else if (/<script|javascript:|on\w+=/i.test(desiredRequirement)) {
      newErrors.desiredRequirement = "Invalid or malicious input detected. Special script characters are not allowed.";
    }

    // 3. Details validation & sanitization
    const sanitizedDetails = sanitizeText(details);
    if (!sanitizedDetails) {
      newErrors.details = "Please write a brief explanation describing the exchange requirement.";
    } else if (sanitizedDetails.length < 10) {
      newErrors.details = `Please provide at least 10 characters (${sanitizedDetails.length}/10 entered).`;
    } else if (sanitizedDetails.length > 500) {
      newErrors.details = "Detailed explanation cannot exceed 500 characters.";
    } else if (/<script|javascript:|on\w+=/i.test(details)) {
      newErrors.details = "Invalid or malicious input detected. Script tags and HTML elements are forbidden.";
    }

    // 4. Policy confirmation
    if (!confirmedPolicy) {
      newErrors.policy = "You must confirm that the product is completely unused with all original tags attached.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const selectedReasonLabel = currentReason.label;
    const cleanReq = sanitizeText(desiredRequirement);
    const cleanDetails = sanitizeText(details);

    // Build selected items payload and summary
    const selectedOrderItems = (order.items || []).filter((item: any, idx: number) => {
      const key = String(item._id || item.id || item.productId || idx);
      const matched = findExchangeForOrderItem(order, item);
      const blocked = Boolean(matched && !["rejected", "qc_failed"].includes(matched.stage));
      return selectedItemIds.includes(key) && !blocked;
    });

    const selectedItemNames = selectedOrderItems
      .map((item: any) => `${item.name}${item.variantId ? ` [${item.variantId}]` : ""}`)
      .join(", ");

    const formattedPayload = `Type: ${selectedReasonLabel} | Item(s): ${selectedItemNames || "Ordered Item"} | Replacement: ${cleanReq} | Note: ${cleanDetails}`;

    const orderIdToSubmit = order._id || order.id || order.orderNumber;

    requestReturn(
      {
        orderId: orderIdToSubmit,
        reason: formattedPayload,
        items: selectedOrderItems.map((item: any) => ({
          orderItemId: item._id || item.id ? String(item._id || item.id) : undefined,
          productId: String(item.productId),
          ...(item.variantId ? { variantId: String(item.variantId) } : {}),
          ...(item.sku ? { sku: String(item.sku) } : {}),
          name: item.name,
          quantity: item.quantity || 1,
          desiredReplacement: cleanReq,
        })),
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          const apiError = err?.response?.data?.error || err?.response?.data?.message || "Failed to submit exchange request. Please try again.";
          setErrors((e) => ({ ...e, server: apiError }));
        },
      }
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col border border-neutral-200 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base sm:text-lg font-black text-neutral-900 uppercase tracking-tight">
                Request Gear Exchange
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Order #{orderNum}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 space-y-5">

          {/* Policy Banner */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 sm:p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-wider text-[11px] text-amber-950">
                Store4Riders Replacement Policy
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900 leading-relaxed">
                {typeof activeExchangeDays === "number" && activeExchangeDays > 0 && (
                  <li>
                    Eligible within <strong>{activeExchangeDays} days</strong> from order delivery date.
                  </li>
                )}
                {typeof activeExchangeFee === "number" && (
                  <li>
                    {activeExchangeFee > 0
                      ? `2-way pickup & replacement shipping charge (${formatPrice(activeExchangeFee)}) applies post QC inspection.`
                      : "Exchange pickup & replacement shipping is complimentary for eligible requests."}
                  </li>
                )}
                <li>Size and color replacements are facilitated subject to stock availability.</li>
                <li>Riding gear must be <strong>100% unused</strong>, unridden, with original manufacturer tags intact in brand packaging box.</li>
                <li>Per policy, exchanges cannot be accepted for items with removed tags, signs of wear, or perfume/sweat odours.</li>
              </ul>
            </div>
          </div>

          {/* 1. Item Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
              1. Select Item to Exchange <span className="text-brand font-black">*</span>
            </label>
            <div className="space-y-2">
              {order.items?.map((item: any, idx: number) => {
                const itemId = String(item._id || item.id || item.productId || idx);
                const matchedExchange = findExchangeForOrderItem(order, item);
                const isAlreadyExchanged = Boolean(
                  matchedExchange && !["rejected", "qc_failed"].includes(matchedExchange.stage)
                );
                const isSelected = !isAlreadyExchanged && selectedItemIds.includes(itemId);
                const itemImg = item.image || item.product?.images?.[0]?.url || item.product?.image || "/no-image.svg";
                const unitPrice = item.price ?? item.unitPrice ?? 0;

                return (
                  <div
                    key={itemId}
                    onClick={() => {
                      if (!isAlreadyExchanged) toggleItemSelection(itemId);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isAlreadyExchanged
                        ? "border-neutral-200 bg-neutral-100/70 opacity-70 cursor-not-allowed"
                        : isSelected
                        ? "border-neutral-900 bg-neutral-50 shadow-2xs cursor-pointer"
                        : "border-neutral-200 bg-white hover:border-neutral-300 cursor-pointer"
                    } ${errors.items ? "border-brand/60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAlreadyExchanged}
                      onChange={() => {
                        if (!isAlreadyExchanged) toggleItemSelection(itemId);
                      }}
                      className="w-4 h-4 text-brand rounded focus:ring-brand accent-brand cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="relative w-12 h-12 bg-white border border-neutral-200 rounded-lg shrink-0 overflow-hidden p-1">
                      <Image
                        src={itemImg}
                        alt={item.name || "Product"}
                        fill
                        className="object-contain p-0.5"
                        sizes="48px"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-neutral-900 line-clamp-1">
                          {item.name}
                        </p>
                        {isAlreadyExchanged && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                            {String(matchedExchange.stage || "requested").replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                        {item.variantId && <span>Variant: <strong className="text-neutral-700">{item.variantId}</strong></span>}
                        <span>Qty: {item.quantity}</span>
                        <span>• {formatPrice(unitPrice)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Validation Error directly below Item selection */}
            {errors.items && (
              <span className="text-brand text-xs font-semibold mt-1.5 flex items-center gap-1 block">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.items}</span>
              </span>
            )}
          </div>

          {/* 2. Reason for Exchange */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
              2. Reason for Exchange <span className="text-brand font-black">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {EXCHANGE_REASONS.map((r) => {
                const isChecked = reasonId === r.id;
                return (
                  <label
                    key={r.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      isChecked
                        ? "border-neutral-900 bg-neutral-50 text-neutral-900 font-bold"
                        : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="exchange_reason"
                        value={r.id}
                        checked={isChecked}
                        onChange={() => setReasonId(r.id)}
                        className="text-brand focus:ring-brand accent-brand cursor-pointer"
                      />
                      <span className="truncate">{r.label}</span>
                    </div>

                    {r.badge && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-neutral-200/70 text-neutral-700 shrink-0 ml-2">
                        {r.badge}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Desired Replacement (Size / Color / Variant) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-1.5">
              3. Desired Replacement (Size / Color / Variant) <span className="text-brand font-black">*</span>
            </label>
            <input
              type="text"
              maxLength={100}
              value={desiredRequirement}
              onChange={(e) => handleRequirementChange(e.target.value)}
              placeholder={currentReason.placeholder}
              className={`w-full border rounded-lg p-2.5 text-xs transition-all ${
                errors.desiredRequirement 
                  ? "border-brand focus:border-brand focus:ring-2 focus:ring-brand/20 bg-red-50/20" 
                  : "border-neutral-300 focus:ring-2 focus:ring-brand/20 focus:border-brand"
              }`}
            />
            {/* Context help text */}
            <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 shrink-0" />
              <span>Specify replacement requirements (e.g. Size XL, Euro 43 boot, or Matte Black color).</span>
            </p>
            {/* Validation Error directly below Input Box */}
            {errors.desiredRequirement && (
              <span className="text-brand text-xs font-semibold mt-1 flex items-center gap-1 block">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.desiredRequirement}</span>
              </span>
            )}
          </div>

          {/* 4. Details / Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800">
                4. Additional Details &amp; Description <span className="text-brand font-black">*</span>
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {details.length}/500
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={details}
              onChange={(e) => handleDetailsChange(e.target.value)}
              placeholder="Please explain why you need the exchange (e.g., tight on shoulders, need bigger size, color mismatch, etc.)..."
              className={`w-full border rounded-lg p-2.5 text-xs transition-all resize-none ${
                errors.details 
                  ? "border-brand focus:border-brand focus:ring-2 focus:ring-brand/20 bg-red-50/20" 
                  : "border-neutral-300 focus:ring-2 focus:ring-brand/20 focus:border-brand"
              }`}
            />
            {/* Validation Error directly below Textarea */}
            {errors.details && (
              <span className="text-brand text-xs font-semibold mt-1 flex items-center gap-1 block">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.details}</span>
              </span>
            )}
          </div>

          {/* 5. Policy Acknowledgment */}
          <div className="pt-2 border-t border-neutral-100">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedPolicy}
                onChange={(e) => handlePolicyChange(e.target.checked)}
                className={`w-4 h-4 text-brand rounded focus:ring-brand accent-brand shrink-0 mt-0.5 cursor-pointer ${
                  errors.policy ? "ring-2 ring-brand" : ""
                }`}
              />
              <span className="text-[11px] text-neutral-700 leading-snug">
                I confirm that the item is brand new, completely unused, has never been ridden with, and contains all original manufacturer tags and boxes intact. <span className="text-brand font-black">*</span>
              </span>
            </label>
            {/* Validation Error directly below Checkbox */}
            {errors.policy && (
              <span className="text-brand text-xs font-semibold mt-1.5 flex items-center gap-1 block">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.policy}</span>
              </span>
            )}
          </div>

          {/* Server Error Message (Positioned right above action buttons, not on top) */}
          {errors.server && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-brand text-xs font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.server}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 border border-neutral-300 rounded-lg text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-brand hover:bg-red-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Exchange Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
