"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export interface CsvPreviewRowResult {
  rowNumber: number;
  sku: string;
  name: string;
  rowType: "simple" | "configurable" | "variant" | "unknown";
  action: "create" | "update" | "variant_update" | "variant_create" | "no_change" | "skip";
  changes: string[];
  reason?: string;
}

export interface CsvMigrationPreviewReport {
  totalRows: number;
  headerAnalysis: {
    standardFields: string[];
    attributeColumns: string[];
    ignoredColumns: string[];
  };
  summary: {
    createCount: number;
    updateCount: number;
    variantUpdateCount: number;
    variantCreateCount: number;
    noChangeCount: number;
    skipCount: number;
  };
  rows: CsvPreviewRowResult[];
  truncatedNormalRows: number;
}

interface CsvValidationPreviewModalProps {
  isOpen: boolean;
  fileName: string;
  report: CsvMigrationPreviewReport | null;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

type PreviewFilter = "all" | "update" | "create" | "variant" | "skip" | "no_change";

const ACTION_BADGE_STYLES: Record<
  CsvPreviewRowResult["action"],
  { label: string; className: string }
> = {
  create: { label: "New Product", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  update: { label: "Update", className: "bg-blue-100 text-blue-800 border-blue-200" },
  variant_update: { label: "Variant Update", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  variant_create: { label: "New Variant", className: "bg-purple-100 text-purple-800 border-purple-200" },
  no_change: { label: "Unchanged", className: "bg-gray-100 text-gray-700 border-gray-200" },
  skip: { label: "Skipped", className: "bg-red-100 text-red-800 border-red-200" },
};

export function CsvValidationPreviewModal({
  isOpen,
  fileName,
  report,
  isConfirming,
  onCancel,
  onConfirm,
}: CsvValidationPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const titleId = useId();
  const tableCaptionId = useId();
  const [filter, setFilter] = useState<PreviewFilter>("all");

  useEffect(() => {
    setFilter("all");
  }, [report]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && report) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.returnValue = "";
      dialog.close();
    }
  }, [isOpen, report]);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (filter === "all") return report.rows;
    if (filter === "variant") {
      return report.rows.filter(
        (r) => r.action === "variant_update" || r.action === "variant_create"
      );
    }
    return report.rows.filter((r) => r.action === filter);
  }, [report, filter]);

  if (!report) {
    return (
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
      >
        <h1 id={titleId}>CSV Preview</h1>
      </dialog>
    );
  }

  const { summary, headerAnalysis } = report;
  const variantTotal = summary.variantUpdateCount + summary.variantCreateCount;
  const actionableCount =
    summary.createCount +
    summary.updateCount +
    summary.variantUpdateCount +
    summary.variantCreateCount;

  const isPointerOutside = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: isConfirming ? "none" : "any" } as Record<string, string>)}
      onCancel={(e) => {
        if (isConfirming) {
          e.preventDefault();
          return;
        }
        onCancel();
      }}
      onClose={() => {
        const dialog = dialogRef.current;
        if (dialog) dialog.returnValue = "";
        if (isOpen && !isConfirming) {
          onCancel();
        }
      }}
      onPointerDown={(e) => {
        if (isConfirming) return;
        pressedOutsideRef.current = isPointerOutside(e);
      }}
      onPointerUp={(e) => {
        if (isConfirming) return;
        if (pressedOutsideRef.current && isPointerOutside(e)) {
          onCancel();
        }
        pressedOutsideRef.current = false;
      }}
      className="m-auto w-[min(96vw,1080px)] max-h-[90vh] rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl overscroll-contain open:flex open:flex-col backdrop:bg-black/55 backdrop:overflow-hidden backdrop:overscroll-contain"
    >
      {/* Modal Header */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
        <div>
          <h1 id={titleId} className="text-lg font-bold text-gray-900">
            CSV Pre-Upload Validator &amp; Dry-Run Preview
          </h1>
          <p className="mt-0.5 text-xs text-gray-600">
            File: <span className="font-mono font-medium text-gray-800">{fileName}</span> • Total Rows Analyzed:{" "}
            <span className="font-semibold text-gray-900">{report.totalRows}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          aria-label="Close CSV validation preview"
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4">
        {/* DB Safety Guarantee Banner */}
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">
              Database Safe Patch Mode Active — No Data Has Been Modified Yet
            </p>
            <p className="mt-0.5 text-emerald-800">
              Blank or omitted columns will NOT wipe existing database titles, prices, stock, photos, attributes, or published status.
              Existing products are safely patched only on filled valid columns.
            </p>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-[11px] font-medium text-blue-700">Will Update</div>
            <div className="mt-0.5 text-xl font-bold text-blue-900">{summary.updateCount}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[11px] font-medium text-emerald-700">New Products</div>
            <div className="mt-0.5 text-xl font-bold text-emerald-900">{summary.createCount}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="text-[11px] font-medium text-indigo-700">Variant Updates</div>
            <div className="mt-0.5 text-xl font-bold text-indigo-900">{summary.variantUpdateCount}</div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <div className="text-[11px] font-medium text-purple-700">New Variants</div>
            <div className="mt-0.5 text-xl font-bold text-purple-900">{summary.variantCreateCount}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] font-medium text-gray-600">Unchanged</div>
            <div className="mt-0.5 text-xl font-bold text-gray-800">{summary.noChangeCount}</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-[11px] font-medium text-red-700">Will Skip</div>
            <div className="mt-0.5 text-xl font-bold text-red-900">{summary.skipCount}</div>
          </div>
        </div>

        {/* Column Mapping Overview */}
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-1.5">
          <h2 className="font-semibold text-gray-800">Detected CSV Column Mapping</h2>
          <p className="text-gray-700">
            <span className="font-medium text-gray-900">Standard Fields ({headerAnalysis.standardFields.length}):</span>{" "}
            <span className="font-mono">{headerAnalysis.standardFields.join(", ") || "None"}</span>
          </p>
          {headerAnalysis.attributeColumns.length > 0 && (
            <p className="text-gray-700">
              <span className="font-medium text-gray-900">Specification / Attribute Columns ({headerAnalysis.attributeColumns.length}):</span>{" "}
              <span className="font-mono">{headerAnalysis.attributeColumns.join(", ")}</span>
            </p>
          )}
          {headerAnalysis.ignoredColumns.length > 0 && (
            <p className="text-amber-800">
              <span className="font-medium">Ignored Magento/Legacy Columns ({headerAnalysis.ignoredColumns.length}):</span>{" "}
              <span className="font-mono">{headerAnalysis.ignoredColumns.join(", ")}</span>
            </p>
          )}
        </section>

        {summary.skipCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {summary.skipCount} row(s) will be safely skipped because of missing SKU, invalid/zero new-product price, or missing name. Other valid rows will still process normally.
            </span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "all", label: `Preview Rows (${report.rows.length})` },
              { key: "update", label: `Updates (${summary.updateCount})` },
              { key: "create", label: `Creates (${summary.createCount})` },
              { key: "variant", label: `Variants (${variantTotal})` },
              { key: "skip", label: `Skipped (${summary.skipCount})` },
              { key: "no_change", label: `Unchanged (${summary.noChangeCount})` },
            ] as { key: PreviewFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                filter === tab.key
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Accessible Scrollable Preview Table */}
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={tableCaptionId}
          className="max-h-[340px] overflow-auto overscroll-contain rounded-lg border border-gray-200"
        >
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <caption id={tableCaptionId} className="sr-only">
              Row-by-row dry-run preview of CSV migration changes
            </caption>
            <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700">
              <tr>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 font-semibold whitespace-nowrap">
                  Row
                </th>
                <th scope="col" className="sticky left-0 z-20 border-b border-gray-200 bg-gray-100 px-3 py-2 font-semibold whitespace-nowrap">
                  SKU
                </th>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 font-semibold">
                  Product / Context
                </th>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 font-semibold whitespace-nowrap">
                  Action
                </th>
                <th scope="col" className="border-b border-gray-200 px-3 py-2 font-semibold">
                  Changes / Validation Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No preview rows match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const badge = ACTION_BADGE_STYLES[row.action];
                  return (
                    <tr key={`${row.rowNumber}-${row.sku}-${row.action}`} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-3 py-2 font-mono text-gray-500 whitespace-nowrap align-top">
                        #{row.rowNumber}
                      </td>
                      <th
                        scope="row"
                        className="sticky left-0 z-[5] border-b border-gray-100 bg-white px-3 py-2 font-mono font-semibold text-gray-900 whitespace-nowrap align-top"
                      >
                        {row.sku}
                      </th>
                      <td className="border-b border-gray-100 px-3 py-2 text-gray-800 max-w-[220px] truncate align-top" title={row.name}>
                        {row.name}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap align-top">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 text-gray-700 align-top">
                        {row.reason ? (
                          <span className="font-medium text-red-700">{row.reason}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.changes.map((diff, idx) => (
                              <span
                                key={`${idx}-${diff}`}
                                className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800"
                              >
                                {diff}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {report.truncatedNormalRows > 0 && (
          <p className="text-xs text-gray-500">
            Showing first 150 non-skipped rows (+ all skipped rows).{" "}
            <span className="font-medium text-gray-700">{report.truncatedNormalRows}</span> more valid rows were verified and will be processed automatically.
          </p>
        )}
      </div>

      {/* Footer Actions — autoFocus on safe Cancel button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-xl">
        <span className="text-xs text-gray-600">
          {actionableCount > 0
            ? `${actionableCount} change(s) ready to apply cleanly.`
            : "No updates or creations detected in this CSV."}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming || actionableCount === 0}
            className={`flex items-center rounded-md px-5 py-2 text-sm font-medium text-white transition-colors ${
              isConfirming || actionableCount === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-brand hover:bg-red-800"
            }`}
          >
            {isConfirming && (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {isConfirming ? "Starting Upload..." : "Confirm & Apply Changes"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
