"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, Folder, FolderTree, X } from "lucide-react";
import {
  areCategorySlugsEquivalent,
  getStoreNavbarCategoryTree,
} from "@/core/utils/navCategories";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  group: string;
}

function isTestCategory(slug?: string, name?: string): boolean {
  const s = (slug || "").toLowerCase().trim();
  const n = (name || "").toLowerCase().trim();
  if (/^(?:test(?:[-_]|$)|root[-_]test)|[-_]test(?:[-_]|$)/.test(s)) return true;
  if (/^test\b|\broot\s+test\b/.test(n)) return true;
  return false;
}

function normalizeCategoryName(name?: string): string {
  return (name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesCategoryValue(cat: CategoryOption, val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (cat.id === trimmed || cat.slug.toLowerCase() === trimmed.toLowerCase()) {
    return true;
  }
  return areCategorySlugsEquivalent(cat.slug, trimmed);
}

function buildSelectCategoryOptions(dbCategories: any[] = []): CategoryOption[] {
  const list: CategoryOption[] = [];
  const seenSlugs: string[] = [];
  const seenNormNames = new Set<string>();
  const dbBySlug = new Map<string, any>();

  const indexDbNodes = (nodes: any[]) => {
    for (const n of nodes) {
      if (!n) continue;
      const s = String(n.slug || "").toLowerCase().trim();
      if (s && !dbBySlug.has(s)) {
        dbBySlug.set(s, n);
      }
      if (Array.isArray(n.children) && n.children.length > 0) {
        indexDbNodes(n.children);
      }
    }
  };
  indexDbNodes(dbCategories);

  const findDbMatch = (slug: string) => {
    const lower = slug.toLowerCase().trim();
    if (dbBySlug.has(lower)) return dbBySlug.get(lower);
    for (const [dbSlug, dbNode] of dbBySlug.entries()) {
      if (areCategorySlugsEquivalent(lower, dbSlug)) {
        return dbNode;
      }
    }
    return null;
  };

  const tryAddOption = (rawId: string, rawSlug: string, rawName: string, group: string) => {
    const cleanName = (rawName || "").trim();
    const cleanSlug = (rawSlug || "").toLowerCase().trim();
    if (!cleanName || !cleanSlug || cleanSlug.includes("?")) return;
    if (isTestCategory(cleanSlug, cleanName)) return;

    const alreadyHasSlug = seenSlugs.some(
      (existing) => existing === cleanSlug || areCategorySlugsEquivalent(existing, cleanSlug)
    );
    const normName = normalizeCategoryName(cleanName);
    if (alreadyHasSlug || (normName && seenNormNames.has(normName))) {
      return;
    }

    seenSlugs.push(cleanSlug);
    if (normName) seenNormNames.add(normName);

    list.push({
      id: rawId || cleanSlug,
      slug: cleanSlug,
      name: cleanName,
      group,
    });
  };

  // 1. Authoritative storefront menu hierarchy enriched with database IDs & canonical slugs
  const menuTree = getStoreNavbarCategoryTree(dbCategories);
  const traverseMenuTree = (nodes: any[], parentNames: string[] = []) => {
    for (const node of nodes) {
      const nodeSlug = String(node.slug || "").trim();
      const dbMatch = nodeSlug ? findDbMatch(nodeSlug) : null;
      const resolvedSlug = String(dbMatch?.slug || nodeSlug || node._id || node.id || "").trim();
      const resolvedId = String(dbMatch?._id || node._id || node.id || resolvedSlug);
      const resolvedName = String(node.name || dbMatch?.name || "").trim();
      const groupLabel =
        parentNames.length > 0 ? parentNames.join(" > ") : resolvedName || "Storefront Menu";

      if (resolvedSlug && resolvedName) {
        tryAddOption(resolvedId, resolvedSlug, resolvedName, groupLabel);
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        traverseMenuTree(
          node.children,
          resolvedName ? [...parentNames, resolvedName] : parentNames
        );
      }
    }
  };
  traverseMenuTree(menuTree);

  // 2. Remaining non-duplicate custom & SEO database categories
  const traverseRemainingDb = (nodes: any[], parentNames: string[] = []) => {
    for (const n of nodes) {
      if (!n || n.isDeleted) continue;
      const name = String(n.name || "").trim();
      const slug = String(n.slug || n._id || "").trim();
      const groupLabel =
        parentNames.length > 0
          ? parentNames.join(" > ")
          : n.includeInMenu === false
            ? "SEO & Special Categories"
            : "Custom Categories";

      if (name && slug) {
        tryAddOption(String(n._id || slug), slug, name, groupLabel);
      }

      if (Array.isArray(n.children) && n.children.length > 0) {
        traverseRemainingDb(n.children, name ? [...parentNames, name] : parentNames);
      }
    }
  };
  traverseRemainingDb(dbCategories);

  return list;
}

function groupCategoryOptions(options: CategoryOption[]): Record<string, CategoryOption[]> {
  const groups: Record<string, CategoryOption[]> = {};
  for (const c of options) {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  }
  return groups;
}

interface ModernCategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  dbCategories?: any[];
}

export function ModernCategorySelect({
  value,
  onChange,
  dbCategories = [],
}: ModernCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allCategories = useMemo(() => buildSelectCategoryOptions(dbCategories), [dbCategories]);

  // Filter categories by search input
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return allCategories;
    const q = search.toLowerCase();
    return allCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [allCategories, search]);

  const groupedCategories = useMemo(
    () => groupCategoryOptions(filteredCategories),
    [filteredCategories]
  );

  const selectedCategory = allCategories.find((c) => matchesCategoryValue(c, value));

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 truncate">
          <FolderTree size={16} className={selectedCategory || value ? "text-brand" : "text-slate-400"} />
          {selectedCategory ? (
            <div className="truncate">
              <span className="font-semibold text-slate-900">{selectedCategory.name}</span>
              <span className="text-[11px] text-slate-500 ml-2 font-normal">({selectedCategory.group})</span>
            </div>
          ) : value ? (
            <span className="font-semibold text-slate-700 truncate">{value}</span>
          ) : (
            <span className="text-slate-400">Select Category...</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Modern Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search bar inside dropdown */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search size={15} className="text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all categories (e.g. Visor, Jacket, Boots, Chain Care)..."
              className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Categories List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
            {Object.keys(groupedCategories).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No matching categories found for &quot;{search}&quot;.
              </div>
            ) : (
              Object.entries(groupedCategories).map(([groupName, items]) => (
                <div key={groupName} className="py-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {groupName}
                  </div>
                  {items.map((cat) => {
                    const isSelected = matchesCategoryValue(cat, value);
                    return (
                      <button
                        key={`${groupName}::${cat.id}::${cat.slug}`}
                        type="button"
                        onClick={() => {
                          onChange(cat.slug || cat.id);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                          isSelected
                            ? "bg-brand/10 text-brand font-bold"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {isSelected && <Check size={14} className="text-brand shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export interface MultiCategorySelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  dbCategories?: any[];
  primaryCategory?: string;
  placeholder?: string;
}

export function MultiCategorySelect({
  values,
  onChange,
  dbCategories = [],
  primaryCategory,
  placeholder = "Search and attach additional categories...",
}: MultiCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allCategories = useMemo(() => buildSelectCategoryOptions(dbCategories), [dbCategories]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return allCategories;
    const q = search.toLowerCase();
    return allCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [allCategories, search]);

  const groupedCategories = useMemo(
    () => groupCategoryOptions(filteredCategories),
    [filteredCategories]
  );

  const toggleCategory = (cat: CategoryOption) => {
    const targetValue = cat.slug || cat.id;
    const alreadySelected = values.some((v) => matchesCategoryValue(cat, v));
    const remaining = values.filter((v) => !matchesCategoryValue(cat, v));
    if (alreadySelected) {
      onChange(remaining);
    } else {
      onChange([...remaining, targetValue]);
    }
  };

  const removeCategory = (slugOrId: string) => {
    const meta = allCategories.find((c) => matchesCategoryValue(c, slugOrId));
    onChange(
      values.filter((v) =>
        meta ? !matchesCategoryValue(meta, v) : v.toLowerCase() !== slugOrId.toLowerCase()
      )
    );
  };

  const getCategoryMeta = (slugOrId: string) => {
    return (
      allCategories.find((c) => matchesCategoryValue(c, slugOrId)) || {
        id: slugOrId,
        slug: slugOrId,
        name: slugOrId,
        group: "Category",
      }
    );
  };

  return (
    <div ref={dropdownRef} className="space-y-2">
      {/* Attached Category Badges */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
        {values.length === 0 ? (
          <span className="text-xs text-slate-400 italic">
            No secondary categories attached. This product will only be listed under its primary category.
          </span>
        ) : (
          values.map((val) => {
            const meta = getCategoryMeta(val);
            const isPrimary =
              Boolean(primaryCategory) &&
              (val === primaryCategory || matchesCategoryValue(meta, primaryCategory));
            return (
              <span
                key={val}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  isPrimary
                    ? "bg-brand/10 text-brand border-brand/30 font-bold"
                    : "bg-white text-slate-800 border-slate-200 shadow-2xs"
                }`}
              >
                <span>{meta.name}</span>
                {isPrimary && (
                  <span className="text-[10px] bg-brand text-white px-1 rounded uppercase tracking-wider">
                    Primary
                  </span>
                )}
                {!isPrimary && (
                  <button
                    type="button"
                    onClick={() => removeCategory(val)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
                    title={`Remove from ${meta.name}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* Trigger to Open Multi-Category Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs hover:border-slate-400 transition-all cursor-pointer text-left text-slate-600"
        >
          <div className="flex items-center gap-2">
            <FolderTree size={14} className="text-slate-400" />
            <span>{placeholder}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Search size={14} className="text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories to add/remove..."
                className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
              {Object.keys(groupedCategories).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No categories found matching &quot;{search}&quot;.
                </div>
              ) : (
                Object.entries(groupedCategories).map(([groupName, items]) => (
                  <div key={groupName} className="py-1">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {groupName}
                    </div>
                    {items.map((cat) => {
                      const isChecked = values.some((val) => matchesCategoryValue(cat, val));
                      return (
                        <button
                          key={`${groupName}::${cat.id}::${cat.slug}`}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer text-left ${
                            isChecked
                              ? "bg-slate-100 text-slate-900 font-semibold"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="rounded text-brand focus:ring-brand h-3.5 w-3.5"
                          />
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
