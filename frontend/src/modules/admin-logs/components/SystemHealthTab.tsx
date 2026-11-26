"use client";

import React from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Search,
  Truck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { ISystemHealthReport } from "@store4riders/shared-types";

interface SystemHealthTabProps {
  report?: ISystemHealthReport;
  isLoading: boolean;
}

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getServiceBadge = (status: string) => {
  switch (status) {
    case "healthy":
    case "operational":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "fallback_memory":
    case "degraded":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "down":
    case "misconfigured":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export function SystemHealthTab({ report, isLoading }: SystemHealthTabProps) {
  if (isLoading || !report) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        Checking database, cache, search, and payment gateway health...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Infrastructure Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MongoDB */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Database className="w-4 h-4 text-slate-500" />
              MongoDB Atlas
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${getServiceBadge(
                report.database.status
              )}`}
            >
              {report.database.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Ping latency:{" "}
            <span className="font-mono font-semibold text-slate-800">
              {report.database.latencyMs !== null ? `${report.database.latencyMs} ms` : "—"}
            </span>
          </p>
        </div>

        {/* Redis */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <HardDrive className="w-4 h-4 text-slate-500" />
              Redis Cache
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${getServiceBadge(
                report.redis.status
              )}`}
            >
              {report.redis.status === "fallback_memory" ? "Memory Fallback" : report.redis.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Ping latency:{" "}
            <span className="font-mono font-semibold text-slate-800">
              {report.redis.latencyMs !== null ? `${report.redis.latencyMs} ms` : "In-memory"}
            </span>
          </p>
        </div>

        {/* Meilisearch */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Search className="w-4 h-4 text-slate-500" />
              Meilisearch
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${getServiceBadge(
                report.meilisearch.status
              )}`}
            >
              {report.meilisearch.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Ping latency:{" "}
            <span className="font-mono font-semibold text-slate-800">
              {report.meilisearch.latencyMs !== null ? `${report.meilisearch.latencyMs} ms` : "—"}
            </span>
          </p>
        </div>

        {/* API Runtime */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Cpu className="w-4 h-4 text-slate-500" />
              Backend API
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
              {report.api.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Uptime{" "}
            <span className="font-mono font-semibold text-slate-800">
              {formatUptime(report.api.uptimeSeconds)}
            </span>{" "}
            &middot; {report.api.memoryUsedMb} MB
          </p>
        </div>
      </div>

      {/* Payment Gateways Health */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Payment Gateways Status &amp; 24h Activity
            </h2>
            <p className="text-xs text-slate-500">
              Checks enabled status, server credentials, and live 24-hour payment success vs failure counts.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Checked {format(new Date(report.checkedAt), "hh:mm:ss a")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Enabled</th>
                <th className="py-3 px-4">Credentials</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">24h Captured / Failed / Pending</th>
                <th className="py-3 px-4">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.paymentGateways.map((gw) => (
                <tr key={gw.gateway} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{gw.label}</td>
                  <td className="py-3 px-4">
                    {gw.enabled ? (
                      <span className="text-emerald-700 font-medium">Enabled</span>
                    ) : (
                      <span className="text-slate-400">Disabled</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {gw.configured ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        Missing Keys
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono uppercase text-slate-700">
                    {gw.mode || "—"}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-emerald-700 font-semibold">{gw.last24h.captured}</span>
                    {" / "}
                    <span className={gw.last24h.failed > 0 ? "text-red-700 font-semibold" : "text-slate-500"}>
                      {gw.last24h.failed}
                    </span>
                    {" / "}
                    <span className="text-slate-500">{gw.last24h.pending}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${getServiceBadge(
                        gw.health
                      )}`}
                    >
                      {gw.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Courier Providers Readiness & System Errors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-slate-500" />
            Courier Providers Configuration
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {report.shippingProviders.map((sp) => (
              <div key={sp.provider} className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-slate-800">{sp.label}</span>
                {sp.configured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Configured
                  </span>
                ) : (
                  <span className="text-slate-400">Not configured</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-slate-500" />
              Unhandled Backend Breakages (24h)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Unexpected HTTP 500 crashes across API endpoints are automatically captured under the{" "}
              <span className="font-semibold text-slate-700">System Errors</span> filter in Audit Logs.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Errors recorded in last 24h</span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                report.recentSystemErrors24h > 0 ? "text-red-600" : "text-emerald-700"
              }`}
            >
              {report.recentSystemErrors24h}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
