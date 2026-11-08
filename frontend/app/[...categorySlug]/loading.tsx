/**
 * @file loading.tsx
 * @description Instantaneous loading skeleton for /[...categorySlug] (Product Detail Page & Category Page).
 * Eliminates click delay and provides 0ms perceived response time.
 */
export default function CategoryOrProductLoading() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Skeleton top navigation bar */}
      <div className="h-10 bg-neutral-50 animate-pulse border-b border-neutral-100" />
      <div className="h-14 bg-white border-b border-neutral-200" />

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 pb-16">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-3 w-16 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-3 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-3 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-36 bg-neutral-200 rounded animate-pulse" />
        </div>

        {/* Product / Category Dual layout skeleton */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left Gallery / Main Container skeleton */}
          <div className="w-full lg:w-[45%]">
            <div className="aspect-square w-full bg-neutral-100 rounded-xl animate-pulse" />
            <div className="flex gap-3 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-20 h-20 bg-neutral-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>

          {/* Right Product Info skeleton */}
          <div className="w-full lg:w-[55%] space-y-4 pt-2">
            <div className="h-4 w-28 bg-neutral-100 rounded animate-pulse" />
            <div className="h-8 w-4/5 bg-neutral-100 rounded animate-pulse" />
            <div className="h-7 w-36 bg-neutral-100 rounded animate-pulse" />
            <div className="h-12 w-full bg-neutral-100 rounded-lg animate-pulse mt-6" />
            <div className="h-12 w-full bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-28 w-full bg-neutral-100 rounded-lg animate-pulse mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
