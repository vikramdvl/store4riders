export default function GuidePostLoading() {
  return (
    <article className="min-h-screen bg-neutral-50/50 pb-24">
      <div className="bg-white border-b border-neutral-200/80 pt-10 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 animate-pulse">
          <div className="h-4 w-36 bg-neutral-200 rounded" />
          <div className="h-7 w-40 bg-neutral-100 rounded-full" />
          <div className="h-10 w-5/6 bg-neutral-200 rounded-xl" />
          <div className="h-5 w-2/3 bg-neutral-100 rounded" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 space-y-8 animate-pulse">
        <div className="aspect-[16/9] w-full rounded-2xl bg-neutral-200" />
        <div className="bg-white rounded-2xl p-8 border border-neutral-200/80 space-y-3">
          <div className="h-4 w-full bg-neutral-100 rounded" />
          <div className="h-4 w-11/12 bg-neutral-100 rounded" />
          <div className="h-4 w-4/5 bg-neutral-100 rounded" />
          <div className="h-4 w-full bg-neutral-100 rounded" />
        </div>
      </div>
    </article>
  );
}
