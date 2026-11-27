"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Package,
  Heart,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Lock,
  Headphones,
  FolderHeart,
  UserCog,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogout } from "@/core/hooks/useAuth";
import { useMyOrders, useProfile } from "@/core/hooks/useAccount";
import { useWishlist } from "@/core/hooks/useWishlist";
import { getOrderExchangesList } from "@store4riders/shared-utils";

function SidebarNavContent() {
  const { user, isAuthenticated, isLoggingOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const logoutMutation = useLogout();
  const { data: profileUser } = useProfile();
  const { data: orders = [] } = useMyOrders();
  const { data: wishlistIds = [] } = useWishlist();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLoggingOut) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/account")}`);
    }
  }, [mounted, isAuthenticated, isLoggingOut, pathname, router]);

  const activeUser = profileUser || user;

  const counts = useMemo(() => {
    const exchanges = orders.filter(
      (o: any) =>
        ["return_requested", "return_approved", "return_picked", "returned"].includes(
          String(o.status || "").toLowerCase()
        ) ||
        Boolean(o.exchangeDetails?.stage) ||
        getOrderExchangesList(o).length > 0
    ).length;

    return {
      orders: orders.length,
      exchanges,
      addresses: activeUser?.addresses?.length || 0,
      wishlist: wishlistIds.length,
    };
  }, [orders, activeUser?.addresses, wishlistIds]);

  if (!mounted || !isAuthenticated || !activeUser) return null;

  const legacyName = "name" in activeUser && typeof activeUser.name === "string" ? activeUser.name : undefined;
  const displayName = activeUser.firstName
    ? `${activeUser.firstName} ${activeUser.lastName || ""}`.trim()
    : legacyName || activeUser.email || "Rider";
  const initial = displayName.charAt(0).toUpperCase();

  const currentTab = searchParams?.get("tab");
  const currentSection = searchParams?.get("section");
  const isExchangesActive = pathname.startsWith("/account/orders") && currentTab === "exchanges";
  const isOrdersActive = pathname.startsWith("/account/orders") && !isExchangesActive;
  const isProfileActive = pathname === "/account" && currentSection !== "security";
  const isSecurityActive = pathname === "/account" && currentSection === "security";
  const isAddressesActive = pathname.startsWith("/account/addresses");
  const isWishlistActive = pathname.startsWith("/account/wishlist");

  const navLinkClass = (active: boolean) =>
    `relative flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-150 border-l-[3px] ${
      active
        ? "border-brand bg-brand/[0.06] text-brand font-semibold"
        : "border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
    }`;

  return (
    <aside
      className="hidden lg:block w-72 xl:w-[296px] shrink-0 lg:sticky lg:top-[84px] lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto scrollbar-none"
      aria-label="Account sidebar"
    >
      <div className="flex flex-col gap-3">
        {/* 1. Hello Rider Card (Flipkart-style header card) */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-red-800 text-white flex items-center justify-center font-bold text-lg shadow-sm ring-2 ring-brand/15">
              {initial}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center"
              title="Verified Account"
            >
              <span className="sr-only">Verified</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-slate-500 leading-none mb-1">Hello,</p>
            <h2 className="text-base font-bold text-slate-900 truncate leading-tight">
              {displayName}
            </h2>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{activeUser.email}</p>
          </div>
        </div>

        {/* 2. Categorized Account Navigation Card */}
        <nav
          aria-label="Account navigation"
          className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100"
        >
          {/* MY ORDERS */}
          <div>
            <Link
              href="/account/orders"
              aria-current={isOrdersActive ? "page" : undefined}
              className={`flex items-center justify-between px-4 py-3.5 transition-colors border-l-[3px] ${
                isOrdersActive
                  ? "border-brand bg-brand/[0.06] text-brand"
                  : "border-transparent text-slate-800 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Package
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isOrdersActive ? "text-brand" : "text-brand/80"
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wider">My Orders</span>
              </span>
              <span className="flex items-center gap-2">
                {counts.orders > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {counts.orders}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </span>
            </Link>
          </div>

          {/* ACCOUNT SETTINGS */}
          <div className="py-1.5">
            <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <UserCog className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Account Settings</span>
            </div>
            <Link
              href="/account"
              aria-current={isProfileActive ? "page" : undefined}
              className={navLinkClass(isProfileActive)}
            >
              <span className="flex items-center gap-3 pl-1">
                <User className="w-4 h-4 shrink-0 opacity-75" />
                <span>Profile Information</span>
              </span>
            </Link>
            <Link
              href="/account/addresses"
              aria-current={isAddressesActive ? "page" : undefined}
              className={navLinkClass(isAddressesActive)}
            >
              <span className="flex items-center gap-3 pl-1">
                <MapPin className="w-4 h-4 shrink-0 opacity-75" />
                <span>Manage Addresses</span>
              </span>
              {counts.addresses > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {counts.addresses}
                </span>
              )}
            </Link>
            <Link
              href="/account?section=security"
              aria-current={isSecurityActive ? "page" : undefined}
              className={navLinkClass(isSecurityActive)}
            >
              <span className="flex items-center gap-3 pl-1">
                <Lock className="w-4 h-4 shrink-0 opacity-75" />
                <span>Password & Security</span>
              </span>
            </Link>
          </div>

          {/* MY STUFF */}
          <div className="py-1.5">
            <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <FolderHeart className="w-4 h-4 text-slate-400 shrink-0" />
              <span>My Stuff</span>
            </div>
            <Link
              href="/account/wishlist"
              aria-current={isWishlistActive ? "page" : undefined}
              className={navLinkClass(isWishlistActive)}
            >
              <span className="flex items-center gap-3 pl-1">
                <Heart className="w-4 h-4 shrink-0 opacity-75" />
                <span>My Wishlist</span>
              </span>
              {counts.wishlist > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                  {counts.wishlist}
                </span>
              )}
            </Link>
            <Link
              href="/account/orders?tab=exchanges"
              aria-current={isExchangesActive ? "page" : undefined}
              className={navLinkClass(isExchangesActive)}
            >
              <span className="flex items-center gap-3 pl-1">
                <RefreshCw className="w-4 h-4 shrink-0 opacity-75" />
                <span>Exchanges & Returns</span>
              </span>
              {counts.exchanges > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {counts.exchanges}
                </span>
              )}
            </Link>
          </div>

          {/* HELP & SIGN OUT */}
          <div className="py-1.5">
            <Link
              href="/contact-store4riders"
              className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <span className="flex items-center gap-3 pl-1">
                <Headphones className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Rider Support</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60"
            >
              <LogOut className="w-4 h-4 text-red-500 shrink-0" />
              <span>{logoutMutation.isPending ? "Signing Out..." : "Sign Out"}</span>
            </button>
          </div>
        </nav>

        {/* Trust Footer Badge */}
        <div className="px-4 py-3 bg-white/70 rounded-xl border border-slate-200/70 flex items-center gap-2.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>100% Secure Account & Encrypted Data</span>
        </div>
      </div>
    </aside>
  );
}

export function AccountSidebar() {
  return (
    <Suspense fallback={<div className="hidden lg:block w-72 xl:w-[296px] shrink-0" />}>
      <SidebarNavContent />
    </Suspense>
  );
}
