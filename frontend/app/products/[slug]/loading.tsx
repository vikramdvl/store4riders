/**
 * Next.js App Router loading.tsx — pixel-perfect PDP loading skeleton.
 * Gallery on the left (with thumbnails) + Product details & selectors on the right.
 */
export default function ProductDetailLoading() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Top Banner Placeholder */}
      <div className="h-10 bg-neutral-50 animate-pulse border-b border-neutral-100" />
      <div className="h-14 bg-white border-b border-neutral-200" />

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-4 pb-20">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-12 bg-neutral-100 rounded animate-pulse" />
          <div className="h-3 w-3 bg-neutral-100 rounded animate-pulse" />
          <div className="h-3 w-24 bg-neutral-100 rounded animate-pulse" />
          <div className="h-3 w-3 bg-neutral-100 rounded animate-pulse" />
          <div className="h-3 w-36 bg-neutral-100 rounded animate-pulse" />
        </div>

        {/* Main 2-Column Product Detail Layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start mt-2">
          {/* Left: Gallery Skeleton */}
          <div className="w-full lg:w-[45%] xl:w-[48%] shrink-0">
            {/* Main Image */}
            <div className="aspect-square bg-neutral-100 rounded-xl animate-pulse w-full border border-neutral-100" />
            {/* Thumbnails */}
            <div className="flex gap-3 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-100 rounded-lg animate-pulse border border-neutral-100"
                />
              ))}
            </div>
          </div>

          {/* Right: Product Info Skeleton */}
          <div className="w-full lg:w-[55%] xl:w-[52%] flex flex-col space-y-4 pt-1">
            {/* Brand + Rating Row */}
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-neutral-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-neutral-100 rounded animate-pulse" />
            </div>

            {/* Product Title (2 lines) */}
            <div className="space-y-2">
              <div className="h-7 w-5/6 bg-neutral-200 rounded animate-pulse" />
              <div className="h-7 w-2/3 bg-neutral-200 rounded animate-pulse" />
            </div>

            {/* Price Row */}
            <div className="flex items-baseline gap-3 pt-1">
              <div className="h-8 w-32 bg-neutral-200 rounded animate-pulse" />
              <div className="h-5 w-20 bg-neutral-100 rounded animate-pulse" />
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2.5 py-1">
              <div className="h-10 bg-neutral-50 rounded-lg animate-pulse border border-neutral-100" />
              <div className="h-10 bg-neutral-50 rounded-lg animate-pulse border border-neutral-100" />
              <div className="h-10 bg-neutral-50 rounded-lg animate-pulse border border-neutral-100" />
            </div>

            {/* Short Description Lines */}
            <div className="space-y-2 py-2">
              <div className="h-3.5 w-full bg-neutral-100 rounded animate-pulse" />
              <div className="h-3.5 w-11/12 bg-neutral-100 rounded animate-pulse" />
              <div className="h-3.5 w-3/4 bg-neutral-100 rounded animate-pulse" />
            </div>

            {/* Color Selector Skeleton */}
            <div className="space-y-2 pt-1">
              <div className="h-3.5 w-24 bg-neutral-100 rounded animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-neutral-100 animate-pulse border border-neutral-200" />
                ))}
              </div>
            </div>

            {/* Size Selector Skeleton */}
            <div className="space-y-2 pt-1">
              <div className="h-3.5 w-20 bg-neutral-100 rounded animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-9 w-12 rounded-md bg-neutral-100 animate-pulse border border-neutral-200" />
                ))}
              </div>
            </div>

            {/* Add to Cart / CTA Skeleton */}
            <div className="flex gap-3 pt-3">
              <div className="h-12 flex-1 rounded-full bg-neutral-200 animate-pulse" />
              <div className="h-12 w-12 rounded-full bg-neutral-100 animate-pulse border border-neutral-200" />
            </div>
          </div>
        </div>

        {/* Complete Your Kit / Related Section Skeleton */}
        <div className="mt-16 pt-8 border-t border-neutral-100">
          <div className="h-5 w-44 bg-neutral-200 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
