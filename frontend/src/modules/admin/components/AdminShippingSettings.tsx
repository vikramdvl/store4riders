"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { useWarehouses, useSetDefaultWarehouse, useSyncShiprocketWarehouses } from "@/core/hooks/useWarehouses";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { BuildingStorefrontIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  Truck,
  Package,
  MapPin,
  RotateCcw,
  ArrowLeftRight,
  ExternalLink,
  ShieldCheck,
  Percent,
  IndianRupee,
  Save,
  Loader2,
  Info,
} from "lucide-react";

interface IShippingSettings {
  freeShippingThreshold: number | string;
  shippingCost: number | string;
  storeOriginPincode?: string;
  storeOriginCity?: string;
  storeOriginState?: string;
  storeOriginAddress?: string;
  storeOriginPhone?: string;
  returnWindowDays?: number | string;
  exchangeShippingFee?: number | string;
  packagePresets?: { _id?: string; name: string; length: number; breadth: number; height: number }[];
}

export function AdminShippingSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<IShippingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const setDefaultWarehouseMutation = useSetDefaultWarehouse();
  const syncShiprocketMutation = useSyncShiprocketWarehouses();

  const defaultWarehouse = warehouses?.find((w) => w.isDefault) || (warehouses && warehouses.length > 0 ? warehouses[0] : null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleWarehouseSelect = (whId: string) => {
    if (!whId) return;
    const selectedWh = warehouses?.find((w) => String(w.id || (w as any)._id) === whId);
    if (!selectedWh) return;

    setDefaultWarehouseMutation.mutate(whId, {
      onSuccess: () => {
        toast.success(`"${selectedWh.name}" set as Primary Dispatch & Exchange Warehouse`);
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || "Failed to update default warehouse");
      }
    });

    if (settings) {
      setSettings({
        ...settings,
        storeOriginPincode: selectedWh.pincode || settings.storeOriginPincode || "",
        storeOriginCity: selectedWh.city || settings.storeOriginCity || "",
        storeOriginState: selectedWh.state || settings.storeOriginState || "",
        storeOriginAddress: [selectedWh.addressLine1, selectedWh.addressLine2].filter(Boolean).join(", ") || settings.storeOriginAddress || "",
        storeOriginPhone: selectedWh.phone || settings.storeOriginPhone || "",
      });
    }
  };

  const handleSyncShiprocketWarehouses = () => {
    syncShiprocketMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        toast.success(data?.message || "Successfully synced warehouses from Shiprocket!");
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || "Failed to sync warehouses from Shiprocket");
      }
    });
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/settings");
      setSettings(res.data.data);
    } catch (err) {
      toast.error("Failed to load shipping settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setSaving(true);
      // Send ONLY shipping-related fields — prevents overwriting other tabs' data
      const payload = {
        freeShippingThreshold: Number(settings.freeShippingThreshold) >= 0 ? Number(settings.freeShippingThreshold) : 0,
        shippingCost: Number(settings.shippingCost) >= 0 ? Number(settings.shippingCost) : 0,
        storeOriginPincode: settings.storeOriginPincode,
        storeOriginCity: settings.storeOriginCity,
        storeOriginState: settings.storeOriginState,
        storeOriginAddress: settings.storeOriginAddress,
        storeOriginPhone: settings.storeOriginPhone,
        returnWindowDays:
          settings.returnWindowDays !== "" &&
          settings.returnWindowDays !== undefined &&
          settings.returnWindowDays !== null &&
          !isNaN(Number(settings.returnWindowDays)) &&
          Number(settings.returnWindowDays) >= 0
            ? Math.min(365, Number(settings.returnWindowDays))
            : 7,
        exchangeShippingFee:
          settings.exchangeShippingFee !== "" && Number(settings.exchangeShippingFee) >= 0
            ? Number(settings.exchangeShippingFee)
            : 299,
        packagePresets: settings.packagePresets?.map(({ _id, ...rest }: any) => rest),
      };
      await apiClient.put("/admin/settings", payload);
      await queryClient.invalidateQueries({ queryKey: ["publicSettings"] });
      await queryClient.invalidateQueries({ queryKey: ["product"] });
      await queryClient.refetchQueries({ queryKey: ["publicSettings"] });
      toast.success("Shipping & Delivery settings saved successfully!");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to save settings";
      toast.error(typeof msg === "string" ? msg : "Failed to save shipping settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-brand mr-2" />
        <span className="text-sm font-semibold">Loading Shipping Settings...</span>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Quick Ops Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-[#FF5429] shrink-0">
            <Truck size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Courier Operations & Fulfillment</h3>
            <p className="text-xs text-slate-300">
              Generate AWBs, track live Shiprocket couriers, and manage multiple warehouse pickups.
            </p>
          </div>
        </div>
        <Link
          href="/admin/shipping"
          className="inline-flex items-center gap-1.5 bg-[#FF5429] hover:bg-[#e0451d] text-white text-xs font-bold px-4 py-2 rounded-md transition-colors shadow-sm shrink-0"
        >
          <span>Open Courier Dashboard</span>
          <ExternalLink size={13} />
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* 1. Standard Rates & Free Shipping */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Truck size={16} className="text-[#FF5429]" />
              Storefront Shipping Charges & Thresholds
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rules used during checkout when calculating standard delivery fees for customers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Standard Shipping Cost */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1">
                <span>Standard Delivery Fee (₹)</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.shippingCost ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setSettings({ ...settings, shippingCost: "" });
                      return;
                    }
                    const num = Number(raw);
                    setSettings({
                      ...settings,
                      shippingCost: isNaN(num) ? "" : Math.max(0, num),
                    });
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md pl-7 pr-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs"
                  placeholder="e.g. 49"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Standard charge applied when order subtotal is below the free shipping threshold.
              </p>
            </div>

            {/* Free Shipping Threshold */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1">
                <span className="text-emerald-600">★</span>
                <span>Free Shipping Minimum Order (₹)</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.freeShippingThreshold ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setSettings({ ...settings, freeShippingThreshold: "" });
                      return;
                    }
                    const num = Number(raw);
                    setSettings({
                      ...settings,
                      freeShippingThreshold: isNaN(num) ? "" : Math.max(0, num),
                    });
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md pl-7 pr-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs"
                  placeholder="0 to disable"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {Number(settings.freeShippingThreshold) > 0
                  ? `Orders with cart subtotal ≥ ₹${settings.freeShippingThreshold} get Free Delivery automatically.`
                  : "Free delivery by cart value is currently disabled (set > 0 to enable)."}
              </p>
            </div>
          </div>

          {/* Real-time Example Calculation Pill */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info size={13} className="text-blue-600" />
              <span>Customer Checkout Preview:</span>
            </div>
            <p className="text-[11px] text-slate-600">
              • Cart value of <strong>₹500</strong>: Delivery fee = <strong className="text-slate-900">₹{settings.shippingCost}</strong>
            </p>
            <p className="text-[11px] text-slate-600">
              • Cart value of <strong>₹1,500</strong>: Delivery fee = <strong className="text-emerald-700">FREE (₹0)</strong>
            </p>
          </div>
        </div>

        {/* 2. Warehouse Origin & Dispatch Location */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <MapPin size={16} className="text-[#FF5429]" />
                Store Origin & Dispatch Location
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary warehouse origin used for Courier rate estimates, Shiprocket pickup schedules, and return routing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncShiprocketWarehouses}
                disabled={syncShiprocketMutation.isPending}
                className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-colors shadow-2xs cursor-pointer"
                title="Import registered pickup locations directly from your Shiprocket account"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${syncShiprocketMutation.isPending ? "animate-spin" : ""}`} />
                <span>{syncShiprocketMutation.isPending ? "Syncing..." : "Sync from Shiprocket"}</span>
              </button>
              <Link
                href="/admin/shipping"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
              >
                <span>Manage Hubs</span>
                <ExternalLink size={11} />
              </Link>
            </div>
          </div>

          {/* Primary Warehouse Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                Primary Warehouse / Default Dispatch Origin:
              </label>
              {defaultWarehouse && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Active Origin: {defaultWarehouse.name} {defaultWarehouse.shiprocketLocationId ? `(Shiprocket: ${defaultWarehouse.shiprocketLocationId})` : ""}
                </span>
              )}
            </div>

            <div className="relative">
              <select
                value={defaultWarehouse ? String(defaultWarehouse.id || (defaultWarehouse as any)._id) : ""}
                onChange={(e) => handleWarehouseSelect(e.target.value)}
                disabled={isWarehousesLoading || setDefaultWarehouseMutation.isPending}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs cursor-pointer"
              >
                <option value="" disabled>
                  {isWarehousesLoading ? "Loading warehouses..." : warehouses && warehouses.length > 0 ? "Select Primary Warehouse" : "No warehouses configured (Sync from Shiprocket or enter below)"}
                </option>
                {warehouses?.map((wh) => {
                  const whId = String(wh.id || (wh as any)._id);
                  return (
                    <option key={whId} value={whId}>
                      {wh.name} {wh.warehouseCode ? `[${wh.warehouseCode}]` : ""} — {wh.city}, {wh.state} ({wh.pincode}) {wh.shiprocketLocationId ? `• Shiprocket: "${wh.shiprocketLocationId}"` : ""} {wh.isDefault ? "★ (Current Default)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-200/60">
              <p className="flex items-center gap-1.5 font-medium">
                <span className="text-emerald-600 font-bold">✓ Forward Pickups:</span> Couriers (Shiprocket, Delhivery) arrive at this warehouse to collect outbound orders.
              </p>
              <p className="flex items-center gap-1.5 font-medium">
                <span className="text-blue-600 font-bold">✓ Return Origin (RTO & Exchanges):</span> Undelivered parcels (RTO) and customer exchange returns are routed back to this exact registered warehouse.
              </p>
              <p className="flex items-center gap-1.5 text-slate-500">
                <span className="text-amber-600 font-bold">ℹ Per-Shipment Override:</span> When fulfilling orders in Courier Operations, you can select any active warehouse per shipment.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Dispatch Pincode
              </label>
              <input
                type="text"
                maxLength={6}
                value={settings.storeOriginPincode || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    storeOriginPincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                  })
                }
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 font-mono font-semibold focus:outline-none focus:border-brand shadow-2xs"
                placeholder="411001"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Origin City
              </label>
              <input
                type="text"
                value={settings.storeOriginCity || ""}
                onChange={(e) =>
                  setSettings({ ...settings, storeOriginCity: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs"
                placeholder="Pune"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Origin State
              </label>
              <input
                type="text"
                value={settings.storeOriginState || ""}
                onChange={(e) =>
                  setSettings({ ...settings, storeOriginState: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs"
                placeholder="Maharashtra"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Warehouse Street Address
              </label>
              <input
                type="text"
                value={settings.storeOriginAddress || ""}
                onChange={(e) =>
                  setSettings({ ...settings, storeOriginAddress: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand shadow-2xs"
                placeholder="Store4Riders Central Warehouse, Plot No 12..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Dispatch Phone Number
              </label>
              <input
                type="text"
                value={settings.storeOriginPhone || ""}
                onChange={(e) =>
                  setSettings({ ...settings, storeOriginPhone: e.target.value })
                }
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-brand shadow-2xs"
                placeholder="9876543210"
              />
            </div>
          </div>
        </div>

        {/* 3. Customer Exchanges & Window */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-[#FF5429]" />
              Exchange Window Policy
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Number of days a customer has to request a size or gear exchange after order delivery. (Store4Riders operates on an exchange-only policy; no returns or refunds).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Exchange Request Window (Days)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={settings.returnWindowDays ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setSettings({ ...settings, returnWindowDays: "" });
                    return;
                  }
                  const num = Number(raw);
                  setSettings({
                    ...settings,
                    returnWindowDays: isNaN(num) ? "" : Math.min(365, Math.max(0, num)),
                  });
                }}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs"
                placeholder="7"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Store4Riders standard window after delivery date for size/fit exchanges.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Standard Exchange 2-Way Shipping Fee (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={settings.exchangeShippingFee ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setSettings({ ...settings, exchangeShippingFee: "" });
                      return;
                    }
                    const num = Number(raw);
                    setSettings({
                      ...settings,
                      exchangeShippingFee: isNaN(num) ? "" : Math.max(0, num),
                    });
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md pl-7 pr-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-brand shadow-2xs"
                  placeholder="299"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Combined reverse pickup + replacement shipping fee borne by customer after QC passes (set 0 for free exchanges).
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#FF5429] hover:bg-[#e0451d] disabled:opacity-50 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-sm shadow-[#FF5429]/25 transition-all cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{saving ? "Saving..." : "Save Shipping Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
