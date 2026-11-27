"use client";

import React, { useState, useEffect, useRef } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import Image from "next/image";

// Permanent payment gateway vector icons - preloaded into browser memory cache on checkout entry
const PAYMENT_GATEWAY_ICONS = [
  "/icons/payment/payu.svg",
  "/icons/payment/upi.svg",
  "/icons/payment/gpay.svg",
  "/icons/payment/phonepe.svg",
  "/icons/payment/paytm.svg",
  "/icons/payment/visa.svg",
  "/icons/payment/mastercard.svg",
  "/icons/payment/rupay.svg",
];

if (typeof window !== "undefined") {
  PAYMENT_GATEWAY_ICONS.forEach((src) => {
    preload(src, { as: "image", type: "image/svg+xml" });
  });
}
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useCartStore } from "@/stores/useCartStore";
import { formatPrice, validateIndianMobile } from "@store4riders/shared-utils";
import TopBanner from "@/modules/homepage/components/TopBanner";
import Navbar from "@/modules/homepage/components/Navbar";
import Footer from "@/modules/homepage/components/Footer";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CheckoutPersonalInfo } from "./CheckoutPersonalInfo";
import { CheckoutStepper } from "./CheckoutStepper";
import { CheckoutShippingDelivery } from "./CheckoutShippingDelivery";
import { CheckoutPaymentStep } from "./CheckoutPaymentStep";
import { DirectUpiModal } from "./DirectUpiModal";
import { PostCheckoutRegisterForm } from "./PostCheckoutRegisterForm";
import { useCheckout, syncOrderPaymentStatus } from "@/core/hooks/useCheckout";
import { useValidateCoupon, usePublicCoupons } from "@/core/hooks/useCoupons";
import { useUserAddresses, useAddAddress, useUpdateAddress, useDeleteAddress } from "@/core/hooks/useAddresses";
import { usePublicSettings } from "@/core/hooks/usePaymentSettings";
import { usePincodeLookup } from "@/core/hooks/usePincodeLookup";
import { PaymentMethodType, IUserAddress } from "@store4riders/shared-types";
import { getCartItemImage } from "@/core/utils/mediaUrlHelper";
import {
  getGatewayRedirectLabel,
  PAYMENT_VERIFY_RETRY_DELAYS_MS,
  formatGatewayDisplayName,
  savePendingPaymentOrder,
  loadPendingPaymentOrder,
  clearPendingPaymentOrder,
} from "@/core/utils/paymentSubmit";
import { 
  UserIcon, 
  TruckIcon, 
  CreditCardIcon, 
  CheckCircleIcon, 
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  TagIcon,
  ShoppingBagIcon
} from "@heroicons/react/24/outline";
import { COUNTRIES } from "@/core/utils/countries";

import { useAuthStore } from "@/stores/useAuthStore";

const FALLBACK_IMAGE = "/no-image.svg";



declare global {
  interface Window {}
}

export const CheckoutPageModule = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { items, clearCart, isLoaded } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const { mutate: placeOrder, mutateAsync: placeOrderAsync, isPending: isPlacingOrder } = useCheckout();
  const { data: settings } = usePublicSettings({ staleTime: 30 * 1000 });
  const { data: savedAddresses = [] } = useUserAddresses();
  const { mutateAsync: addAddressAsync, isPending: isAddingAddress } = useAddAddress();
  const { mutateAsync: updateAddressAsync, isPending: isUpdatingAddress } = useUpdateAddress();
  const { mutateAsync: deleteAddressAsync } = useDeleteAddress();

  // Compute active cart subtotal with exact price resolution
  const subtotal = items.reduce((total, item) => {
    const itemPrice = item.price ?? item.product?.price ?? item.product?.specialPrice ?? item.product?.basePrice ?? 0;
    return total + itemPrice * item.quantity;
  }, 0);

  // Promo Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const validateCouponMutation = useValidateCoupon();
  const { data: publicCoupons = [] } = usePublicCoupons();

  // Direct UPI / Google Pay Modal State
  const [upiModalData, setUpiModalData] = useState<{
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

  // Restore applied coupon from Cart / localStorage if user is authenticated
  useEffect(() => {
    if (!mounted || !user || appliedCoupon) return;
    try {
      const saved = localStorage.getItem("s4r_checkout_coupon");
      if (saved && items.length > 0 && subtotal > 0) {
        const parsed = JSON.parse(saved);
        const code = typeof parsed === "string" ? parsed : parsed?.code;
        if (code && !validateCouponMutation.isPending) {
          const itemsPayload = items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId || null,
            quantity: it.quantity,
          }));
          validateCouponMutation.mutateAsync({
            code,
            items: itemsPayload,
            cartTotal: subtotal,
          }).then((res) => {
            setAppliedCoupon({
              code: res.code,
              discountAmount: res.discountAmount,
            });
            toast.success(`Coupon "${res.code}" applied from your cart!`);
          }).catch(() => {
            localStorage.removeItem("s4r_checkout_coupon");
          });
        }
      }
    } catch {}
  }, [mounted, user, items, subtotal]);

  // Invalidate applied coupon if subtotal changes (prevents cart tampering)
  const prevSubtotalRef = useRef(subtotal);
  useEffect(() => {
    if (prevSubtotalRef.current !== subtotal) {
      prevSubtotalRef.current = subtotal;
      if (appliedCoupon) {
        setAppliedCoupon(null);
        localStorage.removeItem("s4r_checkout_coupon");
        toast.info("Cart updated. Please re-apply your promo coupon.");
      }
    }
  }, [subtotal, appliedCoupon]);

  // Combine query savedAddresses with cached user.addresses for instant zero-latency address availability
  const effectiveAddresses: IUserAddress[] = React.useMemo(() => {
    if (savedAddresses && savedAddresses.length > 0) return savedAddresses;
    if (user?.addresses && user.addresses.length > 0) return user.addresses;
    return [];
  }, [savedAddresses, user?.addresses]);

  const isSuccessParam = searchParams?.get("success") === "true";
  const isVerifyingParam = searchParams?.get("verifying") === "true";
  const isFailedParam = searchParams?.get("failed") === "true";
  const isCancelledParam = searchParams?.get("cancelled") === "true";
  const hasPaymentIssue = isFailedParam || isCancelledParam;
  const orderIdParam = searchParams?.get("orderId");
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);

  // Automatic verification & polling state when returning from PayU/CCAvenue/Snapmint in pending state
  const [verificationPhase, setVerificationPhase] = useState<
    "idle" | "verifying" | "pending_timeout" | "confirmed" | "failed" | "cancelled"
  >(isVerifyingParam && orderIdParam ? "verifying" : "idle");
  const [verificationAttempt, setVerificationAttempt] = useState(1);
  const [verifiedGatewayMethod, setVerifiedGatewayMethod] = useState<string | undefined>(undefined);
  const [isCheckingVerificationNow, setIsCheckingVerificationNow] = useState(false);
  const [isNetworkWeakOrOffline, setIsNetworkWeakOrOffline] = useState(false);
  const [resolvedFailureReason, setResolvedFailureReason] = useState<string | undefined>(undefined);
  const manualVerifyTriggerRef = useRef<(() => void) | null>(null);
  const [recoveredOrderId, setRecoveredOrderId] = useState<string | null>(null);
  const [isRecoveringPendingOrder, setIsRecoveringPendingOrder] = useState(false);
  const [isRecoveryCheckDone, setIsRecoveryCheckDone] = useState(false);
  const activeVerifyOrderId = orderIdParam || recoveredOrderId;
  
  // 2-Step Checkout: 1: Details & Shipping (Scrollable), 2: Payment, 3: Success
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(isSuccessParam ? 3 : 1);
  
  // Validation error alert
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Address state
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isManualNewAddress, setIsManualNewAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState<boolean>(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const handleToggleAddressForm = (show: boolean) => {
    setIsManualNewAddress(show);
    setShowAddressForm(show);
    if (!show) {
      setEditingAddressId(null);
    }
  };

  // Keep register form mounted on success screen even after user auth state changes
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  useEffect(() => {
    if (currentStep === 3 && !user) {
      setShowRegisterForm(true);
    }
  }, [currentStep, user]);

  const handleDeleteAddress = async (id: string) => {
    if (confirm("Are you sure you want to delete this address?")) {
      try {
        await deleteAddressAsync(id);
        toast.success("Address deleted successfully");
        const remaining = effectiveAddresses.filter(a => (a.id || String((a as any)?._id || "")) !== id);
        if (selectedAddressId === id) {
          if (remaining.length > 0) {
            const nextAddr = remaining.find(a => a.isDefault) || remaining[0];
            setSelectedAddressId(nextAddr?.id || String((nextAddr as any)?._id || ""));
          } else {
            setSelectedAddressId(null);
            setShowAddressForm(true);
          }
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to delete address");
      }
    }
  };
  
  // Parse user's phone if they have one (e.g. +919876543210 -> +91, 9876543210)
  const userPhoneRaw = user?.phone || "";
  let defaultPhone = userPhoneRaw;
  if (userPhoneRaw.startsWith("+91")) defaultPhone = userPhoneRaw.slice(3);

  // Form State matching Figma Screen 1
  const [formData, setFormData] = useState({
    name: user?.name || (user?.firstName ? (user.firstName + " " + (user.lastName || "")).trim() : ""),
    countryCode: "IN",
    phone: defaultPhone,
    altPhone: "",
    email: user?.email || "",
    address: "",
    state: "",
    city: "",
    pinCode: "",
    country: "IN",
    isB2b: false,
    businessName: "",
    customerGstin: "",
  });

  // Sync contact info whenever user profile loads or changes, or from localStorage
  useEffect(() => {
    let savedContact: any = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("s4r_checkout_contact");
        if (raw) savedContact = JSON.parse(raw);
      } catch (e) {}
    }

    const userName = user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "");
    const userEmail = user?.email || "";
    let userPhone = user?.phone || "";
    if (userPhone.startsWith("+91")) userPhone = userPhone.slice(3);

    setFormData((prev) => {
      const nextName = prev.name || userName || savedContact?.name || "";
      const nextEmail = prev.email || userEmail || savedContact?.email || "";
      const nextPhone = prev.phone || userPhone || savedContact?.phone || "";
      const nextAltPhone = prev.altPhone || savedContact?.altPhone || "";
      const nextCountryCode = prev.countryCode && prev.countryCode !== "IN" ? prev.countryCode : (savedContact?.countryCode || "IN");

      if (
        nextName === prev.name &&
        nextEmail === prev.email &&
        nextPhone === prev.phone &&
        nextAltPhone === prev.altPhone
      ) {
        return prev;
      }

      return {
        ...prev,
        name: nextName,
        email: nextEmail,
        phone: nextPhone,
        altPhone: nextAltPhone,
        countryCode: nextCountryCode,
      };
    });
  }, [user]);

  // Pincode Auto-fill Logic
  const { data: pincodeData } = usePincodeLookup(
    formData.pinCode && formData.pinCode.length === 6 ? formData.pinCode : ""
  );

  useEffect(() => {
    if (pincodeData) {
      const rawCity = pincodeData.district || pincodeData.divisionName || pincodeData.regionName || "";
      const titleCaseCity = rawCity ? rawCity.toLowerCase().replace(/\b\w/g, (s: string) => s.toUpperCase()) : "";
      
      let mappedState = "";
      if (pincodeData.state) {
        mappedState = pincodeData.state.trim().toLowerCase().replace(/\b\w/g, (s: string) => s.toUpperCase());
      }

      setFormData(prev => ({
        ...prev,
        city: titleCaseCity,
        state: mappedState
      }));

      // Clear any errors on pinCode, city, state
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.city;
        delete next.state;
        delete next.pinCode;
        return next;
      });
    } else if (pincodeData === null && formData.pinCode.length === 6) {
      // 6-digit PIN code queried but not in DB
      setFormData(prev => ({
        ...prev,
        city: "",
        state: ""
      }));
      setFieldErrors(prev => ({
        ...prev,
        pinCode: "Please enter valid Indian PIN code"
      }));
    }
  }, [pincodeData]);

  // Clear city and state when user is editing pinCode and it is less than 6 digits
  useEffect(() => {
    if (formData.pinCode.length < 6 && (formData.city || formData.state)) {
      setFormData(prev => ({
        ...prev,
        city: "",
        state: ""
      }));
    }
  }, [formData.pinCode]);

  // Shipping & Payment Options
  const [paymentOption, setPaymentOption] = useState<PaymentMethodType>("payu");
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRedirectingToGateway, setIsRedirectingToGateway] = useState(false);
  const [confirmedDisplayMethod, setConfirmedDisplayMethod] = useState<string | undefined>(undefined);
  const submitLockRef = useRef(false);
  const redirectFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [generatedOrderNumber, setGeneratedOrderNumber] = useState("12345678910");
  const [isCodAvailable, setIsCodAvailable] = useState(true);

  useEffect(() => {
    setMounted(true);
    setGeneratedOrderNumber(`ORD-${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    return () => {
      if (redirectFallbackTimerRef.current) clearTimeout(redirectFallbackTimerRef.current);
    };
  }, []);

  // Reset redirect lock if user navigates back to checkout from payment gateway via browser bfcache
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        if (redirectFallbackTimerRef.current) {
          clearTimeout(redirectFallbackTimerRef.current);
          redirectFallbackTimerRef.current = null;
        }
        submitLockRef.current = false;
        setIsRedirectingToGateway(false);
        setIsProcessing(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Initialize default address and address view mode when addresses are loaded
  useEffect(() => {
    if (user && effectiveAddresses.length > 0) {
      if (!selectedAddressId || !effectiveAddresses.some(a => (a.id || String((a as any)?._id || "")) === selectedAddressId)) {
        const defaultAddr = effectiveAddresses.find((a: IUserAddress) => a.isDefault) || effectiveAddresses[0];
        const defaultId = defaultAddr?.id || String((defaultAddr as any)?._id || "");
        if (defaultId) {
          setSelectedAddressId(defaultId);
        }
      }
      // If user has saved addresses and is NOT currently manually adding or editing, show saved addresses list
      if (!isManualNewAddress && !editingAddressId) {
        setShowAddressForm(false);
      }
    } else if (mounted && (!user || effectiveAddresses.length === 0)) {
      setShowAddressForm(true);
    }
  }, [user, effectiveAddresses, selectedAddressId, isManualNewAddress, editingAddressId, mounted]);

  // Sync formData with selected address so delivery summary and active calculations stay in sync
  useEffect(() => {
    if (selectedAddressId && effectiveAddresses.length > 0 && !showAddressForm) {
      const selected = effectiveAddresses.find(
        (a: IUserAddress) => (a.id || String((a as any)?._id || "")) === selectedAddressId
      );
      if (selected) {
        setFormData(prev => ({
          ...prev,
          address: selected.street || prev.address,
          city: selected.city || prev.city,
          state: selected.state || prev.state,
          pinCode: selected.pincode || prev.pinCode,
          country: selected.country || prev.country || "IN",
        }));
      }
    }
  }, [selectedAddressId, effectiveAddresses, showAddressForm]);

  // Handle successful payment redirect & resolve actual payment method badge non-blockingly
  useEffect(() => {
    if (!isSuccessParam) return;
    setVerificationPhase("confirmed");
    setCurrentStep(3);
    clearCart();
    clearPendingPaymentOrder();
    try {
      localStorage.removeItem("s4r_checkout_coupon");
    } catch {}

    if (orderIdParam && !isOrderCompleted) {
      let active = true;
      syncOrderPaymentStatus(orderIdParam)
        .then((res) => {
          if (active && res?.paymentMethod) {
            setConfirmedDisplayMethod(res.paymentMethod);
            setPaymentOption(res.paymentMethod as PaymentMethodType);
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [isSuccessParam, orderIdParam, isOrderCompleted, clearCart]);

  const handleVerifiedSuccess = React.useCallback(
    (confirmedOrderNumber: string, confirmedMethod?: string) => {
      setVerificationPhase("confirmed");
      setIsOrderCompleted(true);
      setGeneratedOrderNumber(confirmedOrderNumber);
      if (confirmedMethod) {
        setConfirmedDisplayMethod(confirmedMethod);
        setPaymentOption(confirmedMethod as PaymentMethodType);
      }
      setCurrentStep(3);
      clearCart();
      clearPendingPaymentOrder();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("s4r_checkout_coupon");
        } catch {}
        window.history.replaceState(
          null,
          "",
          `/checkout?success=true&orderId=${encodeURIComponent(confirmedOrderNumber)}`
        );
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [clearCart]
  );

  // Crash / battery-off / tab-kill recovery: if user reopens /checkout without gateway callback query params,
  // check for a recent in-flight payment in persistent storage before rendering checkout again (prevents double charge).
  useEffect(() => {
    if (isSuccessParam || isVerifyingParam || hasPaymentIssue || orderIdParam || isOrderCompleted) {
      setIsRecoveryCheckDone(true);
      return;
    }

    const pending = loadPendingPaymentOrder();
    if (!pending) {
      setIsRecoveryCheckDone(true);
      return;
    }

    const pendingRef = pending.orderNumber || pending.gatewayOrderId || "";
    if (!pendingRef) {
      clearPendingPaymentOrder();
      setIsRecoveryCheckDone(true);
      return;
    }

    setGeneratedOrderNumber(pendingRef);
    if (pending.paymentMethod) {
      setVerifiedGatewayMethod(pending.paymentMethod);
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setIsNetworkWeakOrOffline(true);
      setRecoveredOrderId(pendingRef);
      setVerificationPhase("verifying");
      setIsRecoveryCheckDone(true);
      return;
    }

    let cancelled = false;
    setIsRecoveringPendingOrder(true);

    (async () => {
      try {
        const result = await syncOrderPaymentStatus(pendingRef);
        if (cancelled) return;

        if (result?.isConfirmed) {
          clearPendingPaymentOrder();
          toast.success(
            result.message ||
              `Previous payment (#${result.orderNumber || pendingRef}) was confirmed by your bank!`
          );
          handleVerifiedSuccess(
            result.orderNumber || pendingRef,
            result.paymentMethod || pending.paymentMethod
          );
          return;
        }

        if (result?.isCancelled) {
          clearPendingPaymentOrder();
          setResolvedFailureReason(result.failureReason);
          setGeneratedOrderNumber(result.orderNumber || pendingRef);
          setVerificationPhase("cancelled");
          setCurrentStep(2);
          return;
        }

        if (result?.gatewayStatus === "failed" && !result?.isPending) {
          clearPendingPaymentOrder();
          setResolvedFailureReason(result.failureReason);
          setGeneratedOrderNumber(result.orderNumber || pendingRef);
          setVerificationPhase("failed");
          setCurrentStep(2);
          return;
        }

        if (result?.isPending) {
          const resolvedNum = result.orderNumber || pendingRef;
          setGeneratedOrderNumber(resolvedNum);
          if (result.paymentMethod) {
            setVerifiedGatewayMethod(result.paymentMethod);
          }
          setRecoveredOrderId(resolvedNum);
          setVerificationPhase("verifying");
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `/checkout?verifying=true&orderId=${encodeURIComponent(resolvedNum)}`
            );
          }
          toast.info(`Resuming verification for pending order #${resolvedNum}.`);
          return;
        }

        clearPendingPaymentOrder();
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (typeof status === "number" && status >= 400 && status < 500) {
          clearPendingPaymentOrder();
        } else {
          // Network/timeout right after phone reboot -> hold verification screen & wait for reconnect
          setIsNetworkWeakOrOffline(true);
          setRecoveredOrderId(pendingRef);
          setVerificationPhase("verifying");
        }
      } finally {
        if (!cancelled) {
          setIsRecoveringPendingOrder(false);
          setIsRecoveryCheckDone(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuccessParam, isVerifyingParam, hasPaymentIssue, orderIdParam, isOrderCompleted, handleVerifiedSuccess]);

  // Automatic progressive-backoff polling when returning from gateway with ?verifying=true&orderId=... or crash recovery
  useEffect(() => {
    if (!isVerifyingParam && !recoveredOrderId) {
      return;
    }
    if (!activeVerifyOrderId) {
      setVerificationPhase("failed");
      setCurrentStep(2);
      return;
    }

    let cancelled = false;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let currentAttempt = 0;
    let lastCheckedAt = 0;
    const maxAttempts = PAYMENT_VERIFY_RETRY_DELAYS_MS.length + 1;

    setVerificationPhase("verifying");
    setVerificationAttempt(1);
    setIsNetworkWeakOrOffline(typeof navigator !== "undefined" ? navigator.onLine === false : false);

    const scheduleNextCheck = (attemptNumber: number) => {
      if (cancelled || attemptNumber >= maxAttempts) return;
      const delayMs =
        PAYMENT_VERIFY_RETRY_DELAYS_MS[attemptNumber - 1] ??
        PAYMENT_VERIFY_RETRY_DELAYS_MS[PAYMENT_VERIFY_RETRY_DELAYS_MS.length - 1];
      if (pollTimeout) clearTimeout(pollTimeout);
      pollTimeout = setTimeout(() => {
        void runVerificationAttempt(attemptNumber + 1);
      }, delayMs);
    };

    const runVerificationAttempt = async (requestedAttempt?: number) => {
      if (cancelled || inFlight) return;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
      }

      const nextAttempt = requestedAttempt ?? Math.min(currentAttempt + 1, maxAttempts);
      currentAttempt = nextAttempt;
      inFlight = true;
      lastCheckedAt = Date.now();
      setIsCheckingVerificationNow(true);
      setVerificationAttempt(nextAttempt);

      try {
        const result = await syncOrderPaymentStatus(activeVerifyOrderId);
        if (cancelled) return;
        setIsNetworkWeakOrOffline(false);

        if (result?.paymentMethod) {
          setVerifiedGatewayMethod(result.paymentMethod);
        }

        if (result?.isConfirmed) {
          clearPendingPaymentOrder();
          toast.success(result.message || "Payment verified with bank! Your order is confirmed.");
          handleVerifiedSuccess(result.orderNumber || activeVerifyOrderId, result.paymentMethod);
          return;
        }

        if (result?.isCancelled) {
          clearPendingPaymentOrder();
          setVerificationPhase("cancelled");
          setCurrentStep(2);
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `/checkout?cancelled=true&orderId=${encodeURIComponent(result.orderNumber || activeVerifyOrderId)}`
            );
          }
          return;
        }

        if (result?.gatewayStatus === "failed" && !result?.isPending) {
          clearPendingPaymentOrder();
          setResolvedFailureReason(result.failureReason);
          setVerificationPhase("failed");
          setCurrentStep(2);
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `/checkout?failed=true&orderId=${encodeURIComponent(result.orderNumber || activeVerifyOrderId)}`
            );
          }
          return;
        }
      } catch {
        // Transient network/slow-internet glitch: notify user and keep polling / waiting for reconnect
        if (!cancelled) {
          setIsNetworkWeakOrOffline(true);
        }
      } finally {
        inFlight = false;
        if (!cancelled) {
          setIsCheckingVerificationNow(false);
        }
      }

      if (cancelled) return;

      if (currentAttempt < maxAttempts) {
        scheduleNextCheck(currentAttempt);
      } else {
        setVerificationPhase("pending_timeout");
        setCurrentStep(2);
      }
    };

    const handleResumeCheck = () => {
      if (cancelled || inFlight) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setIsNetworkWeakOrOffline(true);
        return;
      }
      setIsNetworkWeakOrOffline(false);
      if (Date.now() - lastCheckedAt < 1200) return;
      void runVerificationAttempt();
    };

    const handleOffline = () => {
      if (!cancelled) setIsNetworkWeakOrOffline(true);
    };

    manualVerifyTriggerRef.current = () => {
      if (cancelled || inFlight) return;
      void runVerificationAttempt();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleResumeCheck);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleResumeCheck);
      window.addEventListener("online", handleResumeCheck);
      window.addEventListener("offline", handleOffline);
    }

    void runVerificationAttempt(1);

    return () => {
      cancelled = true;
      manualVerifyTriggerRef.current = null;
      if (pollTimeout) clearTimeout(pollTimeout);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleResumeCheck);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleResumeCheck);
        window.removeEventListener("online", handleResumeCheck);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [isVerifyingParam, recoveredOrderId, activeVerifyOrderId, handleVerifiedSuccess]);

  // Handle failed or cancelled payment redirect
  useEffect(() => {
    if (hasPaymentIssue) {
      clearPendingPaymentOrder();
      if (!orderIdParam) {
        toast.info(isCancelledParam ? "Payment cancelled. Your items are still safely in your cart." : "Payment session ended. Your items are still safely in your cart.");
      }
      setCurrentStep(2);
    }
  }, [hasPaymentIssue, isCancelledParam, orderIdParam]);

  // If orderId is provided in URL, update generatedOrderNumber
  useEffect(() => {
    if (orderIdParam) {
      setGeneratedOrderNumber(orderIdParam);
    }
  }, [orderIdParam]);

  // Redirect to cart ONLY if mounted, cart storage has loaded, recovery check has completed (or URL carries callback context),
  // cart is truly empty, and checkout is not verifying/completed/reconciling.
  useEffect(() => {
    const hasCallbackContext =
      isSuccessParam ||
      isVerifyingParam ||
      hasPaymentIssue ||
      Boolean(orderIdParam) ||
      Boolean(recoveredOrderId);

    const isVerifyingActive =
      isVerifyingParam ||
      Boolean(recoveredOrderId) ||
      verificationPhase === "verifying" ||
      verificationPhase === "pending_timeout" ||
      verificationPhase === "confirmed";
    const isReconcilingIssue =
      (hasPaymentIssue || verificationPhase === "failed" || verificationPhase === "cancelled") &&
      Boolean(orderIdParam || recoveredOrderId);

    if (
      mounted &&
      isLoaded &&
      (hasCallbackContext || isRecoveryCheckDone) &&
      items.length === 0 &&
      currentStep !== 3 &&
      !isSuccessParam &&
      !isOrderCompleted &&
      !isVerifyingActive &&
      !isReconcilingIssue
    ) {
      router.push("/cart");
    }
  }, [
    mounted,
    isLoaded,
    items.length,
    currentStep,
    isSuccessParam,
    isOrderCompleted,
    isVerifyingParam,
    verificationPhase,
    hasPaymentIssue,
    orderIdParam,
    recoveredOrderId,
    isRecoveryCheckDone,
    router,
  ]);

  if (!mounted) {
    return (
      <div className="w-full min-h-screen bg-white flex flex-col font-sans">
        <TopBanner message="Helmets, jackets, gloves: 100% genuine, EMI and COD available." />
        <div className="bg-[#161616] border-b border-[#2a2a2a]">
          <Navbar logoText="Store4Riders" theme="dark-solid" />
        </div>
        <div className="max-w-[1400px] w-full mx-auto px-4 py-16 animate-pulse">
          <div className="h-12 w-64 bg-neutral-100 rounded mb-8" />
        </div>
      </div>
    );
  }

  const cartWeightKg = items.reduce((total, item) => {
    const itemWeight = item.product?.weight || 0.5; // fallback 0.5kg
    return total + itemWeight * item.quantity;
  }, 0);

  const isAllFreeShipping = items.length > 0 && items.every(item => Boolean(item.product?.isFreeShipping || (item as any).isFreeShipping));
  const freeThreshold = settings?.freeShippingThreshold != null ? Number(settings.freeShippingThreshold) : 0;
  const qualifiesForFreeShipping = isAllFreeShipping || (freeThreshold > 0 && subtotal >= freeThreshold);

  // Maximum item-level shipping surcharge (heavy freight override)
  const maxItemShippingSurcharge = items.reduce((max, item) => {
    const p = item.product || {};
    const rawCost = p.shippingFee ?? p.shippingCost ?? p.attributes?.ship_cost ?? (p.attributes instanceof Map ? p.attributes.get("ship_cost") : 0);
    const numCost = Number(rawCost) || 0;
    return Math.max(max, numCost);
  }, 0);

  const baseShippingFee = settings?.shippingCost != null ? Number(settings.shippingCost) : 0;
  const applicableStandardFee = Math.max(baseShippingFee, maxItemShippingSurcharge);

  const shippingCost = qualifiesForFreeShipping
    ? (maxItemShippingSurcharge > 0 ? maxItemShippingSurcharge : 0)
    : (subtotal > 0 ? applicableStandardFee : 0);
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const isGstExclusive = settings?.gstPricingMode === "exclusive";
  const defaultTaxRate = typeof settings?.taxRate === "number" ? settings.taxRate : 18;
  const taxableSubtotal = Math.max(0, subtotal - couponDiscount);
  const estimatedTax = isGstExclusive
    ? Math.round((taxableSubtotal * defaultTaxRate) / 100)
    : Math.round(taxableSubtotal - (taxableSubtotal / (1 + defaultTaxRate / 100)));

  // COD Cash Handling Charges (Tiered based on order value, dynamic from Admin Settings)
  const codHandlingFee = paymentOption === "cod" && settings?.codHandlingFeeEnabled !== false
    ? (taxableSubtotal <= (settings?.codHandlingFeeThreshold ?? 5000)
        ? (settings?.codHandlingFeeTier1Amount ?? 100)
        : (settings?.codHandlingFeeTier2Amount ?? 200))
    : 0;

  const total = Math.max(0, taxableSubtotal + shippingCost + codHandlingFee + (isGstExclusive ? estimatedTax : 0));

  const isCodWithAdvance = paymentOption === "cod" && Boolean(settings?.codPartialPaymentEnabled) && (settings?.codPartialPaymentValue || 0) > 0;
  const codAdvanceValue = Number(settings?.codPartialPaymentValue) || 10;
  const advanceAmount = isCodWithAdvance
    ? (settings?.codPartialPaymentType === "fixed" ? Math.min(codAdvanceValue, total) : Math.round((total * codAdvanceValue) / 100))
    : 0;

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      toast.error("Please sign in or create an account to apply promo coupons");
      return;
    }
    if (!couponInput.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    const itemsPayload = items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || null,
      quantity: it.quantity,
    }));

    try {
      const res = await validateCouponMutation.mutateAsync({
        code: couponInput.trim(),
        items: itemsPayload,
        cartTotal: subtotal,
      });

      setAppliedCoupon({
        code: res.code,
        discountAmount: res.discountAmount,
      });
      localStorage.setItem("s4r_checkout_coupon", JSON.stringify({ code: res.code, discountAmount: res.discountAmount }));
      toast.success(res.message || `Coupon "${res.code}" applied!`);
      setCouponInput("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid or ineligible coupon code");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    localStorage.removeItem("s4r_checkout_coupon");
    toast.info("Coupon removed");
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "phone" || name === "altPhone") {
      nextValue = value.replace(/\D/g, "");
    }
    setFormData(prev => ({ ...prev, [name]: nextValue }));
    if (errorMessage) setErrorMessage("");
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = "Please provide your name.";
    else if (formData.name.trim().length < 2 || formData.name.trim().length > 50 || !/^[a-zA-Z0-9\s.-]+$/.test(formData.name.trim())) {
      errors.name = "Please enter a valid full name (2-50 characters, special symbols not allowed).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) errors.email = "Please provide your email address.";
    else if (formData.email.trim().length > 100 || !emailRegex.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!formData.phone.trim()) errors.phone = "Please provide your phone number.";
    else {
      const phoneClean = formData.phone.replace(/[\s-]/g, "");
      if (!/^\d+$/.test(phoneClean)) {
        errors.phone = "Phone number must contain only digits.";
      } else {
        const isIndia = formData.countryCode === "IN" || !formData.countryCode;
        if (isIndia) {
          const check = validateIndianMobile(phoneClean);
          if (!check.isValid) {
            errors.phone = check.error || "Please enter a valid 10-digit Indian mobile number.";
          }
        } else {
          const currentCountryInfo = COUNTRIES.find(c => c.code === formData.countryCode);
          const validLengths = currentCountryInfo?.phoneLength || [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
          if (!validLengths.includes(phoneClean.length)) {
            errors.phone = `Phone numbers for ${currentCountryInfo?.name || "this country"} must be ${validLengths.length === 1 ? 'exactly ' + validLengths[0] : validLengths.join(' or ')} digits.`;
          }
        }
      }
    }

    if (formData.altPhone.trim()) {
      const altPhoneClean = formData.altPhone.trim().replace(/[\s-]/g, "");
      if (!/^\d+$/.test(altPhoneClean)) {
        errors.altPhone = "Alternate phone number must contain only digits.";
      } else {
        const isIndia = formData.countryCode === "IN" || !formData.countryCode;
        if (isIndia) {
          const check = validateIndianMobile(altPhoneClean);
          if (!check.isValid) {
            errors.altPhone = check.error || "Please enter a valid alternate Indian mobile number.";
          }
        } else {
          const currentCountryInfo = COUNTRIES.find(c => c.code === formData.countryCode);
          const validLengths = currentCountryInfo?.phoneLength || [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
          if (!validLengths.includes(altPhoneClean.length)) {
            errors.altPhone = `Alternate phone number for ${currentCountryInfo?.name || "this country"} has an invalid length.`;
          }
        }
      }
    }

    if (formData.isB2b) {
      if (!formData.businessName || !formData.businessName.trim()) {
        errors.businessName = "Please provide your company / business name.";
      } else if (formData.businessName.trim().length < 2 || formData.businessName.trim().length > 100) {
        errors.businessName = "Business name must be between 2 and 100 characters.";
      }

      const gstinClean = (formData.customerGstin || "").trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinClean) {
        errors.customerGstin = "Please provide your 15-digit Company GSTIN.";
      } else if (!gstinRegex.test(gstinClean)) {
        errors.customerGstin = "Invalid 15-digit GSTIN format (e.g. 27AAPCS1234F1Z5).";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Please fix the errors below to continue.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }

    setFieldErrors({});
    setErrorMessage("");
    return true;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};

    if (!formData.address.trim()) errors.address = "Please provide your shipping address.";
    else if (formData.address.trim().length < 3) {
      errors.address = "Address must be at least 3 characters.";
    } else if (formData.address.trim().length > 200) {
      errors.address = "Address is too long. Please keep it under 200 characters.";
    }

    if (!formData.pinCode.trim()) {
      errors.pinCode = "Please provide your PIN code.";
    } else if (!/^\d{6}$/.test(formData.pinCode.trim())) {
      errors.pinCode = "PIN code must be exactly 6 digits.";
    } else if (!formData.city.trim() || !formData.state.trim()) {
      errors.pinCode = "Please enter valid Indian PIN code.";
    }

    if (!formData.city.trim()) errors.city = "City is required (auto-detected from PIN).";
    if (!formData.state.trim()) errors.state = "State is required (auto-detected from PIN).";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Please fix the errors below to continue.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }

    setFieldErrors({});
    setErrorMessage("");
    return true;
  };

  const handleContinueToShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("s4r_checkout_contact", JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            altPhone: formData.altPhone,
            countryCode: formData.countryCode,
          }));
        } catch (e) {}
      }
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleContinueToPayment = async () => {
    // 1. Validate contact info first
    if (!validateStep1()) {
      return;
    }

    // Save contact info to localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("s4r_checkout_contact", JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          altPhone: formData.altPhone,
          countryCode: formData.countryCode,
        }));
      } catch (e) {}
    }

    // 2. Validate address
    if (showAddressForm || !selectedAddressId || !user) {
      if (validateStep2()) {
        try {
          const { COUNTRIES } = await import("@/core/utils/countries");
          const selectedCountryObj = COUNTRIES.find(c => c.code.toUpperCase() === (formData.country || "").toUpperCase() || c.name.toLowerCase() === (formData.country || "").toLowerCase());
          const selectedCountryName = selectedCountryObj?.name || (formData.country && formData.country.length >= 2 ? formData.country : "India");
          const finalCountry = selectedCountryName && selectedCountryName.trim().length >= 2 ? selectedCountryName.trim() : "India";
          
          if (user) {
            let targetAddressId: string | null = null;
            const cleanStreet = formData.address.trim();
            const cleanCity = formData.city.trim();
            const cleanState = formData.state.trim();
            const cleanPincode = formData.pinCode.trim();

            if (editingAddressId) {
              await updateAddressAsync({
                addressId: editingAddressId,
                addressData: {
                  street: cleanStreet,
                  city: cleanCity,
                  state: cleanState,
                  pincode: cleanPincode,
                  country: finalCountry,
                  isDefault: true,
                }
              });
              targetAddressId = editingAddressId;
              setEditingAddressId(null);
              toast.success("Address updated successfully");
            } else {
              const updatedUser = await addAddressAsync({
                street: cleanStreet,
                city: cleanCity,
                state: cleanState,
                pincode: cleanPincode,
                country: finalCountry,
                isDefault: true,
              });
              const addresses = updatedUser?.addresses || [];
              const newAddress = addresses[addresses.length - 1];
              targetAddressId = newAddress?.id || String((newAddress as any)?._id || "");
              toast.success("Address saved successfully");
            }

            if (targetAddressId) {
              setSelectedAddressId(targetAddressId);
            }
            setIsManualNewAddress(false);
            setEditingAddressId(null);
            setShowAddressForm(false);
          }
          setCurrentStep(2);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error: any) {
          const apiMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to save address";
          toast.error(typeof apiMsg === "string" ? apiMsg : "Failed to save address");
        }
      }
    } else {
      if (!selectedAddressId) {
        toast.error("Please select a shipping address");
        return;
      }
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleAgreeToPay = async () => {
    if (submitLockRef.current || isProcessing || isPlacingOrder || isRedirectingToGateway) return;

    if (items.length === 0) {
      toast.error("Your cart is empty. Please add items to place a new order.");
      return;
    }

    if (user && !selectedAddressId) {
      toast.error("Please select a shipping address");
      setCurrentStep(1);
      return;
    }

    if (!user) {
      if (!formData.address?.trim()) {
        toast.error("Please provide your delivery address (street / flat / building)");
        setCurrentStep(1);
        return;
      }
      if (!formData.city?.trim() || !formData.state?.trim() || !formData.pinCode?.trim()) {
        toast.error("Please complete your delivery address details");
        setCurrentStep(1);
        return;
      }
    }

    if (formData.isB2b) {
      if (!formData.businessName?.trim()) {
        toast.error("Please provide your company / business name for B2B tax invoice");
        setCurrentStep(1);
        return;
      }
      const gstinClean = (formData.customerGstin || "").trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstinClean)) {
        toast.error("Please enter a valid 15-digit GSTIN (e.g. 27AAPCS1234F1Z5)");
        setCurrentStep(1);
        return;
      }
    }

    submitLockRef.current = true;
    setIsProcessing(true);
    
    // Look up the dial code to construct the full phone number
    const { COUNTRIES } = await import("@/core/utils/countries");
    const dialCode = COUNTRIES.find(c => c.code === formData.countryCode)?.dialCode || "+91";
    const selectedCountryObj = COUNTRIES.find(c => c.code.toUpperCase() === (formData.country || "").toUpperCase() || c.name.toLowerCase() === (formData.country || "").toLowerCase());
    const selectedCountryName = selectedCountryObj?.name || (formData.country && formData.country.length >= 2 ? formData.country : "India");
    const finalCountry = selectedCountryName && selectedCountryName.trim().length >= 2 ? selectedCountryName.trim() : "India";
    
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("s4r_checkout_contact", JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          altPhone: formData.altPhone,
          countryCode: formData.countryCode,
        }));
      } catch (e) {}
    }

    const shippingAddress = user && selectedAddressId ? undefined : {
      fullName: formData.name,
      phone: dialCode + formData.phone,
      street: formData.address,
      addressLine1: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pinCode,
      country: finalCountry
    };

    placeOrder({ 
      shippingAddressId: user ? (selectedAddressId || undefined) : undefined, 
      shippingAddress,
      guestEmail: user ? undefined : formData.email,
      paymentMethod: paymentOption,
      couponCode: appliedCoupon?.code || undefined,
      phone: dialCode + formData.phone,
      fullName: formData.name,
      customerGstin: formData.isB2b && formData.customerGstin ? formData.customerGstin.trim().toUpperCase() : undefined,
      businessName: formData.isB2b && formData.businessName ? formData.businessName.trim() : undefined,
    }, {
      onError: () => {
        submitLockRef.current = false;
        setIsProcessing(false);
        setIsRedirectingToGateway(false);
      },
      onSuccess: (data: any) => {
        const resData = data?.data || data || {};
        const method = String(resData.paymentMethod || data?.paymentMethod || paymentOption || "").toLowerCase();
        const gatewayOrderId = resData.gatewayOrderId;
        const hasGatewayRedirect =
          Boolean(resData.gatewayResponse) &&
          (method === "payu" ||
            method === "ccavenue" ||
            method === "snapmint" ||
            (method === "cod" && Boolean(gatewayOrderId)));

        if (hasGatewayRedirect) {
          // Keep checkout locked while external payment gateway page opens, with safety auto-unlock if navigation stalls
          setIsRedirectingToGateway(true);
          if (redirectFallbackTimerRef.current) clearTimeout(redirectFallbackTimerRef.current);
          redirectFallbackTimerRef.current = setTimeout(() => {
            submitLockRef.current = false;
            setIsRedirectingToGateway(false);
            setIsProcessing(false);
            toast.info("Gateway redirect was interrupted or took too long. You can safely retry.");
          }, 15000);
          return;
        }

        submitLockRef.current = false;
        setIsProcessing(false);

        // Direct UPI / Google Pay
        if ((method === "upi" || method === "gpay") && data?.data?.gatewayResponse) {
          const gw = data.data.gatewayResponse;
          const ordId = gw.orderNumber || data?.data?.orderNumber || data?.data?.orderId || generatedOrderNumber;
          savePendingPaymentOrder({
            orderNumber: ordId,
            gatewayOrderId: data?.data?.gatewayOrderId ? String(data.data.gatewayOrderId) : undefined,
            guestOrderToken: data?.data?.guestOrderToken ? String(data.data.guestOrderToken) : undefined,
            paymentMethod: method,
          });
          setGeneratedOrderNumber(ordId);
          setUpiModalData({
            isOpen: true,
            orderNumber: ordId,
            amount: Number(gw.amount || total),
            upiUri: gw.upiUri,
            payeeName: gw.payeeName,
            payeeVpa: gw.payeeVpa,
          });
          return;
        }

        // Pure COD order completed
        if (method === "cod" && !gatewayOrderId) {
          clearPendingPaymentOrder();
          setIsOrderCompleted(true);
          const ordId = data?.data?.orderNumber || data?.data?.orderId || generatedOrderNumber;
          setGeneratedOrderNumber(ordId);
          setCurrentStep(3);
          clearCart();
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/checkout?success=true&orderId=${ordId}`);
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });
  };

  const handleUpiSuccess = (confirmedOrderNumber: string) => {
    clearPendingPaymentOrder();
    setUpiModalData((prev) => ({ ...prev, isOpen: false }));
    setIsOrderCompleted(true);
    setGeneratedOrderNumber(confirmedOrderNumber);
    setCurrentStep(3);
    clearCart();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/checkout?success=true&orderId=${encodeURIComponent(confirmedOrderNumber)}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreateOrderForGooglePay = async (): Promise<string | null> => {
    if (!user && !selectedAddressId) {
      if (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !formData.address?.trim()) {
        toast.error("Please complete your delivery address details first");
        setCurrentStep(1);
        return null;
      }
      if (!formData.city?.trim() || !formData.state?.trim() || !formData.pinCode?.trim()) {
        toast.error("Please complete your delivery address details first");
        setCurrentStep(1);
        return null;
      }
    }

    try {
      const { COUNTRIES } = await import("@/core/utils/countries");
      const dialCode = COUNTRIES.find((c) => c.code === formData.countryCode)?.dialCode || "+91";
      const selectedCountryObj = COUNTRIES.find(
        (c) =>
          c.code.toUpperCase() === (formData.country || "").toUpperCase() ||
          c.name.toLowerCase() === (formData.country || "").toLowerCase()
      );
      const selectedCountryName =
        selectedCountryObj?.name ||
        (formData.country && formData.country.length >= 2 ? formData.country : "India");
      const finalCountry =
        selectedCountryName && selectedCountryName.trim().length >= 2 ? selectedCountryName.trim() : "India";

      const shippingAddress = user && selectedAddressId ? undefined : {
        fullName: formData.name,
        phone: dialCode + formData.phone,
        street: formData.address,
        addressLine1: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pinCode,
        country: finalCountry,
      };

      const result: any = await placeOrderAsync({
        shippingAddressId: user ? (selectedAddressId || undefined) : undefined,
        shippingAddress,
        guestEmail: user ? undefined : formData.email,
        paymentMethod: "upi",
        couponCode: appliedCoupon?.code || undefined,
        phone: dialCode + formData.phone,
        fullName: formData.name,
        customerGstin: formData.isB2b && formData.customerGstin ? formData.customerGstin.trim().toUpperCase() : undefined,
        businessName: formData.isB2b && formData.businessName ? formData.businessName.trim() : undefined,
      });

      const ordId = result?.data?.orderNumber || result?.data?.gatewayOrderId || result?.data?.orderId;
      if (ordId) {
        savePendingPaymentOrder({
          orderNumber: result?.data?.orderNumber || ordId,
          gatewayOrderId: result?.data?.gatewayOrderId ? String(result.data.gatewayOrderId) : undefined,
          guestOrderToken: result?.data?.guestOrderToken ? String(result.data.guestOrderToken) : undefined,
          paymentMethod: "upi",
        });
        setGeneratedOrderNumber(ordId);
        return ordId;
      }
      return null;
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Could not initialize order for Google Pay"
      );
      return null;
    }
  };

  const totalItemCount = items.reduce((s, it) => s + it.quantity, 0);

  const renderOrderSummaryDetails = () => (
    <>
      {/* Promo Coupon Input / Applied Box */}
      <div className="mb-2.5">
        {!user ? (
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs transition-all shadow-[inset_0_1px_2px_rgba(245,158,11,0.04)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <TagIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="text-[11px] text-neutral-700 font-medium truncate">
                Have promo? <strong className="font-semibold text-neutral-900">Sign in for discounts</strong>
              </span>
            </div>
            <Link
              href="/login?redirect=/checkout"
              className="shrink-0 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] rounded-lg shadow-xs transition-all whitespace-nowrap"
            >
              Sign In →
            </Link>
          </div>
        ) : appliedCoupon ? (
          <div className="bg-emerald-50/90 border border-emerald-200/90 text-emerald-800 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-[inset_0_1px_2px_rgba(16,185,129,0.04)]">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Coupon <strong>{appliedCoupon.code}</strong> applied!</span>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs ml-2 underline cursor-pointer shrink-0"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Promo coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyCoupon();
                  }
                }}
                className="flex-1 min-w-0 px-2.5 py-2 lg:py-1.5 text-xs border border-slate-300 rounded-lg font-mono uppercase bg-white focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                disabled={validateCouponMutation.isPending || !couponInput.trim()}
                className="px-3.5 py-2 lg:py-1.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {validateCouponMutation.isPending ? "..." : "Apply"}
              </button>
            </div>

            {/* Quick-apply active offers */}
            {publicCoupons.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Offers:</span>
                {publicCoupons.slice(0, 3).map((pc) => (
                  <button
                    key={pc._id || pc.code}
                    type="button"
                    onClick={() => {
                      const itemsPayload = items.map((it) => ({
                        productId: it.productId,
                        variantId: it.variantId || null,
                        quantity: it.quantity,
                      }));
                      validateCouponMutation.mutateAsync({
                        code: pc.code,
                        items: itemsPayload,
                        cartTotal: subtotal,
                      }).then((res) => {
                        setAppliedCoupon({
                          code: res.code,
                          discountAmount: res.discountAmount,
                        });
                        localStorage.setItem("s4r_checkout_coupon", JSON.stringify({ code: res.code, discountAmount: res.discountAmount }));
                        toast.success(res.message || `Coupon "${res.code}" applied!`);
                        setCouponInput("");
                      }).catch((err: any) => {
                        toast.error(err.response?.data?.error || `Coupon "${pc.code}" cannot be applied to current cart`);
                      });
                    }}
                    disabled={validateCouponMutation.isPending}
                    className="text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-bold px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <TagIcon className="w-2.5 h-2.5 text-slate-600" />
                    <span>{pc.code}</span>
                    <span className="text-slate-500 font-sans font-normal">
                      ({pc.discountType === "percent" ? `${pc.discountValue}%` : `₹${pc.discountValue}`})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items Mini List */}
      <div className="flex flex-col gap-2 mb-2.5 max-h-[165px] lg:max-h-[145px] overflow-y-auto pr-1.5 custom-scrollbar">
        {items.map((item) => {
          const product = item.product || {};
          const name = product.name || "Riding Gear";
          const price = item.price ?? product.price ?? product.specialPrice ?? product.basePrice ?? 0;
          const rawImg = getCartItemImage(item, FALLBACK_IMAGE);

          return (
            <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-2.5 group py-0.5">
              <div className="relative w-10 h-10 lg:w-9 lg:h-9 bg-slate-50 rounded-lg overflow-hidden shrink-0 border border-slate-200 group-hover:border-slate-300 transition-colors">
                <Image
                  src={rawImg}
                  alt={name}
                  fill
                  className="object-contain p-0.5"
                  sizes="40px"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-[11px] text-slate-900 uppercase line-clamp-1 leading-snug">
                  {name}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Qty: {item.quantity}
                </span>
              </div>
              
              <div className="text-xs font-bold text-slate-900 shrink-0">
                {formatPrice(price * item.quantity)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cost Breakdown */}
      <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Subtotal</span>
          <span className="text-slate-900 font-semibold">{formatPrice(subtotal)}</span>
        </div>

        {couponDiscount > 0 && appliedCoupon && (
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-emerald-700 flex items-center gap-1">
              Coupon ({appliedCoupon.code})
            </span>
            <span className="text-emerald-700 font-bold">-{formatPrice(couponDiscount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Shipping</span>
          <span className={shippingCost === 0 ? 'text-emerald-700 font-bold uppercase' : 'text-slate-900 font-semibold'}>
            {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
          </span>
        </div>

        {paymentOption === "cod" && codHandlingFee > 0 && (
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>COD Handling Fee</span>
            <span className="text-slate-900 font-bold">+{formatPrice(codHandlingFee)}</span>
          </div>
        )}

        {isGstExclusive ? (
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>GST ({defaultTaxRate === 0 ? "0% - Exempt" : `${defaultTaxRate}%`})</span>
            <span className="text-slate-900 font-bold">+{formatPrice(estimatedTax)}</span>
          </div>
        ) : (
          <div className="text-xs font-medium text-slate-500">
            GST (Included in price)
          </div>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2.5 mt-0.5">
        <span className="text-sm font-bold text-slate-900">Total Payable</span>
        <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
          {formatPrice(total)}
        </span>
      </div>
    </>
  );

  return (
    <div className="w-full min-h-screen bg-[#f6f8fb] flex flex-col font-sans relative">
      
      {/* Top Banner */}
      <TopBanner
        message="Helmets, jackets, gloves: 100% genuine, EMI and COD available."
      />

      {/* Navbar with Brand Logo */}
      <div className="bg-[#161616] border-b border-[#2a2a2a] relative z-40">
        <Navbar
          logoText="Store4Riders"
          theme="dark-solid"
        />
      </div>

      {/* Breadcrumb Navigation */}
      <Breadcrumb items={[
        { label: "HOME", href: "/" },
        { label: "CART", href: "/cart" },
        { label: "CHECKOUT" }
      ]} />

      {/* Main Content */}
      <main className="max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-36 lg:pt-2 lg:pb-8 flex-1">
        
        {/* ========================================================================= */}
        {/* ACTIVE GATEWAY VERIFICATION SCREEN (Auto-polling bank confirmation)       */}
        {/* ========================================================================= */}
        {(isRecoveringPendingOrder || verificationPhase === "verifying") && currentStep !== 3 ? (
          <div className="max-w-xl mx-auto py-8 sm:py-12 px-4 sm:px-8 text-center flex flex-col items-center bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 animate-in fade-in duration-300 my-4 sm:my-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-5 relative">
              <div className="w-7 h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
            </div>

            <h1 className="font-sans text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase mb-2">
              {isRecoveringPendingOrder ? "RESUMING PAYMENT CHECK..." : "CONFIRMING YOUR PAYMENT..."}
            </h1>

            {(activeVerifyOrderId || generatedOrderNumber) && (
              <span className="inline-block text-[11px] font-mono font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-md border border-slate-200 mb-3">
                Order Ref: #{activeVerifyOrderId || generatedOrderNumber}
              </span>
            )}

            <p className="text-slate-600 text-xs sm:text-sm max-w-md mb-4 leading-relaxed font-sans">
              We are verifying final payment confirmation with {formatGatewayDisplayName(verifiedGatewayMethod)} &amp; your bank.{" "}
              <strong className="text-slate-900">Please do not close, refresh, or press back.</strong>
            </p>

            <div className="w-full max-w-md bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 text-left flex items-start gap-2.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping mt-1 shrink-0" />
              <div className="flex flex-col gap-0.5 text-xs text-blue-950 flex-1">
                <span className="font-bold">
                  {isRecoveringPendingOrder
                    ? "Checking status of your unfinished payment before continuing..."
                    : `Checking bank settlement status (Check ${verificationAttempt} of ${PAYMENT_VERIFY_RETRY_DELAYS_MS.length + 1})...`}
                </span>
                <span className="text-[11px] text-blue-800 leading-relaxed">
                  Bank and UPI settlements typically take 2–15 seconds to confirm after redirect. If money was debited, your order will be confirmed automatically.
                </span>
              </div>
            </div>

            {isNetworkWeakOrOffline && (
              <div className="w-full max-w-md mt-3 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5 text-left text-xs text-amber-950 font-medium">
                <strong>Weak or disconnected internet detected.</strong> We will automatically verify your order as soon as your network stabilizes — please do not pay twice.
              </div>
            )}

            <button
              type="button"
              onClick={() => manualVerifyTriggerRef.current?.()}
              disabled={isCheckingVerificationNow || isRecoveringPendingOrder}
              className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              {isCheckingVerificationNow || isRecoveringPendingOrder ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Checking Bank Status...</span>
                </>
              ) : (
                <span>Check Status Now</span>
              )}
            </button>
          </div>
        ) : currentStep === 3 ? (
          <div className="max-w-xl mx-auto py-7 sm:py-10 px-4 sm:px-8 text-center flex flex-col items-center bg-white rounded-xl sm:rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 animate-in fade-in zoom-in-95 duration-300 my-4 sm:my-6">
            {/* Green Checkmark Badge */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-4">
              <CheckIcon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
            </div>

            {/* Modern Heading: ORDER CONFIRMED! / PAYMENT SUCCESS! */}
            <h1 className="font-sans text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase mb-2">
              {(confirmedDisplayMethod || (isOrderCompleted ? paymentOption : "")) === "cod"
                ? "ORDER CONFIRMED!"
                : "PAYMENT SUCCESS!"}
            </h1>

            <p className="text-slate-500 text-xs sm:text-sm max-w-md mb-4 leading-relaxed font-sans">
              Thank you for shopping with Store4Riders. Your order <strong>#{generatedOrderNumber}</strong> has been confirmed. A receipt and tracking details have been sent to {formData.email || user?.email ? <strong>{formData.email || user?.email}</strong> : "your registered email address"}.
            </p>

            {/* Payment Method Badge on Confirmation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 my-3 text-xs text-slate-700 flex items-center justify-between w-full max-w-md font-sans">
              <span className="font-semibold text-slate-500">Payment Method:</span>
              <span className="font-black text-slate-900 uppercase">
                {(confirmedDisplayMethod || (isOrderCompleted ? paymentOption : "ONLINE PAYMENT")).toUpperCase()}
              </span>
            </div>
            
            {showRegisterForm && formData.email && (
              <PostCheckoutRegisterForm
                email={formData.email}
                name={formData.name || ""}
                phone={formData.phone}
                countryCode={formData.countryCode}
                shippingAddress={formData.address ? {
                  street: formData.address,
                  city: formData.city,
                  state: formData.state,
                  pincode: formData.pinCode,
                  country: formData.country || "India",
                  isDefault: true,
                } : undefined}
              />
            )}
            
            <Link
              href="/"
              className="mt-3 bg-banner hover:bg-[#e8451c] text-white font-bold tracking-wider text-xs uppercase px-7 py-3 rounded-lg transition-colors"
            >
              BACK TO HOME
            </Link>
          </div>
        ) : (
          /* ========================================================================= */
          /* SCREENS 1 & 2: 2-STEP CHECKOUT FLOW */
          /* ========================================================================= */
          <>
            {/* Mobile Collapsible Order Summary Bar */}
            <div className="lg:hidden mb-3.5">
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileSummaryOpen((prev) => !prev)}
                  aria-expanded={isMobileSummaryOpen}
                  className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left cursor-pointer active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                      <ShoppingBagIcon className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 tracking-tight">
                          Order Summary
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                        {isMobileSummaryOpen ? "Hide details & promo" : appliedCoupon ? `Coupon ${appliedCoupon.code} applied • View details` : "View items & apply promo"}
                        {isMobileSummaryOpen ? (
                          <ChevronUpIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-slate-900 tracking-tight">
                      {formatPrice(total)}
                    </span>
                  </div>
                </button>

                {isMobileSummaryOpen && (
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 animate-in fade-in duration-150">
                    {renderOrderSummaryDetails()}
                  </div>
                )}
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-10 items-start">
              
              {/* Left Column: Form Steps */}
              <div className="w-full lg:w-[62%]">
                
                {/* Stepper Progress Bar - Moved inside left column to save vertical space */}
                <CheckoutStepper 
                  currentStep={currentStep} 
                  setCurrentStep={setCurrentStep as (step: 1 | 2) => void} 
                  validateStep1={validateStep1} 
                  validateStep2={validateStep2}
                />
                
                {/* ------------------------------------------------------------- */}
                {/* STEP 1: DETAILS & SHIPPING (Contact Info + Delivery Address)   */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 1 && (
                  <CheckoutShippingDelivery
                    formData={formData}
                    handleInputChange={handleInputChange}
                    setErrorMessage={setErrorMessage}
                    errorMessage={errorMessage}
                    fieldErrors={fieldErrors}
                    setFieldErrors={setFieldErrors}
                    setCurrentStep={setCurrentStep as (step: 1 | 2) => void}
                    handleContinueToPayment={handleContinueToPayment}
                    shippingCost={shippingCost}
                    freeShippingThreshold={freeThreshold}
                    savedAddresses={effectiveAddresses}
                    selectedAddressId={selectedAddressId}
                    onSelectAddress={setSelectedAddressId}
                    showAddressForm={showAddressForm}
                    onToggleAddressForm={handleToggleAddressForm}
                    isAddingAddress={isAddingAddress || isUpdatingAddress}
                    onDeleteAddress={handleDeleteAddress}
                    editingAddressId={editingAddressId}
                    setEditingAddressId={setEditingAddressId}
                    cartWeightKg={cartWeightKg}
                    setIsCodAvailable={setIsCodAvailable}
                    total={total}
                  />
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 2: PAYMENT METHOD */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 2 && (
                  <CheckoutPaymentStep
                    generatedOrderNumber={generatedOrderNumber}
                    orderReference={orderIdParam || recoveredOrderId || undefined}
                    paymentOption={paymentOption}
                    setPaymentOption={setPaymentOption}
                    setCurrentStep={setCurrentStep as (step: 1 | 2) => void}
                    handleAgreeToPay={handleAgreeToPay}
                    onPreOrderCreate={handleCreateOrderForGooglePay}
                    onVerifiedSuccess={handleVerifiedSuccess}
                    isProcessing={isProcessing || isPlacingOrder}
                    isRedirecting={isRedirectingToGateway}
                    isFailedParam={isFailedParam || verificationPhase === "failed"}
                    isCancelledParam={isCancelledParam || verificationPhase === "cancelled"}
                    isPendingParam={verificationPhase === "pending_timeout"}
                    skipAutoVerify={verificationPhase === "failed"}
                    failureReason={resolvedFailureReason}
                    shippingAddressSummary={
                      effectiveAddresses.find((a) => (a.id || String((a as any)._id)) === selectedAddressId)
                        ? (() => {
                            const a = effectiveAddresses.find((a) => (a.id || String((a as any)._id)) === selectedAddressId)!;
                            return `${a.street}, ${a.city}, ${a.state} - ${a.pincode}`;
                          })()
                        : formData.address
                        ? `${formData.address}, ${formData.city}, ${formData.state} - ${formData.pinCode}`
                        : ""
                    }
                    isCodAvailable={isCodAvailable}
                    total={total}
                  />
                )}

                {/* Mobile Trust Badges Footer */}
                <div className="lg:hidden mt-4 flex items-center justify-center gap-2.5 py-2 px-3 rounded-lg bg-white border border-slate-200/80 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600"/> Secure Checkout</span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5"><LockClosedIcon className="w-3.5 h-3.5 text-slate-600"/> 256-Bit Encrypted</span>
                </div>

              </div>

              {/* Right Column: ORDER SUMMARY (Sticky on desktop) */}
              <div className="hidden lg:block w-full lg:w-[38%] lg:sticky lg:top-3 z-20">
                <div className="flex flex-col bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] rounded-2xl p-4 lg:max-h-[calc(100vh-1.5rem)] overflow-y-auto custom-scrollbar">
                  
                  {/* Heading */}
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="font-sans font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                      Order Summary
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
                    </span>
                  </div>

                  {renderOrderSummaryDetails()}

                  {/* Desktop Step 2 Place Order Button - positioned directly below Total in Order Summary */}
                  {currentStep === 2 && (
                    <div className="hidden lg:flex flex-col gap-1.5 mt-3">
                      {isCodWithAdvance && (
                        <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] leading-tight text-slate-700 flex items-center justify-between gap-1">
                          <span className="truncate">
                            Requires <strong className="font-bold text-slate-900">{settings?.codPartialPaymentType === "fixed" ? `₹${Number(settings?.codPartialPaymentValue || 0).toLocaleString("en-IN")}` : `${settings?.codPartialPaymentValue ?? 10}%`} advance</strong> via PayU
                          </span>
                          <span className="text-[10px] text-slate-700 font-bold uppercase shrink-0">PayU</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAgreeToPay}
                        disabled={isProcessing || isPlacingOrder || isRedirectingToGateway || !paymentOption}
                        className="w-full bg-banner hover:bg-[#e8451c] text-white font-bold tracking-wider text-xs uppercase py-3.5 px-5 rounded-lg transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isProcessing || isPlacingOrder || isRedirectingToGateway ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>
                              {isRedirectingToGateway
                                ? getGatewayRedirectLabel(paymentOption)
                                : "PROCESSING ORDER..."}
                            </span>
                          </>
                        ) : isCodWithAdvance && advanceAmount > 0 ? (
                          `PAY ₹${advanceAmount.toLocaleString("en-IN")} ADVANCE`
                        ) : (
                          "PLACE ORDER"
                        )}
                      </button>

                      {isRedirectingToGateway && (
                        <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 text-center font-medium">
                          Connecting securely to payment gateway. Please wait and do not refresh or press back.
                        </p>
                      )}

                      <p className="text-[9.5px] text-slate-400 text-center font-medium">
                        By placing your order, you agree to Store4Riders{" "}
                        <Link
                          href="/store4riders-conditions-of-use-and-sale"
                          target="_blank"
                          className="underline hover:text-slate-600 font-semibold"
                        >
                          Terms &amp; Conditions
                        </Link>
                        .
                      </p>
                    </div>
                  )}

                  {/* Trust Badges */}
                  <div className="flex items-center justify-center gap-2.5 mt-3 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200/70 text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600"/> Secure Checkout</span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5"><LockClosedIcon className="w-3.5 h-3.5 text-slate-600"/> 256-Bit Encrypted</span>
                  </div>

                </div>
              </div>

            </div>
          </>
        )}

      </main>

      {/* Direct UPI / Google Pay Modal */}
      <DirectUpiModal
        isOpen={upiModalData.isOpen}
        onClose={() => setUpiModalData((prev) => ({ ...prev, isOpen: false }))}
        orderNumber={upiModalData.orderNumber}
        amount={upiModalData.amount}
        upiUri={upiModalData.upiUri}
        payeeName={upiModalData.payeeName}
        payeeVpa={upiModalData.payeeVpa}
        onSuccess={handleUpiSuccess}
      />

      {/* Global Footer */}
      <div className="hidden lg:block">
        <Footer />
      </div>

    </div>
  );
};



