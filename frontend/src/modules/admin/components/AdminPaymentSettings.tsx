"use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import {
  CreditCard,
  Sliders,
  Database,
  Search,
  RefreshCw,
  Check,
  X,
  Copy,
  Info,
  Truck,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

interface ISettings {
  taxRate: number;
  freeShippingThreshold: number;
  shippingCost: number;
  enabledGateways: string[];
  codPartialPaymentEnabled?: boolean;
  codPartialPaymentType: "percentage" | "fixed";
  codPartialPaymentValue: number | string;
  codHandlingFeeEnabled?: boolean;
  codHandlingFeeThreshold?: number | string;
  codHandlingFeeTier1Amount?: number | string;
  codHandlingFeeTier2Amount?: number | string;
  snapmintMinOrderValue?: number | string;
  upiMerchantVpa?: string;
  upiMerchantName?: string;
  upiMcc?: string;
  googlePayMerchantId?: string;
  googlePayEnvironment?: "TEST" | "PRODUCTION";
}

export function AdminPaymentSettings() {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<"config" | "logs">("config");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchLogQuery, setSearchLogQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiClient.get("/admin/settings");
      const data = res.data.data;
      setSettings({
        ...data,
        snapmintMinOrderValue: data.snapmintMinOrderValue !== undefined ? Number(data.snapmintMinOrderValue) : 0,
        codHandlingFeeEnabled: data.codHandlingFeeEnabled !== false,
        codHandlingFeeThreshold: data.codHandlingFeeThreshold !== undefined ? Number(data.codHandlingFeeThreshold) : 5000,
        codHandlingFeeTier1Amount: data.codHandlingFeeTier1Amount !== undefined ? Number(data.codHandlingFeeTier1Amount) : 100,
        codHandlingFeeTier2Amount: data.codHandlingFeeTier2Amount !== undefined ? Number(data.codHandlingFeeTier2Amount) : 200,
      });
    } catch (err) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await apiClient.get("/admin/payment-logs");
      setLogs(res.data.data.items || res.data.data);
    } catch (err) {
      toast.error("Failed to load payment logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settings || saving) return;
    try {
      setSaving(true);
      // Send ONLY payment-related fields â€” prevents overwriting other tabs' data
      const payload = {
        enabledGateways: settings.enabledGateways,
        codPartialPaymentEnabled: settings.codPartialPaymentEnabled,
        codPartialPaymentType: settings.codPartialPaymentType,
        codPartialPaymentValue: settings.codPartialPaymentValue,
        codHandlingFeeEnabled: Boolean(settings.codHandlingFeeEnabled),
        codHandlingFeeThreshold: Number(settings.codHandlingFeeThreshold) >= 0 ? Number(settings.codHandlingFeeThreshold) : 5000,
        codHandlingFeeTier1Amount: Number(settings.codHandlingFeeTier1Amount) >= 0 ? Number(settings.codHandlingFeeTier1Amount) : 100,
        codHandlingFeeTier2Amount: Number(settings.codHandlingFeeTier2Amount) >= 0 ? Number(settings.codHandlingFeeTier2Amount) : 200,
        snapmintMinOrderValue: Number(settings.snapmintMinOrderValue) >= 0 ? Number(settings.snapmintMinOrderValue) : 0,
        upiMerchantVpa: settings.upiMerchantVpa,
        upiMerchantName: settings.upiMerchantName,
        upiMcc: settings.upiMcc,
        googlePayMerchantId: settings.googlePayMerchantId,
        googlePayEnvironment: settings.googlePayEnvironment,
      };
      await apiClient.put("/admin/settings", payload);
      await queryClient.invalidateQueries({ queryKey: ["publicSettings"] });
      await queryClient.refetchQueries({ queryKey: ["publicSettings"] });
      toast.success("Payment settings saved successfully");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to save settings";
      toast.error(typeof msg === "string" ? msg : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleGatewayToggle = (gateway: string) => {
    if (!settings) return;
    const currentGateways = settings.enabledGateways || [];
    const enabled = currentGateways.includes(gateway);
    let newGateways = [...currentGateways];
    if (enabled) {
      if (newGateways.length <= 1) {
        toast.error("At least one payment gateway must remain enabled.");
        return;
      }
      newGateways = newGateways.filter((g) => g !== gateway);
    } else {
      newGateways.push(gateway);
    }
    setSettings({ ...settings, enabledGateways: newGateways });
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const query = searchLogQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        String(log.gatewayOrderId || "").toLowerCase().includes(query) ||
        String(log.orderId || "").toLowerCase().includes(query) ||
        String(log._id || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        String(log.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchLogQuery, statusFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-neutral-500 font-medium">Loading payment configurations...</span>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs: Config vs Audit Logs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div className="flex items-center gap-2 bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/80 w-fit">
          <button
            type="button"
            onClick={() => setSubTab("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "config"
                ? "bg-white text-neutral-900 shadow-xs border border-neutral-200/60"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-brand" />
            <span>Gateways & Surcharges</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === "logs"
                ? "bg-white text-neutral-900 shadow-xs border border-neutral-200/60"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-neutral-500" />
            <span>Payment Audit Logs</span>
            {logs.length > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {subTab === "config" ? (
          <Button
            type="button"
            onClick={() => handleSave()}
            isLoading={saving}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving Changes..." : "Save Payment Settings"}
          </Button>
        ) : (
          <button
            type="button"
            onClick={fetchLogs}
            disabled={logsLoading}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 px-3.5 py-2 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin text-brand" : "text-neutral-500"}`} />
            <span>Refresh Transactions</span>
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUBTAB 1: GATEWAYS & SURCHARGE CONFIGURATION */}
      {/* ------------------------------------------------------------- */}
      {subTab === "config" && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. Active Payment Gateways Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand" />
                  <span>Enabled Payment Methods</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select which payment gateways and methods are visible to customers on the checkout page.
                </p>
              </div>
              <span className="text-[11px] font-bold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-full border border-neutral-200/70 w-fit">
                {settings.enabledGateways?.length || 0} Methods Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* PayU */}
              <div
                onClick={() => handleGatewayToggle("payu")}
                className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  (settings?.enabledGateways || []).includes("payu")
                    ? "border-emerald-300 bg-emerald-50/30 shadow-2xs"
                    : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={(settings?.enabledGateways || []).includes("payu")}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded text-brand cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-neutral-900">PayU Payment Gateway</span>
                    <span className="text-[10px] font-bold bg-[#78A832]/15 text-[#4A6E18] px-2 py-0.5 rounded uppercase">
                      Primary Gateway
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Credit & Debit Cards (Visa, Mastercard, RuPay), UPI QR & Intent, NetBanking across 50+ Indian banks, and Wallets.
                  </p>
                </div>
              </div>

              {/* CCAvenue */}
              <div
                onClick={() => handleGatewayToggle("ccavenue")}
                className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  (settings?.enabledGateways || []).includes("ccavenue")
                    ? "border-emerald-300 bg-emerald-50/30 shadow-2xs"
                    : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={(settings?.enabledGateways || []).includes("ccavenue")}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded text-brand cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-neutral-900">CCAvenue</span>
                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded uppercase">
                      Multi-Bank Gateway
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Reliable secondary gateway for major Indian credit/debit cards, corporate netbanking, and alternate banking channels.
                  </p>
                </div>
              </div>

              {/* Snapmint */}
              <div
                onClick={() => handleGatewayToggle("snapmint")}
                className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  (settings?.enabledGateways || []).includes("snapmint")
                    ? "border-emerald-300 bg-emerald-50/30 shadow-2xs"
                    : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={(settings?.enabledGateways || []).includes("snapmint")}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded text-brand cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-neutral-900">Snapmint Cardless EMI</span>
                    <span className="text-[10px] font-bold bg-[#004851] text-[#00e396] px-2 py-0.5 rounded uppercase">
                      0% Interest EMI
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Allows riders to split higher gear purchases (helmets, riding jackets) into 3-6 easy monthly installments without credit cards.
                  </p>
                </div>
              </div>

              {/* Cash on Delivery (COD) */}
              <div
                onClick={() => handleGatewayToggle("cod")}
                className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  (settings?.enabledGateways || []).includes("cod")
                    ? "border-emerald-300 bg-emerald-50/30 shadow-2xs"
                    : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={(settings?.enabledGateways || []).includes("cod")}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded text-brand cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-neutral-900">Cash on Delivery (COD)</span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase">
                      Doorstep Cash
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Customers pay upon physical delivery. Supports automated tiered cash handling charges and partial online advance security.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. COD Surcharges & Advance Security Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-6">
            <div className="pb-3 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand" />
                <span>Cash on Delivery (COD) Rules & Courier Surcharges</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Configure courier cash handling fees and partial online advance deposits to minimize RTOs (Return to Origin).
              </p>
            </div>

            {/* PART A: Tiered Courier Cash Handling Charges */}
            <div className="p-4 sm:p-5 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="codHandlingFeeEnabled"
                    className="h-4 w-4 rounded text-brand cursor-pointer mt-0.5"
                    checked={Boolean(settings.codHandlingFeeEnabled)}
                    onChange={(e) => setSettings({ ...settings, codHandlingFeeEnabled: e.target.checked })}
                  />
                  <div>
                    <label htmlFor="codHandlingFeeEnabled" className="text-sm font-bold text-neutral-900 cursor-pointer block">
                      Enable Tiered Courier Cash Handling Charges
                    </label>
                    <span className="text-xs text-neutral-600 block mt-0.5">
                      Couriers charge extra fees to collect cash at doorstep. Automatically add this surcharge to COD orders based on order value.
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                  settings.codHandlingFeeEnabled ? "bg-amber-200 text-amber-900" : "bg-neutral-200 text-neutral-600"
                }`}>
                  {settings.codHandlingFeeEnabled ? "Active" : "Disabled"}
                </span>
              </div>

              {settings.codHandlingFeeEnabled && (
                <div className="pt-3 border-t border-amber-200/60 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Order Value Threshold (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        placeholder="e.g. 5000"
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        value={settings.codHandlingFeeThreshold ?? ""}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setSettings({ ...settings, codHandlingFeeThreshold: "" });
                            return;
                          }
                          const num = Number(val);
                          setSettings({ ...settings, codHandlingFeeThreshold: isNaN(num) ? "" : Math.max(0, num) });
                        }}
                      />
                      <span className="text-[11px] text-neutral-500 mt-1 block">
                        Cutoff amount separating Tier 1 and Tier 2 rules.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Tier 1 Fee: Orders ≤ ₹{Number(settings.codHandlingFeeThreshold || 5000).toLocaleString("en-IN")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        placeholder="e.g. 100"
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        value={settings.codHandlingFeeTier1Amount ?? ""}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setSettings({ ...settings, codHandlingFeeTier1Amount: "" });
                            return;
                          }
                          const num = Number(val);
                          setSettings({ ...settings, codHandlingFeeTier1Amount: isNaN(num) ? "" : Math.max(0, num) });
                        }}
                      />
                      <span className="text-[11px] text-neutral-500 mt-1 block">
                        Surcharge for orders up to threshold.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Tier 2 Fee: Orders &gt; ₹{Number(settings.codHandlingFeeThreshold || 5000).toLocaleString("en-IN")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        placeholder="e.g. 200"
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        value={settings.codHandlingFeeTier2Amount ?? ""}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setSettings({ ...settings, codHandlingFeeTier2Amount: "" });
                            return;
                          }
                          const num = Number(val);
                          setSettings({ ...settings, codHandlingFeeTier2Amount: isNaN(num) ? "" : Math.max(0, num) });
                        }}
                      />
                      <span className="text-[11px] text-neutral-500 mt-1 block">
                        Surcharge for orders above threshold.
                      </span>
                    </div>
                  </div>

                  {/* Live Formula Badge */}
                  <div className="p-3 bg-white border border-amber-200/80 rounded-xl text-xs space-y-1 shadow-2xs">
                    <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                      💡 Active COD Surcharge Calculation:
                    </span>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-neutral-700 pt-0.5">
                      <span>
                        • Orders ≤ <strong>₹{Number(settings.codHandlingFeeThreshold || 5000).toLocaleString("en-IN")}</strong>:{" "}
                        <strong className="text-amber-800 font-bold">+₹{Number(settings.codHandlingFeeTier1Amount || 0)} COD Fee</strong>
                      </span>
                      <span>
                        • Orders &gt; <strong>₹{Number(settings.codHandlingFeeThreshold || 5000).toLocaleString("en-IN")}</strong>:{" "}
                        <strong className="text-amber-800 font-bold">+₹{Number(settings.codHandlingFeeTier2Amount || 0)} COD Fee</strong>
                      </span>
                      <span className="text-emerald-700 font-semibold">
                        • Online Prepaid (UPI/Card/EMI): ₹0 fee
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PART B: Require Partial Online Advance for COD */}
            <div className="p-4 sm:p-5 rounded-xl border border-blue-200/80 bg-blue-50/30 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="codPartialPaymentEnabled"
                    className="h-4 w-4 rounded text-brand cursor-pointer mt-0.5"
                    checked={Boolean(settings.codPartialPaymentEnabled)}
                    onChange={(e) => setSettings({ ...settings, codPartialPaymentEnabled: e.target.checked })}
                  />
                  <div>
                    <label htmlFor="codPartialPaymentEnabled" className="text-sm font-bold text-neutral-900 cursor-pointer block">
                      Require Partial Online Advance for COD Orders
                    </label>
                    <span className="text-xs text-neutral-600 block mt-0.5">
                      Customer pays a token advance online via PayU to confirm intention, reducing fake orders and delivery refusals.
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                  settings.codPartialPaymentEnabled ? "bg-blue-200 text-blue-900" : "bg-neutral-200 text-neutral-600"
                }`}>
                  {settings.codPartialPaymentEnabled ? "Active" : "Disabled"}
                </span>
              </div>

              {settings.codPartialPaymentEnabled && (
                <div className="pt-3 border-t border-blue-200/60 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Advance Payment Type
                      </label>
                      <select
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        value={settings.codPartialPaymentType || "percentage"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            codPartialPaymentType: e.target.value as "percentage" | "fixed",
                          })
                        }
                      >
                        <option value="percentage">Percentage of Total Order (%)</option>
                        <option value="fixed">Fixed Flat Advance (₹)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                        Advance Value {settings.codPartialPaymentType === "percentage" ? "(%)" : "(₹)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={settings.codPartialPaymentType === "percentage" ? 100 : undefined}
                        step={1}
                        placeholder="Enter advance amount"
                        className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        value={settings.codPartialPaymentValue ?? ""}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setSettings({ ...settings, codPartialPaymentValue: "" });
                            return;
                          }
                          const num = Number(raw);
                          let val = isNaN(num) ? "" : Math.max(0, num);
                          if (typeof val === "number" && settings.codPartialPaymentType === "percentage") {
                            val = Math.min(100, val);
                          }
                          setSettings({ ...settings, codPartialPaymentValue: val });
                        }}
                      />
                      <span className="text-[11px] text-neutral-500 mt-1 block">
                        {settings.codPartialPaymentType === "percentage"
                          ? "Percentage of total order amount customer pays online (0-100%)."
                          : "Fixed ₹ amount customer pays online as advance to confirm COD."}
                      </span>
                    </div>
                  </div>

                  {/* Sample Customer Simulation Pill */}
                  <div className="p-3 bg-white border border-blue-200/80 rounded-xl text-xs space-y-1 shadow-2xs">
                    <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                      💡 Customer Checkout Simulation (Sample ₹5,000 Order):
                    </span>
                    <div className="flex flex-wrap gap-4 text-[11.5px] text-neutral-700 pt-0.5">
                      <span>
                        Advance Paid Online Now:{" "}
                        <strong className="text-blue-700 font-bold">
                          ₹
                          {settings.codPartialPaymentType === "percentage"
                            ? Math.round((5000 * (Number(settings.codPartialPaymentValue) || 0)) / 100)
                            : Math.min(5000, Number(settings.codPartialPaymentValue) || 0)}
                        </strong>
                      </span>
                      <span>
                        Due upon Doorstep Delivery:{" "}
                        <strong className="text-emerald-700 font-bold">
                          ₹
                          {settings.codPartialPaymentType === "percentage"
                            ? Math.max(
                                0,
                                5000 - Math.round((5000 * (Number(settings.codPartialPaymentValue) || 0)) / 100)
                              )
                            : Math.max(0, 5000 - (Number(settings.codPartialPaymentValue) || 0))}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Snapmint 0% Cardless EMI Configuration Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Snapmint (Cardless 0% EMI) Threshold</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Set minimum cart value required before Snapmint EMI option unlocks at checkout.
                </p>
              </div>
              <span className="text-[10px] font-bold bg-[#004851] text-[#00e396] px-2.5 py-0.5 rounded uppercase w-fit">
                0% Interest EMI
              </span>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Minimum Order Value for Snapmint EMI (₹)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                placeholder="e.g. 1500"
                className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
                value={settings.snapmintMinOrderValue ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setSettings({ ...settings, snapmintMinOrderValue: "" });
                    return;
                  }
                  const num = Number(raw);
                  const val = isNaN(num) ? "" : Math.max(0, num);
                  setSettings({ ...settings, snapmintMinOrderValue: val });
                }}
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Orders below this amount prompt customers on checkout to add more items to unlock 0% EMI.
              </span>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-end pt-2">
            <Button type="submit" isLoading={saving} disabled={saving} className="px-6 py-2.5">
              {saving ? "Saving Changes..." : "Save Payment Settings"}
            </Button>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUBTAB 2: PAYMENT TRANSACTION AUDIT LOGS */}
      {/* ------------------------------------------------------------- */}
      {subTab === "logs" && (
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
          {/* Explainer Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>What is this Payment Transaction Log?</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11.5px]">
              Whenever a customer initiates a payment session at checkout (via PayU, CCAvenue, Snapmint, or COD), a transaction record is created here with the bank&apos;s unique transaction reference.
              If a customer reports their card/UPI was debited but their order is pending, you can search their Order ID or Gateway Transaction ID below to verify whether the bank captured the funds or marked it failed.
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Order ID or Gateway Transaction ID..."
                value={searchLogQuery}
                onChange={(e) => setSearchLogQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-neutral-800 focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="all">All Statuses ({logs.length})</option>
                <option value="captured">Captured (Success)</option>
                <option value="failed">Failed / Cancelled</option>
                <option value="pending">Pending</option>
                <option value="created">Created</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand" />
              <span className="text-xs text-neutral-500">Loading live transaction logs...</span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50/80 text-neutral-700 font-bold uppercase tracking-wider text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-3.5">Gateway Order / Txn ID</th>
                    <th className="py-3 px-3.5">Store Order ID</th>
                    <th className="py-3 px-3.5">Gateway</th>
                    <th className="py-3 px-3.5">Amount</th>
                    <th className="py-3 px-3.5">Capture Status</th>
                    <th className="py-3 px-3.5">Attempt Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredLogs.map((log) => {
                    const statusStr = String(log.status || "").toLowerCase();
                    const isSuccess = statusStr === "captured";
                    const isFailed = statusStr === "failed";
                    const isPending = statusStr === "pending" || statusStr === "created";

                    return (
                      <tr key={log._id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-[11px] text-neutral-800">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[170px]" title={log.gatewayOrderId || log._id}>
                              {log.gatewayOrderId || log._id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(log.gatewayOrderId || log._id)}
                              className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                              title="Copy ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 font-mono text-[11px] font-bold text-neutral-900">
                          <div className="flex items-center gap-1.5">
                            <span>{log.orderId || "—"}</span>
                            {log.orderId && (
                              <button
                                type="button"
                                onClick={() => handleCopy(log.orderId)}
                                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                                title="Copy Order ID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3.5">
                          <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200/80">
                            {log.gateway || log.method || "N/A"}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 font-bold text-neutral-900 text-sm">
                          ₹{Number(log.amount || 0).toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 px-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isSuccess
                                ? "bg-emerald-100 text-emerald-800"
                                : isFailed
                                ? "bg-red-100 text-red-800"
                                : isPending
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                            {isFailed && <XCircle className="w-3 h-3" />}
                            {isPending && <Clock className="w-3 h-3" />}
                            <span>{log.status || "Unknown"}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-neutral-500 text-[11px] whitespace-nowrap">
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredLogs.length === 0 && (
                <div className="p-8 text-center text-neutral-500 text-xs">
                  <p>No payment logs matching your search or filter.</p>
                  {(searchLogQuery || statusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchLogQuery("");
                        setStatusFilter("all");
                      }}
                      className="mt-2 text-brand font-semibold hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
