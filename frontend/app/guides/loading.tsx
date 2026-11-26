export default function GuidesLoading() {
  return (
    <div className="min-h-screen bg-neutral-50/60 pb-20">
      <div className="bg-white border-b border-neutral-200/80 py-14">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-4 animate-pulse">
          <div className="h-4 w-48 bg-neutral-200 rounded-full" />
          <div className="h-10 w-2/3 max-w-xl bg-neutral-200 rounded-xl" />
          <div className="h-4 w-full max-w-2xl bg-neutral-100 rounded-lg" />
          <div className="h-12 w-full max-w-xl bg-neutral-100 rounded-xl mt-4" />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/10] w-full bg-neutral-200" />
              <div className="p-6 space-y-3">
                <div className="h-3 w-28 bg-neutral-100 rounded" />
                <div className="h-5 w-full bg-neutral-200 rounded" />
                <div className="h-4 w-5/6 bg-neutral-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
