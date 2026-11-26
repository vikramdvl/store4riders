"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@store4riders/shared-utils";
import { useAdminPaymentLogs } from "@/core/hooks/useSystemHealth";

const getPaymentStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case "captured":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    case "refunded":
    case "partially_refunded":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export function PaymentLogsTab({ enabled }: { enabled: boolean }) {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { data, isLoading } = useAdminPaymentLogs(page, limit, enabled);

  const logs = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-900">Payment Gateway Transactions</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Recent PayU, CCAvenue, Snapmint, and UPI payment attempts and webhook statuses.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Gateway</th>
              <th className="py-3 px-4">Order Ref</th>
              <th className="py-3 px-4">Gateway Txn ID</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  Loading payment logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  No payment transactions found.
                </td>
              </tr>
            ) : (
              logs.map((item) => (
                <tr key={item._id || item.id || item.gatewayOrderId} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {format(new Date(item.createdAt), "dd MMM yyyy, hh:mm:ss a")}
                  </td>
                  <td className="py-3 px-4 font-semibold uppercase text-slate-800">
                    {item.gateway}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">{item.orderId}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {item.gatewayPaymentId || item.gatewayOrderId}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {formatPrice(item.amount || 0)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${getPaymentStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
        <div>
          {totalCount > 0
            ? `Showing ${(page - 1) * limit + 1} – ${Math.min(page * limit, totalCount)} of ${totalCount}`
            : "0 transactions"}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <span className="font-medium text-slate-700">
            Page {page} of {Math.max(1, totalPages)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
