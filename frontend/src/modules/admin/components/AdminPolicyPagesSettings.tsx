"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { revalidateStorefrontPaths } from "@/core/utils/revalidateStorefront";
import {
  FileText,
  Save,
  RotateCcw,
  Eye,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  ExternalLink,
  Code2,
  Table as TableIcon,
  List,
  ListOrdered,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Baseline,
  Highlighter,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Quote,
  Link as LinkIcon,
  RemoveFormatting,
  Heading,
  Clock,
  ShieldCheck,
  Truck,
  ArrowLeftRight,
  BookOpen,
  Lock,
  Scale,
  Compass,
  Wrench,
  HeartHandshake
} from "lucide-react";
import Button from "@/components/ui/Button";
import { apiClient } from "@/core/api/client";
import { IPolicyPageConfig } from "@store4riders/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { OFFICIAL_PAGE_DEFINITIONS } from "./AdminPolicyPagesSettings.defaults";

const FONT_SIZES = [
  { label: "12px", value: "12px", name: "12px Small" },
  { label: "14px", value: "14px", name: "14px Compact" },
  { label: "16px", value: "16px", name: "16px Normal" },
  { label: "18px", value: "18px", name: "18px Medium" },
  { label: "20px", value: "20px", name: "20px Large" },
  { label: "24px", value: "24px", name: "24px H3" },
  { label: "28px", value: "28px", name: "28px H2" },
  { label: "32px", value: "32px", name: "32px H1" },
];

const TEXT_COLORS = [
  { name: "Charcoal (Default)", value: "#0f172a" },
  { name: "Brand Red", value: "#AB1509" },
  { name: "Royal Blue", value: "#2563eb" },
  { name: "Emerald Green", value: "#059669" },
  { name: "Amber Orange", value: "#d97706" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Muted Slate", value: "#64748b" },
];

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Soft Green", value: "#bbf7d0" },
  { name: "Soft Blue", value: "#bfdbfe" },
  { name: "Soft Pink", value: "#fbcfe8" },
  { name: "Soft Peach", value: "#fed7aa" },
  { name: "Clear / None", value: "transparent" },
];

// Sub-component: Visual Rich WYSIWYG Editor
interface VisualEditorProps {
  html: string;
  onChange: (newHtml: string) => void;
}

function VisualRichEditor({ html, onChange }: VisualEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);

  const [currentFontSize, setCurrentFontSize] = useState("16px");
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isHighlightOpen, setIsHighlightOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#2563eb");
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync incoming HTML changes only when editor content differs significantly
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html || "<p><br></p>";
      }
    }
    isInternalUpdate.current = false;
  }, [html]);

  // Close color dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node)) {
        setIsTextColorOpen(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
        setIsHighlightOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    }
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const applyFontSize = (sizePx: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      toast.info("Please select text to change font size");
      return;
    }
    try {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("fontSize", false, "7");
      if (editorRef.current) {
        const fontTags = editorRef.current.querySelectorAll('font[size="7"]');
        fontTags.forEach((font) => {
          const span = document.createElement("span");
          span.style.fontSize = sizePx;
          span.innerHTML = font.innerHTML;
          font.parentNode?.replaceChild(span, font);
        });
        setCurrentFontSize(sizePx);
        editorRef.current.focus();
        handleInput();
      }
    } catch {
      // Fallback
    }
  };

  const stepFontSize = (direction: "up" | "down") => {
    const numericCurrent = parseInt(currentFontSize, 10) || 16;
    let newIndex = FONT_SIZES.findIndex((s) => parseInt(s.value, 10) === numericCurrent);
    if (newIndex === -1) newIndex = 2;

    if (direction === "up" && newIndex < FONT_SIZES.length - 1) {
      applyFontSize(FONT_SIZES[newIndex + 1].value);
    } else if (direction === "down" && newIndex > 0) {
      applyFontSize(FONT_SIZES[newIndex - 1].value);
    }
  };

  const applyTextColor = (color: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      toast.info("Please select text to change color");
      return;
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    handleInput();
    setIsTextColorOpen(false);
  };

  const applyHighlight = (color: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      toast.info("Please select text to highlight");
      return;
    }
    try {
      if (!document.execCommand("hiliteColor", false, color)) {
        document.execCommand("backColor", false, color);
      }
    } catch {
      document.execCommand("backColor", false, color);
    }
    handleInput();
    setIsHighlightOpen(false);
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter destination URL (e.g. /returns or https://...):", "/");
    if (url) {
      exec("createLink", url);
    }
  };

  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0;">
        <thead>
          <tr>
            <th style="background-color: #f8fafc; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; text-align: left;">Category</th>
            <th style="background-color: #f8fafc; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; text-align: left;">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 0.75rem 1rem; border: 1px solid #e2e8f0;">Item 1</td>
            <td style="padding: 0.75rem 1rem; border: 1px solid #e2e8f0;">Description 1</td>
          </tr>
          <tr>
            <td style="padding: 0.75rem 1rem; border: 1px solid #e2e8f0;">Item 2</td>
            <td style="padding: 0.75rem 1rem; border: 1px solid #e2e8f0;">Description 2</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, tableHtml);
    handleInput();
  };

  const handleInsertCallout = () => {
    const calloutHtml = `
      <blockquote style="border-left: 4px solid #AB1509; background-color: #fdf2f2; padding: 1rem 1.25rem; border-radius: 0 0.75rem 0.75rem 0; color: #7f1d1d; margin: 1.5rem 0;">
        <strong>Important Policy Notice:</strong> Enter your highlighted advice or instructions here...
      </blockquote>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, calloutHtml);
    handleInput();
  };

  return (
    <div className="border border-neutral-300 rounded-xl overflow-hidden shadow-xs bg-white">
      {/* Visual Editor Toolbar */}
      <div className="bg-neutral-100/90 border-b border-neutral-200 p-2 flex flex-wrap items-center gap-1.5 text-xs select-none sticky top-0 z-10">
        {/* Paragraph / Heading Block Selector */}
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === "p") exec("formatBlock", "<p>");
            else if (val === "h2") exec("formatBlock", "<h2>");
            else if (val === "h3") exec("formatBlock", "<h3>");
            else if (val === "h4") exec("formatBlock", "<h4>");
          }}
          className="text-xs py-1 px-2 bg-white border border-neutral-300 rounded-md font-medium text-neutral-800 focus:outline-none focus:border-brand cursor-pointer shadow-2xs mr-1"
        >
          <option value="p">¶ Paragraph</option>
          <option value="h2">H2 Section Heading</option>
          <option value="h3">H3 Sub-Heading</option>
          <option value="h4">H4 Small Header</option>
        </select>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        {/* Text Style Controls */}
        <button
          type="button"
          onClick={() => exec("bold")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all font-bold cursor-pointer"
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec("italic")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all italic cursor-pointer"
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec("underline")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all underline cursor-pointer"
          title="Underline (Ctrl+U)"
        >
          <Underline size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec("strikeThrough")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all cursor-pointer"
          title="Strikethrough"
        >
          <Strikethrough size={14} />
        </button>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        {/* Font Size Steppers & Dropdown */}
        <div className="flex items-center gap-0.5 bg-white border border-neutral-300 rounded-lg p-0.5 shadow-2xs">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => stepFontSize("down")}
            title="Decrease Font Size (A-)"
            className="px-1.5 py-0.5 hover:bg-neutral-100 text-neutral-700 rounded text-xs font-bold cursor-pointer transition-colors"
          >
            A-
          </button>

          <div className="flex items-center px-1">
            <Type size={13} className="text-neutral-400 mr-1 shrink-0" />
            <select
              value={currentFontSize}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => applyFontSize(e.target.value)}
              className="text-xs font-semibold text-neutral-800 bg-transparent focus:outline-none cursor-pointer pr-1"
              title="Font Size"
            >
              {FONT_SIZES.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => stepFontSize("up")}
            title="Increase Font Size (A+)"
            className="px-1.5 py-0.5 hover:bg-neutral-100 text-neutral-700 rounded text-xs font-bold cursor-pointer transition-colors"
          >
            A+
          </button>
        </div>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        {/* Text Font Color Picker */}
        <div className="relative" ref={textColorRef}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setIsTextColorOpen(!isTextColorOpen);
              setIsHighlightOpen(false);
            }}
            title="Text Font Color"
            className="p-1.5 hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 rounded cursor-pointer flex items-center gap-1 transition-all"
          >
            <Baseline size={14} className="text-brand" />
            <span className="text-[11px] font-semibold hidden sm:inline">Color</span>
            <ChevronDown size={10} className="text-neutral-400" />
          </button>

          {isTextColorOpen && (
            <div
              className="absolute left-0 mt-1.5 w-52 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in duration-100"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 pb-1 border-b border-neutral-100">
                Preset Colors
              </div>
              <div className="grid grid-cols-7 gap-1.5 pt-0.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(c.value)}
                    title={c.name}
                    className="w-5 h-5 rounded-md hover:scale-125 transition-transform cursor-pointer shadow-2xs border border-neutral-300"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-neutral-600">Custom Color:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      applyTextColor(e.target.value);
                    }}
                    className="w-6 h-6 rounded cursor-pointer border border-neutral-300 p-0"
                    title="Choose Custom Color"
                  />
                  <span className="font-mono text-[10px] text-neutral-500 uppercase">{customColor}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Text Highlight Background Color */}
        <div className="relative" ref={highlightRef}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setIsHighlightOpen(!isHighlightOpen);
              setIsTextColorOpen(false);
            }}
            title="Highlight Marker Color"
            className="p-1.5 hover:bg-amber-50 text-amber-800 border border-transparent hover:border-amber-300 rounded cursor-pointer flex items-center gap-1 transition-all"
          >
            <Highlighter size={14} />
            <span className="text-[11px] font-semibold hidden sm:inline">Highlight</span>
            <ChevronDown size={10} className="text-neutral-400" />
          </button>

          {isHighlightOpen && (
            <div
              className="absolute left-0 mt-1.5 w-52 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in duration-100"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 pb-1 border-b border-neutral-100">
                Highlight Palette
              </div>
              <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlight(c.value)}
                    title={c.name}
                    className="w-6 h-6 rounded-md hover:scale-125 transition-transform cursor-pointer shadow-2xs border border-neutral-300 flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: c.value === "transparent" ? "#ffffff" : c.value }}
                  >
                    {c.value === "transparent" ? "✕" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        {/* Text Alignment */}
        <button
          type="button"
          onClick={() => exec("justifyLeft")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all cursor-pointer"
          title="Align Left"
        >
          <AlignLeft size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec("justifyCenter")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all cursor-pointer"
          title="Align Center"
        >
          <AlignCenter size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec("justifyRight")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all cursor-pointer"
          title="Align Right"
        >
          <AlignRight size={14} />
        </button>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all flex items-center gap-1 cursor-pointer"
          title="Bullet List"
        >
          <List size={14} />
        </button>

        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="p-1.5 rounded hover:bg-white text-neutral-700 hover:text-neutral-900 border border-transparent hover:border-neutral-300 transition-all flex items-center gap-1 cursor-pointer"
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </button>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        {/* Rich Blocks: Callout, Table, Link */}
        <button
          type="button"
          onClick={handleInsertCallout}
          className="px-2 py-1 rounded bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
          title="Insert Callout Notice Box"
        >
          <Quote size={12} className="text-brand" />
          <span>Callout Box</span>
        </button>

        <button
          type="button"
          onClick={handleInsertTable}
          className="px-2 py-1 rounded bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
          title="Insert Responsive Table"
        >
          <TableIcon size={12} className="text-blue-600" />
          <span>Table</span>
        </button>

        <button
          type="button"
          onClick={handleInsertLink}
          className="px-2 py-1 rounded bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
          title="Insert Hyperlink"
        >
          <LinkIcon size={12} className="text-emerald-600" />
          <span>Link</span>
        </button>

        <div className="h-4 w-px bg-neutral-300 mx-0.5" />

        <button
          type="button"
          onClick={() => exec("removeFormat")}
          className="p-1.5 rounded hover:bg-white text-neutral-500 hover:text-neutral-800 border border-transparent hover:border-neutral-300 transition-all cursor-pointer"
          title="Clear Formatting"
        >
          <RemoveFormatting size={13} />
        </button>
      </div>

      {/* Visual Canvas Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        className="p-6 min-h-[420px] focus:outline-none policy-prose text-slate-800 text-sm leading-relaxed overflow-y-auto cursor-text"
        style={{ minHeight: "420px" }}
      />
    </div>
  );
}

const POLICY_SLUG_ALIASES: Record<string, string> = {
  returns: "returns-replacements-store4riders",
  shipping: "shipping-policies-store4riders",
  terms: "store4riders-conditions-of-use-and-sale",
  privacy: "privacy-policy-cookie-restriction-mode",
  legal: "legal-stuff",
  "store-policies": "store4riders-store-policies",
  "about-us": "about-us-store4riders",
  "contact-us": "contact-store4riders",
  contact: "contact-store4riders",
};

function resolvePolicySlug(rawSlug?: string | null): string {
  const normalized = (rawSlug || "").trim().toLowerCase();
  const mapped = POLICY_SLUG_ALIASES[normalized] || normalized;
  if (mapped && OFFICIAL_PAGE_DEFINITIONS.some((d) => d.slug === mapped)) {
    return mapped;
  }
  return OFFICIAL_PAGE_DEFINITIONS[0]?.slug || "returns-replacements-store4riders";
}

export function AdminPolicyPagesSettings() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string>(() => resolvePolicySlug(pageParam));
  const [editorMode, setEditorMode] = useState<"visual" | "html" | "preview">("visual");

  useEffect(() => {
    if (pageParam) {
      setActiveSlug(resolvePolicySlug(pageParam));
    }
  }, [pageParam]);

  // State holding all policy pages
  const [pagesMap, setPagesMap] = useState<Record<string, IPolicyPageConfig>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ data: any }>("/settings");
      const existingPages: IPolicyPageConfig[] = res.data?.data?.policyPages || [];

      const initialMap: Record<string, IPolicyPageConfig> = {};

      OFFICIAL_PAGE_DEFINITIONS.forEach((def) => {
        const found = existingPages.find(
          (p) =>
            p?.slug === def.slug ||
            (typeof p?.slug === "string" && POLICY_SLUG_ALIASES[p.slug] === def.slug)
        );
        if (found) {
          initialMap[def.slug] = { ...found, slug: def.slug };
        } else {
          // Initialize with default template values
          initialMap[def.slug] = {
            slug: def.slug,
            title: def.defaultTitle,
            subtitle: def.defaultSubtitle,
            badge: def.defaultBadge,
            lastUpdated: "October 2026",
            summaryAlertTitle: def.defaultAlert?.title || "",
            summaryAlertText: def.defaultAlert?.text || "",
            summaryAlertType: def.defaultAlert?.type || "info",
            contentHtml: def.defaultHtml,
            isActive: true,
          };
        }
      });

      setPagesMap(initialMap);
    } catch (err: any) {
      toast.error("Failed to load page content settings");
    } finally {
      setLoading(false);
    }
  };

  const currentDef =
    OFFICIAL_PAGE_DEFINITIONS.find((d) => d.slug === activeSlug) ??
    OFFICIAL_PAGE_DEFINITIONS[0];
  const currentPage = pagesMap[currentDef.slug] || pagesMap[activeSlug] || {
    slug: currentDef.slug,
    title: currentDef.defaultTitle,
    subtitle: currentDef.defaultSubtitle,
    badge: currentDef.defaultBadge,
    lastUpdated: "October 2026",
    summaryAlertTitle: currentDef.defaultAlert?.title || "",
    summaryAlertText: currentDef.defaultAlert?.text || "",
    summaryAlertType: currentDef.defaultAlert?.type || "info",
    contentHtml: currentDef.defaultHtml,
    isActive: true,
  };

  const updateCurrentPage = (field: keyof IPolicyPageConfig, value: any) => {
    setPagesMap((prev) => ({
      ...prev,
      [activeSlug]: {
        ...currentPage,
        [field]: value,
      },
    }));
  };

  const handleResetToDefault = () => {
    if (
      window.confirm(
        `Reset "${currentDef.name}" to the official Store4Riders default content? Any unsaved edits will be replaced with official copy.`
      )
    ) {
      setPagesMap((prev) => ({
        ...prev,
        [activeSlug]: {
          slug: currentDef.slug,
          title: currentDef.defaultTitle,
          subtitle: currentDef.defaultSubtitle,
          badge: currentDef.defaultBadge,
          lastUpdated: "October 2026",
          summaryAlertTitle: currentDef.defaultAlert?.title || "",
          summaryAlertText: currentDef.defaultAlert?.text || "",
          summaryAlertType: currentDef.defaultAlert?.type || "info",
          contentHtml: currentDef.defaultHtml,
          isActive: true,
        },
      }));
      toast.info(`Loaded default template for ${currentDef.name}`);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const policyPagesArray = Object.values(pagesMap);

      await apiClient.put("/settings", {
        policyPages: policyPagesArray,
      });

      queryClient.invalidateQueries({ queryKey: ["publicSettings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      const aliasPaths = Object.keys(POLICY_SLUG_ALIASES).map((a) => `/${a}`);
      revalidateStorefrontPaths([
        ...policyPagesArray.map((p) =>
          p?.slug ? (p.slug.startsWith("/") ? p.slug : `/${p.slug}`) : undefined
        ),
        ...aliasPaths,
      ]);

      toast.success("Policy & page contents saved successfully! Live website updated.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save page contents");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-12 flex items-center justify-center min-h-[350px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-500 font-medium">Loading policy pages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-neutral-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" />
            <span>Policy &amp; Page Content Editor</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Easily update text, headings, clauses, and alert banners for all 12 store policy pages using the Visual Rich Editor or HTML mode.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-neutral-300 text-neutral-600 hover:text-red-600 hover:border-red-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Official Default</span>
          </button>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand hover:bg-brand/90 text-white text-xs px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-sm"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Pages</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Page Selector Tabs */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
          <div className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-2">
            <span>Select Page to Edit ({OFFICIAL_PAGE_DEFINITIONS.length} Pages Available)</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-normal normal-case">
              Includes About Us, Contact Us, Returns, Shipping, Policies &amp; Guides
            </span>
          </div>
          <span className="text-xs text-neutral-500 font-medium">
            Active: <strong className="text-brand font-bold">{currentDef.name}</strong> (<code className="text-xs font-mono">/{currentDef.slug}</code>)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {OFFICIAL_PAGE_DEFINITIONS.map((def) => {
            const isActive = activeSlug === def.slug;
            const Icon = def.icon;
            return (
              <button
                key={def.slug}
                type="button"
                onClick={() => setActiveSlug(def.slug)}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-brand text-white shadow-xs ring-2 ring-brand/30"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 border border-neutral-200/60"
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-neutral-500"} />
                <span>{def.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-600"
                }`}>
                  /{def.slug}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor & Preview Split Panel */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        {/* Sub-Header Toolbar with 3 Modes */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-800">
              Editing: <span className="text-brand">/{currentPage.slug || currentDef.slug}</span> ({currentDef.name})
            </span>
            <a
              href={`/${currentPage.slug || currentDef.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium ml-2"
            >
              <span>View Live Page</span>
              <ExternalLink size={11} />
            </a>
          </div>

          {/* 3-Mode Switcher */}
          <div className="flex items-center bg-neutral-200/80 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setEditorMode("visual")}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                editorMode === "visual" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Edit3 size={13} className="text-brand" />
              <span>Visual Rich Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("html")}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                editorMode === "html" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Code2 size={13} className="text-blue-600" />
              <span>HTML Source</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("preview")}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                editorMode === "preview" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Eye size={13} className="text-emerald-600" />
              <span>Storefront Preview</span>
            </button>
          </div>
        </div>

        {/* Content Body Based on Selected Mode */}
        <div className="p-6 space-y-6">
          {/* Metadata Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Page Title (H1)</label>
              <input
                type="text"
                value={currentPage.title}
                onChange={(e) => updateCurrentPage("title", e.target.value)}
                placeholder="Page Title"
                className="w-full text-xs p-2.5 bg-white border border-neutral-200 rounded-lg font-bold focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Canonical URL Path (Fixed)
              </label>
              <div className="flex items-center">
                <span className="text-xs text-neutral-400 font-mono px-2 py-2.5 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-lg select-none">/</span>
                <input
                  type="text"
                  value={currentDef.slug}
                  readOnly
                  aria-label="Canonical URL Path"
                  title="Canonical URL is fixed for SEO and footer link integrity. Use Page Redirects (301/302) to redirect another URL here."
                  className="w-full text-xs p-2.5 bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-r-lg font-mono cursor-not-allowed focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Fixed for SEO. To redirect an old URL here, use Page Redirects.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Badge Pill Text</label>
              <input
                type="text"
                value={currentPage.badge || ""}
                onChange={(e) => updateCurrentPage("badge", e.target.value)}
                placeholder="e.g. Size & Fit Guarantee"
                className="w-full text-xs p-2.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Last Updated Tag</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentPage.lastUpdated || ""}
                  onChange={(e) => updateCurrentPage("lastUpdated", e.target.value)}
                  placeholder="e.g. October 2026"
                  className="w-full text-xs p-2.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => {
                    const today = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
                    updateCurrentPage("lastUpdated", today);
                  }}
                  className="shrink-0 px-2.5 py-1 text-[11px] bg-neutral-100 hover:bg-neutral-200 rounded-lg font-medium text-neutral-700 cursor-pointer"
                >
                  Today
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Page Subtitle (Overview)</label>
            <textarea
              rows={2}
              value={currentPage.subtitle || ""}
              onChange={(e) => updateCurrentPage("subtitle", e.target.value)}
              placeholder="Brief summary sentence explaining the policy..."
              className="w-full text-xs p-2.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-brand leading-relaxed"
            />
          </div>

          {/* Highlight Alert Box Config */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>Highlight Alert Card (Displayed prominently inside Page Hero)</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Alert Style</label>
                <select
                  value={currentPage.summaryAlertType || "info"}
                  onChange={(e) => updateCurrentPage("summaryAlertType", e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-brand cursor-pointer"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="warning">Warning (Amber)</option>
                  <option value="success">Success (Emerald)</option>
                  <option value="brand">Brand Accent (Red)</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Alert Headline</label>
                <input
                  type="text"
                  value={currentPage.summaryAlertTitle || ""}
                  onChange={(e) => updateCurrentPage("summaryAlertTitle", e.target.value)}
                  placeholder="e.g. Strict Exchange-Only Policy"
                  className="w-full text-xs p-2 bg-white border border-neutral-200 rounded-lg font-bold focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Alert Message</label>
              <textarea
                rows={2}
                value={currentPage.summaryAlertText || ""}
                onChange={(e) => updateCurrentPage("summaryAlertText", e.target.value)}
                placeholder="Key notice or summary text displayed prominently in the alert card..."
                className="w-full text-xs p-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Editor Area based on editorMode */}
          {editorMode === "visual" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-brand" />
                  <span>Visual Rich Text Editor (Type normally, select text &amp; format)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setEditorMode("html")}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Code2 size={12} />
                  <span>Switch to Raw HTML Mode</span>
                </button>
              </div>

              <VisualRichEditor
                html={currentPage.contentHtml || ""}
                onChange={(newHtml) => updateCurrentPage("contentHtml", newHtml)}
              />

              <p className="text-[11px] text-neutral-500">
                💡 Tip: You can type freely like Word or Google Docs. Click <strong>Callout Box</strong> to insert highlighted notes or <strong>Table</strong> to insert comparison tables.
              </p>
            </div>
          )}

          {editorMode === "html" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Code2 size={14} className="text-blue-600" />
                  <span>HTML Source Code Mode (Direct code editing)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setEditorMode("visual")}
                  className="text-xs text-brand hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Edit3 size={12} />
                  <span>Switch Back to Visual Rich Editor</span>
                </button>
              </div>

              <textarea
                rows={18}
                value={currentPage.contentHtml || ""}
                onChange={(e) => updateCurrentPage("contentHtml", e.target.value)}
                placeholder="<h2>1. Section Title</h2><p>Content text...</p>"
                className="w-full text-xs font-mono p-4 bg-slate-900 text-emerald-400 border border-neutral-700 rounded-xl focus:outline-none focus:border-brand leading-relaxed"
              />
            </div>
          )}

          {editorMode === "preview" && (
            <div className="p-8 bg-slate-50 min-h-[500px] rounded-xl border border-neutral-200">
              <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase">
                      {currentPage.badge || "Official Policy"}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      Last Updated: {currentPage.lastUpdated || "October 2026"}
                    </span>
                  </div>
                  <h1 className="text-3xl font-black text-slate-900">{currentPage.title}</h1>
                  {currentPage.subtitle && (
                    <p className="text-slate-600 text-sm mt-2">{currentPage.subtitle}</p>
                  )}
                </div>

                {currentPage.summaryAlertText && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm ${
                    currentPage.summaryAlertType === "warning"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : currentPage.summaryAlertType === "brand"
                      ? "bg-brand/5 border-brand/20 text-brand-dark"
                      : currentPage.summaryAlertType === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}>
                    <Info className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                    <div>
                      {currentPage.summaryAlertTitle && (
                        <div className="font-bold mb-0.5">{currentPage.summaryAlertTitle}</div>
                      )}
                      <div>{currentPage.summaryAlertText}</div>
                    </div>
                  </div>
                )}

                <div
                  className="policy-prose break-words max-w-none text-slate-700 text-sm leading-relaxed border-t border-slate-100 pt-6"
                  dangerouslySetInnerHTML={{ __html: currentPage.contentHtml || "<p className='italic text-slate-400'>No content written yet.</p>" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
