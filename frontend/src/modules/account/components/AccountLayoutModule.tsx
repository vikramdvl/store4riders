"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Package, MapPin, Heart, User } from "lucide-react";
import { AccountSidebar } from "@/modules/account/components/AccountSidebar";
import TopBanner from "@/modules/homepage/components/TopBanner";
import Navbar from "@/modules/homepage/components/Navbar";
import Footer from "@/modules/homepage/components/Footer";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { useAuthStore } from "@/stores/useAuthStore";

function MobileSubPageBar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const isRootAccount = pathname === "/account";

  const { title, backHref, backLabel } = useMemo(() => {
    if (pathname.endsWith("/tracking")) {
      const orderDetailHref = pathname.replace(/\/tracking$/, "");
      return {
        title: "Track Shipment",
        backHref: orderDetailHref,
        backLabel: "Back to order details",
      };
    }
    if (pathname.startsWith("/account/orders/") && pathname !== "/account/orders") {
      return {
        title: "Order Details",
        backHref: "/account/orders",
        backLabel: "Back to all orders",
      };
    }
    if (pathname.startsWith("/account/orders")) {
      const isExchanges = searchParams?.get("tab") === "exchanges";
      return {
        title: isExchanges ? "Exchanges & Returns" : "My Orders",
        backHref: "/account",
        backLabel: "Back to My Account",
      };
    }
    if (pathname.startsWith("/account/addresses")) {
      return {
        title: "Saved Addresses",
        backHref: "/account",
        backLabel: "Back to My Account",
      };
    }
    if (pathname.startsWith("/account/wishlist")) {
      return {
        title: "My Wishlist",
        backHref: "/account",
        backLabel: "Back to My Account",
      };
    }
    return {
      title: "My Account",
      backHref: "/",
      backLabel: "Back to home",
    };
  }, [pathname, searchParams]);

  if (isRootAccount) {
    return null;
  }

  return (
    <div className="lg:hidden sticky top-[58px] sm:top-[64px] z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="inline-flex items-center justify-center w-10 h-10 -ml-1 rounded-full text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-heading font-bold text-base text-slate-900 truncate">
            {title}
          </span>
        </div>

        <nav aria-label="Quick account shortcuts" className="flex items-center gap-1 shrink-0">
          <Link
            href="/account"
            aria-label="Account Hub"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full text-slate-600 hover:bg-slate-100 hover:text-brand transition-colors"
          >
            <User className="w-[18px] h-[18px]" />
          </Link>
          <Link
            href="/account/orders"
            aria-label="My Orders"
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
              pathname.startsWith("/account/orders")
                ? "bg-brand/10 text-brand"
                : "text-slate-600 hover:bg-slate-100 hover:text-brand"
            }`}
          >
            <Package className="w-[18px] h-[18px]" />
          </Link>
          <Link
            href="/account/addresses"
            aria-label="Saved Addresses"
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
              pathname.startsWith("/account/addresses")
                ? "bg-brand/10 text-brand"
                : "text-slate-600 hover:bg-slate-100 hover:text-brand"
            }`}
          >
            <MapPin className="w-[18px] h-[18px]" />
          </Link>
          <Link
            href="/account/wishlist"
            aria-label="My Wishlist"
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
              pathname.startsWith("/account/wishlist")
                ? "bg-brand/10 text-brand"
                : "text-slate-600 hover:bg-slate-100 hover:text-brand"
            }`}
          >
            <Heart className="w-[18px] h-[18px]" />
          </Link>
        </nav>
      </div>
    </div>
  );
}

export const AccountLayoutModule = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { isAuthenticated, isLoggingOut } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLoggingOut) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/account")}`);
    }
  }, [mounted, isAuthenticated, isLoggingOut, pathname, router]);

  const paths = pathname.split("/").filter(Boolean);

  const breadcrumbItems: { label: string; href?: string }[] = [{ label: "HOME", href: "/" }];

  if (paths[0] === "account") {
    breadcrumbItems.push({
      label: "MY ACCOUNT",
      href: paths.length > 1 ? "/account" : undefined,
    });
    if (paths[1]) {
      breadcrumbItems.push({
        label: paths[1].replace("-", " ").toUpperCase(),
        href: paths.length > 2 ? `/account/${paths[1]}` : undefined,
      });
    }
    if (paths[2]) {
      breadcrumbItems.push({
        label: paths[3] === "tracking" ? "TRACK SHIPMENT" : `ORDER #${paths[2].slice(-6).toUpperCase()}`,
      });
    }
  }

  if (!mounted || !isAuthenticated) {
    return (
      <div className="w-full min-h-screen flex flex-col font-sans bg-[#f1f3f6] antialiased selection:bg-brand selection:text-white">
        <header>
          <TopBanner
            message="Discount 20% For New Member,"
            highlightText="ONLY FOR TODAY!!"
          />
        </header>

        <div className="w-full bg-[#161616] sticky top-0 z-40 border-b border-[#2a2a2a] shadow-sm">
          <Navbar theme="dark-solid" logoText="Store4Riders" />
        </div>

        <main className="flex-1 w-full flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">
            Please sign in to access your account...
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col font-sans bg-[#f1f3f6] antialiased selection:bg-brand selection:text-white">
      {/* 1. Top Announcement Bar */}
      <header>
        <TopBanner
          message="Discount 20% For New Member,"
          highlightText="ONLY FOR TODAY!!"
        />
      </header>

      {/* 2. Standard Header Navigation (Dark Solid Theme) */}
      <div className="w-full bg-[#161616] sticky top-0 z-40 border-b border-[#2a2a2a] shadow-sm">
        <Navbar theme="dark-solid" logoText="Store4Riders" />
      </div>

      {/* Desktop Breadcrumb */}
      <div className="hidden lg:block">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Mobile Sticky Sub-Page Navigation Bar */}
      <Suspense fallback={null}>
        <MobileSubPageBar />
      </Suspense>

      <main className="flex-1 w-full relative z-0">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 flex flex-col lg:flex-row gap-5 lg:gap-6 max-w-7xl">
          <AccountSidebar />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
