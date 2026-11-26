export default function GuidePostLoading() {
  return (
    <article className="min-h-screen bg-neutral-50/50 pb-20">
      {/* Breadcrumb Skeleton */}
      <div className="bg-white border-b border-neutral-200/60 py-3">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 animate-pulse">
          <div className="h-3 w-10 bg-neutral-100 rounded" />
          <div className="h-3 w-2 bg-neutral-100 rounded" />
          <div className="h-3 w-14 bg-neutral-100 rounded" />
          <div className="h-3 w-2 bg-neutral-100 rounded" />
          <div className="h-3 w-32 bg-neutral-200 rounded" />
        </div>
      </div>

      <div className="bg-white border-b border-neutral-200/80 pt-6 pb-7 sm:pt-7 sm:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-neutral-200 rounded" />
            <div className="h-6 w-32 bg-neutral-100 rounded-full" />
          </div>
          <div className="h-8 w-5/6 bg-neutral-200 rounded-xl" />
          <div className="h-4 w-2/3 bg-neutral-100 rounded" />
          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-neutral-200" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-neutral-200 rounded" />
                <div className="h-2.5 w-20 bg-neutral-100 rounded" />
              </div>
            </div>
            <div className="h-3 w-36 bg-neutral-100 rounded" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-7 animate-pulse">
        <div className="aspect-[16/9] max-h-[420px] w-full rounded-xl bg-neutral-200" />
        <div className="bg-white rounded-xl p-5 sm:p-7 lg:p-9 border border-neutral-200/80 space-y-3">
          <div className="h-4 w-full bg-neutral-100 rounded" />
          <div className="h-4 w-11/12 bg-neutral-100 rounded" />
          <div className="h-4 w-4/5 bg-neutral-100 rounded" />
          <div className="h-4 w-full bg-neutral-100 rounded" />
        </div>
      </div>
    </article>
  );
}
