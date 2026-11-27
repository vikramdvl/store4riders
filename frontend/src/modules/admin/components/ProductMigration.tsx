"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import { useBrands } from "@/core/hooks/useBrands";
import { downloadBrandProductCsv } from "@/core/utils/exportCsv";
import { revalidateStorefrontPaths } from "@/core/utils/revalidateStorefront";
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import {
  CsvMigrationPreviewReport,
  CsvValidationPreviewModal,
} from "./CsvValidationPreviewModal";

interface MigrationCompletionResult {
  successCount?: number;
  createdProductsCount?: number;
  updatedProductsCount?: number;
  updatedVariantsCount?: number;
  skippedGarbageCount?: number;
  failCount?: number;
  errors?: Array<{ batch?: number; sku?: string; error: string }>;
}

export function ProductMigration() {
  const queryClient = useQueryClient();
  const { data: brands = [] } = useBrands();
  const [selectedExportBrand, setSelectedExportBrand] = useState("all");
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<CsvMigrationPreviewReport | null>(null);
  const [pendingS3Key, setPendingS3Key] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<MigrationCompletionResult | null>(null);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setPreviewReport(null);
      setIsPreviewOpen(false);
      setPendingS3Key(null);
      setCompletionResult(null);
      setStatus({ type: "idle", message: "" });
    }
  };

  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [stage, setStage] = useState<"idle" | "uploading_s3" | "queueing" | "processing">("idle");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobId) {
      interval = setInterval(async () => {
        try {
          const res = await apiClient.get(`/migration/status/${jobId}`);
          const data = res.data?.data;
          if (!data) return;
          
          setProgress(data.progress || 0);
          
          if (data.state === "completed") {
            clearInterval(interval);
            setJobId(null);
            setIsUploading(false);
            setStage("idle");
            const resData: MigrationCompletionResult = data.result || {};
            setCompletionResult(resData);
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product"] });
            queryClient.invalidateQueries({ queryKey: ["products-by-skus"] });
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            queryClient.invalidateQueries({ queryKey: ["product_aggregations"] });
            queryClient.invalidateQueries({ queryKey: ["search"] });
            revalidateStorefrontPaths(["/", "/products", "/sale", "/search"]);
            setStatus({ 
              type: "success", 
              message: `Upload Complete! Successfully processed ${resData.successCount || 0} record(s) into the catalog.` 
            });
          } else if (data.state === "failed") {
            clearInterval(interval);
            setJobId(null);
            setIsUploading(false);
            setStage("idle");
            setStatus({ type: "error", message: `Upload failed: ${data.failedReason || "Processing error occurred in queue worker."}` });
          }
        } catch {
          // Transient polling errors are retried cleanly on the next tick
        }
      }, 1000); // Poll every 1 second
    }
    return () => clearInterval(interval);
  }, [jobId, queryClient]);

  const handleValidateAndPreview = async () => {
    if (!file) {
      setStatus({ type: "error", message: "Please select a file first." });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatus({ type: "error", message: "Only .csv files are allowed." });
      return;
    }

    setIsValidating(true);
    setCompletionResult(null);
    setPreviewReport(null);
    setPendingS3Key(null);
    setUploadProgress(0);
    setStatus({ type: "idle", message: "Validating CSV rows against live catalog (dry run — no DB changes yet)..." });

    try {
      let report: CsvMigrationPreviewReport | null = null;
      const MAX_SERVERLESS_MULTIPART_BYTES = 4.5 * 1024 * 1024;

      if (file.size <= MAX_SERVERLESS_MULTIPART_BYTES) {
        const formData = new FormData();
        formData.append("file", file);

        const previewRes = await apiClient.post("/migration/preview", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        report = previewRes.data?.data || null;
      } else {
        setStage("uploading_s3");
        setStatus({ type: "idle", message: "Large CSV detected: staging securely to AWS S3 for validation..." });

        const presignedRes = await apiClient.post("/migration/presigned-url", {
          fileName: file.name,
          fileType: file.type || "text/csv",
        });

        const { uploadUrl, s3Key } = presignedRes.data.data;

        await axios.put(uploadUrl, file, {
          headers: { "Content-Type": file.type || "text/csv" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            }
          },
        });

        setPendingS3Key(s3Key);
        setStage("queueing");
        setStatus({ type: "idle", message: "Inspecting CSV rows against live catalog..." });

        const previewRes = await apiClient.post("/migration/preview", {
          s3Key,
          fileName: file.name,
        });
        report = previewRes.data?.data || null;
      }

      if (!report) {
        throw new Error("Validation preview did not return a report.");
      }

      setPreviewReport(report);
      setIsPreviewOpen(true);
      setStage("idle");
      setStatus({ type: "idle", message: "" });
    } catch (error: any) {
      setStage("idle");
      setStatus({
        type: "error",
        message:
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Failed to validate CSV file. Please verify headers and format.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmMigration = async () => {
    if (!file && !pendingS3Key) {
      setStatus({ type: "error", message: "Please select a CSV file first." });
      return;
    }

    setIsPreviewOpen(false);
    setIsUploading(true);
    setProgress(0);
    setUploadProgress(0);
    setCompletionResult(null);
    setStatus({ type: "idle", message: "Initializing bulk catalog update..." });

    try {
      let activeJobId: string | null = null;

      if (pendingS3Key) {
        setStage("queueing");
        setStatus({ type: "idle", message: "Enqueueing validated CSV from AWS S3..." });

        const startRes = await apiClient.post("/migration/start", {
          s3Key: pendingS3Key,
          fileName: file?.name,
        });
        activeJobId = startRes.data?.data?.jobId;
      } else if (file) {
        // Attempt direct-to-S3 presigned upload first, with multipart fallback for smaller CSVs
        try {
          setStage("uploading_s3");
          setStatus({ type: "idle", message: "Step 1/2: Uploading validated CSV to AWS S3 storage..." });

          const presignedRes = await apiClient.post("/migration/presigned-url", {
            fileName: file.name,
            fileType: file.type || "text/csv",
          });

          const { uploadUrl, s3Key } = presignedRes.data.data;

          await axios.put(uploadUrl, file, {
            headers: {
              "Content-Type": file.type || "text/csv",
            },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(percent);
              }
            },
          });

          setStage("queueing");
          setStatus({ type: "idle", message: "Step 2/2: Enqueueing background migration job..." });

          const startRes = await apiClient.post("/migration/start", {
            s3Key,
            fileName: file.name,
          });

          activeJobId = startRes.data?.data?.jobId;
        } catch (s3Error: any) {
          if (file.size > 4.5 * 1024 * 1024) {
            throw new Error(
              s3Error.response?.data?.message ||
              s3Error.message ||
              `S3 direct upload failed and file (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds serverless payload limits. Please verify AWS S3 credentials.`
            );
          }

          setStatus({ type: "idle", message: "Direct S3 unavailable. Uploading via server route..." });
          const formData = new FormData();
          formData.append("file", file);

          const response = await apiClient.post("/migration/upload", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          activeJobId = response.data?.data?.jobId;
        }
      }

      if (activeJobId) {
        setJobId(activeJobId);
        setStage("processing");
        setStatus({ type: "idle", message: "CSV queued! BullMQ worker is applying catalog updates..." });
      } else {
        setIsUploading(false);
        setStage("idle");
        setStatus({ type: "error", message: "Failed to obtain migration Job ID from server." });
      }

      setPendingS3Key(null);
      setPreviewReport(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      setIsUploading(false);
      setStage("idle");
      setStatus({ 
        type: "error", 
        message: error.response?.data?.error || error.response?.data?.message || error.message || "Failed to upload the file. Please try again." 
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Bulk Product Upload & CSV Manager</h1>
        <p className="text-gray-600">
          Export products by brand to easily review and update prices, stocks, and variants in Excel / Google Sheets, or upload your completed CSV file below.
        </p>
      </div>

      {/* Brand CSV Download Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ArrowDownTrayIcon className="w-5 h-5 text-emerald-600" />
              Download Products CSV by Brand
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select a brand to download only its products in Magento-standard CSV format. Edit prices or stocks in your spreadsheet and upload it back below.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedExportBrand}
              onChange={(e) => setSelectedExportBrand(e.target.value)}
              className="text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 min-w-[200px]"
            >
              <option value="all">🌐 All Brands (Full Catalog)</option>
              {brands.map((b) => (
                <option key={b._id} value={b.name}>
                  🏷️ {b.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => downloadBrandProductCsv(selectedExportBrand)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
        <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
          <ArrowUpTrayIcon className="w-5 h-5 text-brand" />
          Upload Updated CSV
        </h2>

        {/* Informative CSV Column & Variant Guide */}
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">
              📘 CSV Column Reference & Formatting Guide (For Admin)
            </span>
            <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
              45 Base Columns + Attributes
            </span>
          </div>

          <p className="text-slate-600 leading-relaxed text-[11.5px]">
            This bulk upload processes Magento & Store4Riders product spreadsheets. It automatically supports parent configurable products, individual child size/color variants, and color swatches.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-[11px]">
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 font-sans block text-xs border-b border-slate-100 pb-1">
                1. Product & Identification
              </span>
              <div><strong className="text-brand">sku</strong>: Master or Variant SKU</div>
              <div><strong className="text-brand">name</strong>: Full Title</div>
              <div><strong className="text-brand">product_type</strong>: simple / configurable</div>
              <div><strong className="text-brand">brand</strong>: Brand Name</div>
              <div><strong className="text-brand">categories</strong>: Category Path</div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 font-sans block text-xs border-b border-slate-100 pb-1">
                2. Price, Stock & Visibility
              </span>
              <div><strong className="text-brand">price</strong>: Base Selling Price (₹)</div>
              <div><strong className="text-brand">special_price</strong>: Offer Price (₹)</div>
              <div><strong className="text-brand">qty</strong>: Stock Quantity Count</div>
              <div><strong className="text-brand">is_in_stock</strong>: 1 (In) / 0 (Out)</div>
              <div><strong className="text-brand">status</strong>: 1 (Enabled) / 0 (Disabled)</div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 font-sans block text-xs border-b border-slate-100 pb-1">
                3. Shipping, Dimensions &amp; Variants
              </span>
              <div><strong className="text-brand">weight</strong> + <strong className="text-brand">weight_unit</strong> (kg / g / ml / L)</div>
              <div><strong className="text-brand">length, breadth, height</strong> + <strong className="text-brand">dimension_unit</strong> (cm / in / mm)</div>
              <div><strong className="text-brand">dimensions / lbh</strong>: <code className="text-[10px]">36x28x28</code></div>
              <div><strong className="text-brand">ship_cost</strong>: Heavy item fee (₹)</div>
              <div className="pt-0.5"><strong className="text-brand">configurable_variations</strong>:</div>
              <div className="text-[10px] text-slate-600 font-sans leading-tight pl-2 truncate">
                <code>sku=SKU-1,price=4500,qty=10,color=Black,size=M|...</code>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
            <span>
              💡 <strong>Safe Partial Bulk Update:</strong> You can upload a focused CSV with only <code className="font-bold">sku</code> and <code className="font-bold">weight, length, breadth, height</code> (or <code className="font-bold">qty, price</code>) — omitted titles, slugs, photos, stock, and specifications are preserved automatically!
            </span>
          </div>
        </div>
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mb-4" />
          
          <p className="text-lg font-medium text-gray-700 mb-1">
            {file ? file.name : "Click to select Magento CSV"}
          </p>
          <p className="text-sm text-gray-500">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Only .csv files are supported"}
          </p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv"
            onChange={handleFileChange}
          />
        </div>

        {status.message && (
          <div className={`mt-6 p-4 rounded-md ${status.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : status.type === "error" ? "bg-red-50 text-red-800 border border-red-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
            <div className="flex items-center">
              {status.type === "success" ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 shrink-0" />
              ) : status.type === "error" ? (
                <XCircleIcon className="h-5 w-5 text-red-500 mr-2 shrink-0" />
              ) : (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2 shrink-0" />
              )}
              <span className="font-medium">{status.message}</span>
            </div>
            
            {stage === "uploading_s3" && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1 font-medium text-blue-800">
                  <span>Uploading to AWS S3...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2.5">
                  <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {jobId && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1 font-medium text-blue-800">
                  <span>Processing Catalog into Database...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2.5">
                  <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {status.type === "success" && completionResult && (
              <div className="mt-4 space-y-3 border-t border-green-200 pt-3 text-xs">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded border border-green-200 bg-white px-3 py-2">
                    <div className="text-gray-500">Created Products</div>
                    <div className="text-base font-bold text-emerald-700">
                      {completionResult.createdProductsCount ?? 0}
                    </div>
                  </div>
                  <div className="rounded border border-green-200 bg-white px-3 py-2">
                    <div className="text-gray-500">Updated Products</div>
                    <div className="text-base font-bold text-blue-700">
                      {completionResult.updatedProductsCount ?? 0}
                    </div>
                  </div>
                  <div className="rounded border border-green-200 bg-white px-3 py-2">
                    <div className="text-gray-500">Variants Updated</div>
                    <div className="text-base font-bold text-indigo-700">
                      {completionResult.updatedVariantsCount ?? 0}
                    </div>
                  </div>
                  <div className="rounded border border-green-200 bg-white px-3 py-2">
                    <div className="text-gray-500">Skipped Rows</div>
                    <div className="text-base font-bold text-amber-700">
                      {completionResult.skippedGarbageCount ?? 0}
                    </div>
                  </div>
                </div>

                {completionResult.errors && completionResult.errors.length > 0 && (
                  <details className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                    <summary className="cursor-pointer font-semibold">
                      View {completionResult.errors.length} batch warning/error(s)
                    </summary>
                    <ul className="mt-2 list-disc list-inside space-y-1 font-mono text-[11px]">
                      {completionResult.errors.map((err, idx) => (
                        <li key={idx}>
                          {err.sku ? `[${err.sku}] ` : err.batch ? `[Batch ${err.batch}] ` : ""}
                          {err.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleValidateAndPreview}
            disabled={!file || isUploading || isValidating}
            className={`px-6 py-2 rounded-md font-medium text-white transition-colors flex items-center ${
              !file || isUploading || isValidating ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800"
            }`}
          >
            {(isValidating || isUploading) && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin -ml-1 mr-2" />
            )}
            {isValidating ? "Validating CSV..." : isUploading ? "Uploading & Processing..." : "Validate & Preview CSV"}
          </button>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-blue-900 font-semibold flex items-center mb-2">
          <InformationCircleIcon className="w-5 h-5 mr-2 shrink-0 text-blue-600" />
          How it works
        </h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>This process validates all rows first in a popup preview before making any database updates.</li>
          <li>Products with the same SKU safely patch ONLY filled columns without wiping existing fields or photos.</li>
          <li>New products, SKU renames (<code className="font-mono">old_sku</code>), and configurable variants merge automatically.</li>
          <li>All extra columns from Magento are automatically saved cleanly into database attributes without losing existing specs.</li>
        </ul>
      </div>

      <CsvValidationPreviewModal
        isOpen={isPreviewOpen}
        fileName={file?.name || ""}
        report={previewReport}
        isConfirming={isUploading}
        onCancel={() => {
          setIsPreviewOpen(false);
          setStatus({ type: "idle", message: "" });
        }}
        onConfirm={handleConfirmMigration}
      />
    </div>
  );
}
