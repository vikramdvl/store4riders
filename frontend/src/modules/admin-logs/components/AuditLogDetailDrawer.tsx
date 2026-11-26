"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Ban, ShieldCheck, X } from "lucide-react";
import {
  AuditLogCategory,
  AuditLogSeverity,
  IAuditLog,
} from "@store4riders/shared-types";

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]);

export const getCategoryBadgeStyle = (category: AuditLogCategory) => {
  switch (category) {
    case "ADMIN":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "AUTH":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "PAYMENT":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "SHIPPING":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "SYSTEM":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export const getSeverityBadgeStyle = (severity: AuditLogSeverity) => {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

export const formatActionTitle = (action: string) =>
  action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDiffValue = (value: unknown): string => {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

interface AuditLogDetailDrawerProps {
  log: IAuditLog;
  isIpBlocked: boolean;
  isBlockingIp: boolean;
  isUnblockingIp: boolean;
  onBlockIp: (payload: { ip: string; reason: string; durationHours: 1 | 24 | 168 | null }) => void;
  onUnblockIp: (ip: string) => void;
  onClose: () => void;
}

export function AuditLogDetailDrawer({
  log,
  isIpBlocked,
  isBlockingIp,
  isUnblockingIp,
  onBlockIp,
  onUnblockIp,
  onClose,
}: AuditLogDetailDrawerProps) {
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockReason, setBlockReason] = useState(
    `Suspicious activity (${formatActionTitle(log.action)})`
  );
  const [durationHours, setDurationHours] = useState<1 | 24 | 168 | null>(24);

  const beforeEntries = log.changes?.before || {};
  const afterEntries = log.changes?.after || {};
  const diffKeys = Array.from(
    new Set([...Object.keys(beforeEntries), ...Object.keys(afterEntries)])
  );

  const ip = log.context?.ip?.trim();
  const canManageIp = Boolean(ip && !LOOPBACK_IPS.has(ip));

  const handleConfirmBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip || !blockReason.trim()) return;
    onBlockIp({ ip, reason: blockReason.trim(), durationHours });
    setShowBlockForm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Audit log entry details"
    >
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded border ${getCategoryBadgeStyle(
                  log.category
                )}`}
              >
                {log.category}
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded border ${getSeverityBadgeStyle(
                  log.severity
                )}`}
              >
                {log.severity}
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded border ${
                  log.status === "failure"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {log.status}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 truncate">
              {formatActionTitle(log.action)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {format(new Date(log.createdAt), "dd MMM yyyy, hh:mm:ss a")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Summary
            </h3>
            <p className="text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
              {log.message}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Actor
              </h3>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="text-slate-900 font-medium text-right truncate">
                    {log.actor?.name || "System / Automated"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="text-slate-900 font-mono text-right truncate">
                    {log.actor?.email || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="text-slate-900 font-medium text-right uppercase">
                    {log.actor?.role || "system"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border border-slate-200 rounded-lg p-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Target Resource
              </h3>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Type</dt>
                  <dd className="text-slate-900 font-medium text-right">
                    {log.resource?.type || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Label</dt>
                  <dd className="text-slate-900 font-mono text-right truncate">
                    {log.resource?.label || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">ID</dt>
                  <dd className="text-slate-700 font-mono text-right truncate">
                    {log.resource?.id || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {diffKeys.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Field Changes
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Before</th>
                      <th className="py-2 px-3">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {diffKeys.map((key) => (
                      <tr key={key}>
                        <td className="py-2 px-3 font-mono font-medium text-slate-700 align-top">
                          {key}
                        </td>
                        <td className="py-2 px-3 font-mono text-red-700 bg-red-50/40 break-all align-top">
                          {formatDiffValue(beforeEntries[key])}
                        </td>
                        <td className="py-2 px-3 font-mono text-emerald-700 bg-emerald-50/40 break-all align-top">
                          {formatDiffValue(afterEntries[key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Request Context
              </h3>
              {canManageIp && ip && (
                isIpBlocked ? (
                  <button
                    type="button"
                    disabled={isUnblockingIp}
                    onClick={() => onUnblockIp(ip)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {isUnblockingIp ? "Unblocking..." : "Unblock IP"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBlockForm((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Block IP
                  </button>
                )
              )}
            </div>

            {showBlockForm && ip && !isIpBlocked && (
              <form
                onSubmit={handleConfirmBlock}
                className="mb-3 p-3.5 bg-red-50/60 border border-red-200 rounded-lg space-y-3 text-xs"
              >
                <div className="font-semibold text-red-900">
                  Block IP <span className="font-mono">{ip}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={300}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Reason for blocking"
                    className="sm:col-span-2 px-2.5 py-1.5 bg-white border border-red-200 rounded text-slate-800 focus:outline-none focus:border-red-400"
                  />
                  <select
                    value={durationHours === null ? "permanent" : String(durationHours)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDurationHours(val === "permanent" ? null : (Number(val) as 1 | 24 | 168));
                    }}
                    className="px-2.5 py-1.5 bg-white border border-red-200 rounded text-slate-800 focus:outline-none focus:border-red-400"
                  >
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockForm(false)}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBlockingIp}
                    className="px-3 py-1 bg-red-600 text-white rounded font-semibold hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                  >
                    {isBlockingIp ? "Blocking..." : "Confirm Block"}
                  </button>
                </div>
              </form>
            )}

            <div className="border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">IP Address</span>
                <span className="font-mono text-slate-900">{ip || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">Endpoint</span>
                <span className="font-mono text-slate-900 truncate">
                  {log.context?.method ? `${log.context.method} ` : ""}
                  {log.context?.path || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">Request ID</span>
                <span className="font-mono text-slate-700 truncate">
                  {log.context?.requestId || "—"}
                </span>
              </div>
              <div className="pt-1 border-t border-slate-100">
                <span className="text-slate-500 block mb-1">User Agent</span>
                <span className="font-mono text-[11px] text-slate-600 break-all leading-normal block">
                  {log.context?.userAgent || "—"}
                </span>
              </div>
            </div>
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Additional Metadata
              </h3>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 text-xs font-mono overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
