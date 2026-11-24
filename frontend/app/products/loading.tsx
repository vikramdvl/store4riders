/**
 * @file ProductsLoading
 * @description Pixel-perfect loading skeleton for Category and Product Listing Pages.
 * Matches the exact layout of the CatalogModule: Desktop Sidebar Filters + Product Cards Grid.
 */
export default function ProductsLoading() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Top Header Placeholder */}
      <div className="h-10 bg-neutral-50 animate-pulse border-b border-neutral-100" />
      <div className="h-14 bg-white border-b border-neutral-200" />

      {/* Main Container */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-4 pb-20">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-12 bg-neutral-100 rounded animate-pulse" />
          <div className="h-3 w-3 bg-neutral-100 rounded animate-pulse" />
          <div className="h-3 w-28 bg-neutral-100 rounded animate-pulse" />
        </div>

        {/* Page Title Skeleton */}
        <div className="mb-6">
          <div className="h-8 w-48 sm:w-64 bg-neutral-200 rounded animate-pulse" />
        </div>

        {/* Catalog Main Layout: Desktop Sidebar Filters + Right Product Grid */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start mt-4">
          
          {/* Left Sidebar Filters Skeleton (Desktop Only) */}
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0 space-y-6">
            <div className="space-y-3 pb-3 border-b border-neutral-100">
              <div className="h-5 w-24 bg-neutral-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-neutral-100 rounded animate-pulse" />
            </div>

            {/* Filter Section Skeletons (Brand, Size, Price, Color) */}
            {[1, 2, 3, 4].map((section) => (
              <div key={section} className="border-b border-neutral-200 py-3.5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse" />
                  <div className="h-4 w-4 bg-neutral-100 rounded animate-pulse" />
                </div>
                <div className="space-y-2.5 pt-1">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 bg-neutral-100 rounded-sm animate-pulse" />
                        <div className="h-3.5 w-24 bg-neutral-100 rounded animate-pulse" />
                      </div>
                      <div className="h-3 w-6 bg-neutral-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {/* Right Product Grid Area */}
          <section className="flex-1 w-full min-w-0">
            {/* Sort & Count Header */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-100 mb-4 sm:mb-6">
              <div className="h-3.5 w-28 bg-neutral-100 rounded animate-pulse" />
              <div className="h-7 w-24 sm:w-32 bg-neutral-100 rounded animate-pulse" />
            </div>

            {/* Grid of Product Cards: 2 cols on mobile, 3 cols on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6 md:gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="flex flex-col gap-2.5">
                  <div className="aspect-[3/4] bg-neutral-100 rounded-lg animate-pulse" />
                  <div className="h-3 w-16 bg-neutral-100 rounded animate-pulse mt-0.5" />
                  <div className="h-4 w-4/5 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
