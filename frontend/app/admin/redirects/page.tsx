import { Suspense } from "react";
import AdminUrlRedirectsManager from "@/modules/admin/components/AdminUrlRedirectsManager";

export const metadata = {
  title: "Page Redirects (301/302) | Admin | Store4Riders",
  description: "Manage HTTP 301/302 URL redirects and automatic slug-change redirects.",
};

export default function AdminUrlRedirectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Page Redirects (301 / 302)
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Redirect old or renamed URLs to active store pages without 404 errors, and review automatic slug-change redirects.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="bg-white p-8 rounded-xl border border-neutral-200 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-neutral-500 font-medium text-sm">Loading page redirects console...</p>
          </div>
        }
      >
        <AdminUrlRedirectsManager />
      </Suspense>
    </div>
  );
}
