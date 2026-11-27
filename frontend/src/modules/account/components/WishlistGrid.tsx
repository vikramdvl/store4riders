"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import ProductCard from "@/components/ProductCard";
import { Heart, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";

export function WishlistGrid() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await apiClient.get("/wishlist/me");
      const productIds = res.data.data?.productIds || [];

      if (productIds.length === 0) return [];

      const productsRes = await Promise.all(
        productIds.map((id: string) => apiClient.get(`/products/${id}`).catch(() => null))
      );

      return productsRes.filter(Boolean).map((r) => r?.data?.data);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-16 bg-white rounded-xl border border-slate-200 p-4" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-2.5"
            >
              <div className="aspect-square bg-slate-100 rounded-xl" />
              <div className="h-4 w-3/4 bg-slate-100 rounded" />
              <div className="h-5 w-1/2 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-14 px-4 text-center bg-white border border-red-100 rounded-xl shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Failed to load wishlist</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please check your connection and try again.
        </p>
        <Button onClick={() => refetch()} className="min-h-[44px] px-6">
          Try Again
        </Button>
      </div>
    );
  }

  const products = data || [];

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full text-rose-400 flex items-center justify-center mb-1">
          <Heart size={32} strokeWidth={1.5} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Your wishlist is empty</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-3">
          Tap the heart icon on any helmet, jacket, or riding gear to save it here for later.
        </p>
        <Link href="/products">
          <Button className="min-h-[44px] px-7">Explore Riding Gear</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">My Wishlist</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
              {products.length} {products.length === 1 ? "Item" : "Items"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Saved helmets, jackets, boots &amp; accessories ready to move to cart.
          </p>
        </div>
        <Link
          href="/products"
          className="hidden sm:inline-flex items-center min-h-[40px] px-4 rounded-lg border border-slate-200 hover:border-brand hover:text-brand text-xs font-bold text-slate-700 transition-colors shrink-0"
        >
          Browse More
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {products.map((product: any) => (
          <ProductCard key={product._id || product.id} product={product} showBuyNow />
        ))}
      </div>
    </div>
  );
}
