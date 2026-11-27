"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAuditLogs, useAuditLogStats } from "@/core/hooks/useAuditLogs";
import { useBlockedIps, useBlockIp, useUnblockIp } from "@/core/hooks/useBlockedIps";
import { useSystemHealth } from "@/core/hooks/useSystemHealth";
import {
  AuditLogCategory,
  AuditLogSeverity,
  AuditLogStatus,
  IAuditLog,
} from "@store4riders/shared-types";
import {
  AuditLogDetailDrawer,
  formatActionTitle,
  getCategoryBadgeStyle,
  getSeverityBadgeStyle,
} from "./AuditLogDetailDrawer";
import { BlockedIpsTab } from "./BlockedIpsTab";
import { SystemHealthTab } from "./SystemHealthTab";
import { PaymentLogsTab } from "./PaymentLogsTab";

type TopSectionTab = "audit" | "blocked-ips" | "payments" | "health";

const CATEGORY_TABS: Array<{ id: "ALL" | AuditLogCategory; label: string }> = [
  { id: "ALL", label: "All Events" },
  { id: "ADMIN", label: "Admin Actions" },
  { id: "AUTH", label: "Security & Auth" },
  { id: "PAYMENT", label: "Payments" },
  { id: "SHIPPING", label: "Shipping" },
  { id: "SYSTEM", label: "System Errors" },
];

export function AdminAuditLogsModule() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [sectionTab, setSectionTab] = useState<TopSectionTab>("audit");

  const [activeCategory, setActiveCategory] = useState<"ALL" | AuditLogCategory>("ALL");
  const [severityFilter, setSeverityFilter] = useState<"" | AuditLogSeverity>("");
  const [statusFilter, setStatusFilter] = useState<"" | AuditLogStatus>("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<IAuditLog | null>(null);
  const limit = 25;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const {
    data: logsData,
    isLoading,
    isFetching,
    refetch,
  } = useAuditLogs({
    page,
    limit,
    category: activeCategory === "ALL" ? undefined : activeCategory,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    enabled: mounted && isAdmin && sectionTab === "audit",
  });

  const { data: statsData, refetch: refetchStats } = useAuditLogStats(mounted && isAdmin);
  const {
    data: blockedIps = [],
    isLoading: blockedIpsLoading,
    refetch: refetchBlockedIps,
  } = useBlockedIps(mounted && isAdmin);
  const {
    data: healthReport,
    isLoading: healthLoading,
    isFetching: healthFetching,
    refetch: refetchHealth,
  } = useSystemHealth(mounted && isAdmin);

  const blockIpMutation = useBlockIp();
  const unblockIpMutation = useUnblockIp();

  const blockedIpSet = useMemo(
    () => new Set(blockedIps.map((item) => item.ip)),
    [blockedIps]
  );

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-md mx-auto mt-12">
        <Lock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Restricted Access</h2>
        <p className="text-sm text-slate-500 mt-1">
          Audit and security logs are restricted to Administrator and Super Admin accounts.
        </p>
      </div>
    );
  }

  const logs = logsData?.items || [];
  const totalCount = logsData?.totalCount || 0;
  const totalPages = logsData?.totalPages || 1;
  const hasFilters =
    activeCategory !== "ALL" ||
    Boolean(severityFilter) ||
    Boolean(statusFilter) ||
    Boolean(debouncedSearch) ||
    Boolean(startDate) ||
    Boolean(endDate);

  const handleResetFilters = () => {
    setActiveCategory("ALL");
    setSeverityFilter("");
    setStatusFilter("");
    setSearchInput("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
    refetchStats();
    refetchBlockedIps();
    refetchHealth();
  };

  const systemHealthBadge =
    healthReport?.overallStatus === "critical"
      ? { label: "System Issue", cls: "bg-red-50 text-red-700 border-red-200" }
      : healthReport?.overallStatus === "degraded"
        ? { label: "Degraded", cls: "bg-amber-50 text-amber-700 border-amber-200" }
        : { label: "All Systems Operational", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Logs, Security &amp; System Health
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor admin audit trails, block attacking IPs, inspect payment transactions, and verify infrastructure health.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {healthReport && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${systemHealthBadge.cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {systemHealthBadge.label}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching || healthFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching || healthFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 24h Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Events (24h)</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {statsData?.totalLast24h ?? 0}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Auth Failures (24h)</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {statsData?.failedLoginsLast24h ?? 0}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Critical Changes (24h)</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {statsData?.criticalChangesLast24h ?? 0}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Gateway / Courier Errors</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {statsData?.paymentAndShippingFailuresLast24h ?? 0}
          </p>
        </div>
      </div>

      {/* Primary Section Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSectionTab("audit")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            sectionTab === "audit"
              ? "border-brand text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          Audit &amp; Security Logs
        </button>

        <button
          type="button"
          onClick={() => setSectionTab("blocked-ips")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            sectionTab === "blocked-ips"
              ? "border-brand text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Ban className="w-4 h-4" />
          Blocked IPs
          {blockedIps.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
              {blockedIps.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSectionTab("payments")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            sectionTab === "payments"
              ? "border-brand text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Transactions
        </button>

        <button
          type="button"
          onClick={() => setSectionTab("health")}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            sectionTab === "health"
              ? "border-brand text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Server className="w-4 h-4" />
          System &amp; Gateway Health
        </button>
      </div>

      {/* Section 1: Audit & Security Logs */}
      {sectionTab === "audit" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 pt-3 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-50/60">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(tab.id);
                    setPage(1);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search email, order #, SKU, IP, or action..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value as "" | AuditLogSeverity);
                  setPage(1);
                }}
                aria-label="Filter by severity"
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-slate-500"
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "" | AuditLogStatus);
                  setPage(1);
                }}
                aria-label="Filter by status"
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-slate-500"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>

              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                aria-label="Start date"
                className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-slate-500"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                aria-label="End date"
                className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-slate-500"
              />

              {hasFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Status &amp; IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No audit log entries match the current filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const rowIp = log.context?.ip || "";
                    const rowIpBlocked = Boolean(rowIp && blockedIpSet.has(rowIp));
                    return (
                      <tr
                        key={log._id || log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <div className="font-mono text-xs text-slate-800">
                            {format(new Date(log.createdAt), "dd MMM yyyy")}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {format(new Date(log.createdAt), "hh:mm:ss a")}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top max-w-md">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${getCategoryBadgeStyle(
                                log.category
                              )}`}
                            >
                              {log.category}
                            </span>
                            {log.severity !== "info" && (
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${getSeverityBadgeStyle(
                                  log.severity
                                )}`}
                              >
                                {log.severity}
                              </span>
                            )}
                            <span className="font-semibold text-slate-900 text-xs">
                              {formatActionTitle(log.action)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">{log.message}</p>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <div className="text-xs font-medium text-slate-900">
                            {log.actor?.email || log.actor?.name || "System"}
                          </div>
                          <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">
                            {log.actor?.role || "automated"}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <div className="text-xs font-medium text-slate-800">
                            {log.resource?.type || "—"}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate max-w-[160px]">
                            {log.resource?.label || log.resource?.id || "—"}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                log.status === "failure" ? "bg-red-500" : "bg-emerald-500"
                              }`}
                            />
                            <span
                              className={
                                log.status === "failure" ? "text-red-700" : "text-slate-700"
                              }
                            >
                              {log.status === "failure" ? "Failed" : "Success"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-slate-400">
                              {rowIp || "—"}
                            </span>
                            {rowIpBlocked && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-red-100 text-red-700">
                                Blocked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              {totalCount > 0 ? (
                <>
                  Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span>
                  {" – "}
                  <span className="font-semibold text-slate-900">
                    {Math.min(page * limit, totalCount)}
                  </span>{" "}
                  of <span className="font-semibold text-slate-900">{totalCount}</span> entries
                </>
              ) : (
                "0 entries"
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="font-medium text-slate-700 px-1">
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Blocked IPs */}
      {sectionTab === "blocked-ips" && (
        <BlockedIpsTab
          items={blockedIps}
          isLoading={blockedIpsLoading}
          isBlocking={blockIpMutation.isPending}
          isUnblocking={unblockIpMutation.isPending}
          onBlockIp={(payload, options) => blockIpMutation.mutate(payload, options)}
          onUnblockIp={(ipOrId) => unblockIpMutation.mutate(ipOrId)}
        />
      )}

      {/* Section 3: Payment Transactions */}
      {sectionTab === "payments" && <PaymentLogsTab enabled={mounted && isAdmin && sectionTab === "payments"} />}

      {/* Section 4: System & Gateway Health */}
      {sectionTab === "health" && (
        <SystemHealthTab report={healthReport} isLoading={healthLoading} />
      )}

      {selectedLog && (
        <AuditLogDetailDrawer
          log={selectedLog}
          isIpBlocked={Boolean(selectedLog.context?.ip && blockedIpSet.has(selectedLog.context.ip))}
          isBlockingIp={blockIpMutation.isPending}
          isUnblockingIp={unblockIpMutation.isPending}
          onBlockIp={(payload, options) => blockIpMutation.mutate(payload, options)}
          onUnblockIp={(ip) => unblockIpMutation.mutate(ip)}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
