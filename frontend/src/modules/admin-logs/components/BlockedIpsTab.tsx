"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Ban, Plus, ShieldCheck } from "lucide-react";
import { IBlockedIp } from "@store4riders/shared-types";

interface BlockedIpsTabProps {
  items: IBlockedIp[];
  isLoading: boolean;
  isBlocking: boolean;
  isUnblocking: boolean;
  onBlockIp: (payload: { ip: string; reason: string; durationHours: 1 | 24 | 168 | null }) => void;
  onUnblockIp: (ipOrId: string) => void;
}

export function BlockedIpsTab({
  items,
  isLoading,
  isBlocking,
  isUnblocking,
  onBlockIp,
  onUnblockIp,
}: BlockedIpsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [ipInput, setIpInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [durationHours, setDurationHours] = useState<1 | 24 | 168 | null>(24);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipInput.trim() || !reasonInput.trim()) return;
    onBlockIp({
      ip: ipInput.trim(),
      reason: reasonInput.trim(),
      durationHours,
    });
    setIpInput("");
    setReasonInput("");
    setShowAddForm(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Blocked IP Addresses</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Requests from these IPs are rejected immediately with HTTP 403 before reaching application routes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Block IP Address
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs"
        >
          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">IP Address</label>
            <input
              type="text"
              required
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="e.g. 103.21.10.5"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block font-semibold text-slate-700 mb-1">Reason</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={300}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Repeated failed admin login attempts"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Duration</label>
            <select
              value={durationHours === null ? "permanent" : String(durationHours)}
              onChange={(e) => {
                const val = e.target.value;
                setDurationHours(val === "permanent" ? null : (Number(val) as 1 | 24 | 168));
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
            >
              <option value="1">1 Hour</option>
              <option value="24">24 Hours</option>
              <option value="168">7 Days</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isBlocking}
              className="w-full px-3 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 cursor-pointer"
            >
              {isBlocking ? "Saving..." : "Confirm Block"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Blocked By</th>
              <th className="py-3 px-4">Expires</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  Loading blocked IPs...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  No IP addresses are currently blocked.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id || item.ip} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-red-500" />
                      {item.ip}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-sm">{item.reason}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-800">
                      {item.blockedBy?.email || item.blockedBy?.name || "Admin"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {format(new Date(item.createdAt), "dd MMM yyyy, HH:mm")}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                    {item.expiresAt
                      ? format(new Date(item.expiresAt), "dd MMM yyyy, HH:mm")
                      : "Permanent"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={isUnblocking}
                      onClick={() => onUnblockIp(item.ip)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Unblock
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
