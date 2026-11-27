"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileSchema,
  changePasswordSchema,
  ChangePasswordInput,
} from "@store4riders/shared-validation";
import { formatPrice, getOrderExchangesList } from "@store4riders/shared-utils";
import { z } from "zod";
import {
  ShieldCheck,
  Mail,
  Edit2,
  Lock,
  Package,
  Heart,
  MapPin,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Phone,
  LogOut,
  Headphones,
  FileText,
  Truck,
  CheckCircle2,
  Circle,
  User as UserIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogout } from "@/core/hooks/useAuth";
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
  useMyOrders,
} from "@/core/hooks/useAccount";
import { useWishlist } from "@/core/hooks/useWishlist";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import Button from "@/components/ui/Button";

function getOrderStatusBadge(status: string = "") {
  const s = status.toLowerCase();
  switch (s) {
    case "delivered":
      return {
        label: "Delivered",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "shipped":
      return {
        label: "In Transit",
        classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "processing":
    case "packed":
    case "confirmed":
      return {
        label: "Processing",
        classes: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "return_requested":
    case "return_approved":
    case "return_picked":
      return {
        label: "Exchange Active",
        classes: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case "cancelled":
    case "failed":
      return {
        label: s === "failed" ? "Payment Failed" : "Cancelled",
        classes: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        label: status ? status.replace(/_/g, " ").toUpperCase() : "CONFIRMED",
        classes: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

function ProfileHubInner() {
  const searchParams = useSearchParams();
  const { user: storeUser } = useAuthStore();
  const { data: freshUser } = useProfile();
  const { data: orders = [] } = useMyOrders();
  const { data: wishlistIds = [] } = useWishlist();

  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const logoutMutation = useLogout();

  const user = freshUser || storeUser;

  const [isEditing, setIsEditing] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const personalInfoRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-open security section if navigated via ?section=security
  useEffect(() => {
    if (searchParams?.get("section") === "security") {
      setIsSecurityOpen(true);
      setTimeout(() => {
        securityRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }, [searchParams]);

  // Profile form
  const {
    register,
    handleSubmit,
    control,
    reset,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch: watchPassword,
    setFocus: setPasswordFocus,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPasswordValue = watchPassword("newPassword", "");
  const hasMinLength = newPasswordValue.length >= 8;
  const hasNumber = /\d/.test(newPasswordValue);
  const hasUpperAndLowerCase = /[a-z]/.test(newPasswordValue) && /[A-Z]/.test(newPasswordValue);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(newPasswordValue);

  useEffect(() => {
    if (user && !isEditing) {
      reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
      });
    }
  }, [user, reset, isEditing]);

  const startEditingProfile = () => {
    setIsEditing(true);
    setTimeout(() => {
      personalInfoRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      firstNameInputRef.current?.focus();
    }, 60);
  };

  const handleCancelEdit = () => {
    reset({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    });
    setIsEditing(false);
  };

  const onSubmitProfile = async (data: z.infer<typeof updateProfileSchema>) => {
    await updateProfileMutation.mutateAsync(data);
    setIsEditing(false);
  };

  const onProfileInvalid = () => {
    const firstKey = Object.keys(errors)[0] as "firstName" | "lastName" | "phone" | undefined;
    if (firstKey) setFocus(firstKey);
  };

  const onSubmitPassword = async (data: ChangePasswordInput) => {
    await changePasswordMutation.mutateAsync(data);
    resetPassword({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setIsSecurityOpen(false);
  };

  const onPasswordInvalid = () => {
    const firstKey = Object.keys(passwordErrors)[0] as
      | "currentPassword"
      | "newPassword"
      | "confirmPassword"
      | undefined;
    if (firstKey) setPasswordFocus(firstKey);
  };

  const {
    displayName,
    initial,
    defaultAddress,
    addressCount,
    activeOrderCount,
    exchangeCount,
    latestOrder,
  } = useMemo(() => {
    const legacyName = user && "name" in user && typeof user.name === "string" ? user.name : undefined;
    const name = user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : legacyName || user?.email || "Rider";
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const defAddr = addresses.find((a: any) => a.isDefault) || addresses[0] || null;
    const activeOrders = orders.filter((o: any) =>
      ["pending_payment", "confirmed", "processing", "packed", "shipped"].includes(
        String(o.status || "").toLowerCase()
      )
    ).length;
    const exchanges = orders.filter(
      (o: any) =>
        ["return_requested", "return_approved", "return_picked", "returned"].includes(
          String(o.status || "").toLowerCase()
        ) ||
        Boolean(o.exchangeDetails?.stage) ||
        getOrderExchangesList(o).length > 0
    ).length;

    return {
      displayName: name,
      initial: name.charAt(0).toUpperCase(),
      defaultAddress: defAddr,
      addressCount: addresses.length,
      activeOrderCount: activeOrders,
      exchangeCount: exchanges,
      latestOrder: orders[0] || null,
    };
  }, [user, orders]);

  const latestFirstItem = latestOrder?.items?.[0];
  const latestOrderImg =
    latestFirstItem?.image ||
    latestFirstItem?.product?.images?.[0]?.url ||
    latestFirstItem?.product?.image ||
    "/no-image.svg";
  const latestOrderId = latestOrder?._id || latestOrder?.id;
  const latestStatus = latestOrder ? getOrderStatusBadge(latestOrder.status) : null;

  const { ref: firstNameRegisterRef, ...firstNameRegisterProps } = register("firstName");

  return (
    <div className="flex flex-col gap-4 sm:gap-5 pb-6">
      {/* ================================================================
          1. MOBILE ACCOUNT HUB HERO + 2x2 FLIPKART QUICK ACTION GRID (< lg)
          ================================================================ */}
      <section className="lg:hidden flex flex-col gap-3.5" aria-label="Account summary">
        {/* Rider Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-zinc-900 to-neutral-800 text-white p-4 shadow-md border border-neutral-800">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-red-700 text-white flex items-center justify-center font-bold text-xl shadow-lg ring-2 ring-white/20">
                {initial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-neutral-900" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> Verified Rider
                </span>
              </div>
              <h1 className="text-lg font-bold text-white truncate leading-snug">
                {displayName}
              </h1>
              <p className="text-xs text-zinc-300 truncate">{user?.email}</p>
              {user?.phone && (
                <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">{user.phone}</p>
              )}
            </div>

            <button
              type="button"
              onClick={startEditingProfile}
              aria-label="Edit profile information"
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold border border-white/15 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* Flipkart 2x2 Quick Action Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/account/orders"
            className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs active:scale-[0.98] transition-all flex items-center gap-3 min-h-[72px]"
          >
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-900 truncate">Orders</span>
                {orders.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {orders.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {activeOrderCount > 0 ? `${activeOrderCount} active` : "Track & manage"}
              </p>
            </div>
          </Link>

          <Link
            href="/account/wishlist"
            className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs active:scale-[0.98] transition-all flex items-center gap-3 min-h-[72px]"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-900 truncate">Wishlist</span>
                {wishlistIds.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700">
                    {wishlistIds.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {wishlistIds.length > 0 ? `${wishlistIds.length} saved gear` : "Saved items"}
              </p>
            </div>
          </Link>

          <Link
            href="/account/addresses"
            className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs active:scale-[0.98] transition-all flex items-center gap-3 min-h-[72px]"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-900 truncate">Addresses</span>
                {addressCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {addressCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {defaultAddress ? `${defaultAddress.city}` : "Add delivery address"}
              </p>
            </div>
          </Link>

          <Link
            href="/account/orders?tab=exchanges"
            className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs active:scale-[0.98] transition-all flex items-center gap-3 min-h-[72px]"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-900 truncate">Exchanges</span>
                {exchangeCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {exchangeCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Size &amp; returns
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* ================================================================
          2. DESKTOP ACCOUNT OVERVIEW STRIP (lg+)
          ================================================================ */}
      <section className="hidden lg:grid lg:grid-cols-3 gap-4" aria-label="Account overview">
        <Link
          href="/account/orders"
          className="group bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-brand/40 hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              My Orders
            </p>
            <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
              {orders.length} {orders.length === 1 ? "Order" : "Orders"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {activeOrderCount > 0
                ? `${activeOrderCount} in progress`
                : "Track & download invoices"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand transition-colors shrink-0" />
        </Link>

        <Link
          href="/account/addresses"
          className="group bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-brand/40 hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Addresses
            </p>
            <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
              {addressCount} Saved
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {defaultAddress
                ? `Default: ${defaultAddress.city}, ${defaultAddress.pincode}`
                : "Add a delivery address"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand transition-colors shrink-0" />
        </Link>

        <Link
          href="/account/wishlist"
          className="group bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:border-brand/40 hover:shadow-md transition-all flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Heart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Wishlist
            </p>
            <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
              {wishlistIds.length} {wishlistIds.length === 1 ? "Item" : "Items"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              Your saved riding gear
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand transition-colors shrink-0" />
        </Link>
      </section>

      {/* ================================================================
          3. LATEST ORDER LIVE SNAPSHOT (if user has any orders)
          ================================================================ */}
      {latestOrder && latestOrderId && latestStatus && (
        <section
          aria-label="Recent order"
          className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Latest Order
              </span>
              <span className="font-mono text-xs font-bold text-slate-800">
                #{latestOrder.orderNumber || String(latestOrderId).slice(-8).toUpperCase()}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${latestStatus.classes}`}
            >
              {latestStatus.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-50 border border-slate-100 shrink-0 overflow-hidden">
              <Image
                src={latestOrderImg}
                alt={latestFirstItem?.name || "Ordered product"}
                fill
                sizes="64px"
                className="object-contain p-1 mix-blend-multiply"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-1">
                {latestFirstItem?.name || latestFirstItem?.product?.name || "Motorcycle Riding Gear"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatPrice(latestOrder.pricing?.total || latestOrder.totalAmount || 0)}
                {latestOrder.items?.length > 1
                  ? ` • +${latestOrder.items.length - 1} more`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {["processing", "packed", "shipped"].includes(
                String(latestOrder.status || "").toLowerCase()
              ) && (
                <Link
                  href={`/account/orders/${latestOrderId}/tracking`}
                  className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg border border-slate-200 hover:border-slate-900 text-xs font-bold text-slate-800 transition-colors"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Track</span>
                </Link>
              )}
              <Link
                href={`/account/orders/${latestOrderId}`}
                className="inline-flex items-center gap-1 min-h-[40px] px-3.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors"
              >
                <span>View</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          4. PERSONAL INFORMATION CARD (Flipkart Inline View / Edit)
          ================================================================ */}
      <section
        ref={personalInfoRef}
        id="personal-info"
        aria-labelledby="personal-info-heading"
        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="personal-info-heading"
              className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-brand shrink-0" />
              <span>Personal Information</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Your name and contact details used for deliveries &amp; updates.
            </p>
          </div>

          {!isEditing ? (
            <button
              type="button"
              onClick={startEditingProfile}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg border border-slate-200 hover:border-brand hover:text-brand text-xs font-bold text-slate-700 bg-white transition-colors shrink-0 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={updateProfileMutation.isPending}
              className="inline-flex items-center min-h-[40px] px-3.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          {!isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* First Name */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 px-4 py-3">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  First Name
                </span>
                <span className="block text-sm font-semibold text-slate-900 mt-1">
                  {user?.firstName || "Not set"}
                </span>
              </div>

              {/* Last Name */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 px-4 py-3">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Last Name
                </span>
                <span className="block text-sm font-semibold text-slate-900 mt-1">
                  {user?.lastName || "Not set"}
                </span>
              </div>

              {/* Email */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Email Address
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {user?.email || ""}
                  </span>
                </div>
              </div>

              {/* Phone */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 px-4 py-3">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Mobile Number
                </span>
                {user?.phone ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-900">
                      {user.phone}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startEditingProfile}
                    className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline cursor-pointer"
                  >
                    + Add mobile number
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmitProfile, onProfileInvalid)}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Input
                  label="First Name"
                  autoComplete="given-name"
                  enterKeyHint="next"
                  {...firstNameRegisterProps}
                  ref={(el) => {
                    firstNameRegisterRef(el);
                    firstNameInputRef.current = el;
                  }}
                  error={errors.firstName?.message as string}
                />
                <Input
                  label="Last Name"
                  autoComplete="family-name"
                  enterKeyHint="next"
                  {...register("lastName")}
                  error={errors.lastName?.message as string}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <Input
                  label="Email Address"
                  type="email"
                  autoComplete="email"
                  value={user?.email || ""}
                  disabled
                  leftIcon={<Mail className="w-4 h-4" />}
                  hint="Primary login email cannot be changed."
                />

                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      label="Phone Number"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.phone?.message as string}
                    />
                  )}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={updateProfileMutation.isPending}
                  className="w-full sm:w-auto min-h-[46px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={updateProfileMutation.isPending}
                  disabled={!isDirty && !updateProfileMutation.isPending}
                  className="w-full sm:w-auto px-8 min-h-[46px]"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ================================================================
          5. DEFAULT DELIVERY ADDRESS PREVIEW CARD
          ================================================================ */}
      <section
        aria-label="Default delivery address"
        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Delivery Address
              </h3>
              {defaultAddress && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                  Default
                </span>
              )}
            </div>
            {defaultAddress ? (
              <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2">
                {defaultAddress.street}, {defaultAddress.city}, {defaultAddress.state} –{" "}
                <strong className="text-slate-900">{defaultAddress.pincode}</strong>
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                No saved delivery address yet. Add one for faster checkout.
              </p>
            )}
          </div>
        </div>

        <Link
          href="/account/addresses"
          className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 rounded-lg border border-slate-200 hover:border-brand hover:text-brand text-xs font-bold text-slate-700 transition-colors shrink-0"
        >
          <span>{defaultAddress ? "Manage Addresses" : "+ Add Address"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* ================================================================
          6. PASSWORD & SECURITY CARD (Disclosure Pattern)
          ================================================================ */}
      <section
        ref={securityRef}
        id="security"
        aria-labelledby="security-heading"
        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-brand" />
            </div>
            <div className="min-w-0">
              <h2
                id="security-heading"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                Password &amp; Security
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your password to keep your account secure.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-expanded={isSecurityOpen}
            aria-controls="change-password-panel"
            onClick={() => setIsSecurityOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-lg border border-slate-200 hover:border-slate-900 text-xs font-bold text-slate-800 bg-white transition-colors shrink-0 cursor-pointer"
          >
            <span>{isSecurityOpen ? "Close" : "Change Password"}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isSecurityOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {isSecurityOpen && (
          <div
            id="change-password-panel"
            className="px-4 sm:px-6 pb-5 pt-4 border-t border-slate-100"
          >
            <form
              onSubmit={handlePasswordSubmit(onSubmitPassword, onPasswordInvalid)}
              className="flex flex-col gap-4 max-w-xl"
              noValidate
            >
              <Input
                label="Current Password"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="next"
                {...registerPassword("currentPassword")}
                error={passwordErrors.currentPassword?.message}
                rightElement={
                  <button
                    type="button"
                    aria-pressed={showCurrentPassword}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {/* Password complexity checklist placed above inputs so mobile keyboards don't cover it */}
              <div
                id="new-password-rules"
                className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Password Requirements
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {[
                    { met: hasMinLength, label: "Minimum 8 characters" },
                    { met: hasNumber, label: "At least 1 number (0-9)" },
                    { met: hasUpperAndLowerCase, label: "Uppercase & lowercase letters" },
                    { met: hasSymbol, label: "At least 1 special symbol (@, #, !, etc.)" },
                  ].map((rule) => (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 ${
                        rule.met ? "text-emerald-700 font-medium" : "text-slate-500"
                      }`}
                    >
                      {rule.met ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                      )}
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  aria-describedby="new-password-rules"
                  {...registerPassword("newPassword")}
                  error={passwordErrors.newPassword?.message}
                  rightElement={
                    <button
                      type="button"
                      aria-pressed={showNewPassword}
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <Input
                  label="Confirm New Password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  hint="Re-enter your new password to confirm."
                  {...registerPassword("confirmPassword")}
                  error={passwordErrors.confirmPassword?.message}
                  rightElement={
                    <button
                      type="button"
                      aria-pressed={showConfirmPassword}
                      aria-label={
                        showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                      }
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:justify-start gap-2.5">
                <Button
                  type="submit"
                  isLoading={changePasswordMutation.isPending}
                  disabled={changePasswordMutation.isPending}
                  className="w-full sm:w-auto min-h-[46px] bg-slate-900 hover:bg-black text-white px-7 font-bold text-xs uppercase tracking-wider"
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* ================================================================
          7. MOBILE HELP, POLICIES & SIGN OUT (< lg)
          ================================================================ */}
      <section className="lg:hidden flex flex-col gap-3.5" aria-label="Help and account actions">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100">
          <div className="px-4 py-2.5 bg-slate-50/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Help &amp; Information
            </span>
          </div>

          <Link
            href="/contact-store4riders"
            className="flex items-center justify-between px-4 py-3.5 min-h-[48px] active:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <Headphones className="w-4 h-4 text-slate-500" />
              <span>Rider Support &amp; Help Center</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            href="/returns-replacements-store4riders"
            className="flex items-center justify-between px-4 py-3.5 min-h-[48px] active:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Exchange &amp; Return Policy</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>

          <Link
            href="/shipping-policies-store4riders"
            className="flex items-center justify-between px-4 py-3.5 min-h-[48px] active:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-slate-800">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Shipping &amp; Delivery Policies</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="w-full min-h-[48px] rounded-xl bg-white border border-red-200 text-red-600 font-bold text-sm flex items-center justify-center gap-2 shadow-2xs active:bg-red-50 transition-colors cursor-pointer disabled:opacity-60"
        >
          <LogOut className="w-4 h-4" />
          <span>{logoutMutation.isPending ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </section>
    </div>
  );
}

export function ProfileForm() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-28 bg-white rounded-xl border border-slate-200" />
          <div className="h-64 bg-white rounded-xl border border-slate-200" />
        </div>
      }
    >
      <ProfileHubInner />
    </Suspense>
  );
}
