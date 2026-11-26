"use client";

import React, { useMemo, useState } from "react";
import {
  useUrlRedirects,
  useCreateUrlRedirect,
  useUpdateUrlRedirect,
  useDeleteUrlRedirect,
} from "@/core/hooks/useUrlRedirects";
import { useCategoryTree, ICategoryTree } from "@/core/hooks/useCategories";
import { IUrlRedirect, UrlRedirectSource, UrlRedirectStatusCode } from "@store4riders/shared-types";
import { DEFAULT_NAV_ITEMS } from "@/modules/homepage/components/navbar/nav.constants";
import { OFFICIAL_PAGE_DEFINITIONS } from "./AdminPolicyPagesSettings.defaults";
import { areCategorySlugsEquivalent, isLegacyNonMenuCategory } from "@/core/utils/navCategories";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerUpRight,
  Edit2,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

const SOURCE_LABELS: Record<UrlRedirectSource, { label: string; className: string }> = {
  manual: { label: "Manual", className: "bg-slate-100 text-slate-700" },
  auto_product: { label: "Auto: Product", className: "bg-blue-100 text-blue-800" },
  auto_category: { label: "Auto: Category", className: "bg-indigo-100 text-indigo-800" },
  auto_brand: { label: "Auto: Brand", className: "bg-purple-100 text-purple-800" },
  auto_blog: { label: "Auto: Guide", className: "bg-amber-100 text-amber-800" },
};

const STORE_CORE_PAGES = [
  { label: "Homepage", url: "/" },
  { label: "All Products", url: "/products" },
  { label: "Shop by Brand", url: "/brands" },
  { label: "Rider Guides", url: "/guides" },
  { label: "Sale & Deals", url: "/sale" },
];

export function AdminUrlRedirectsManager() {
  const [page, setPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const limit = 20;

  const { data, isLoading, refetch } = useUrlRedirects(page, limit, searchFilter, sourceFilter);
  const createMutation = useCreateUrlRedirect();
  const updateMutation = useUpdateUrlRedirect();
  const deleteMutation = useDeleteUrlRedirect();
  const { data: categoryTree } = useCategoryTree();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IUrlRedirect | null>(null);

  const [formFromPath, setFormFromPath] = useState("");
  const [formToPath, setFormToPath] = useState("");
  const [formStatusCode, setFormStatusCode] = useState<UrlRedirectStatusCode>(301);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNote, setFormNote] = useState("");

  const menuDestinations = useMemo(() => {
    const list: { label: string; url: string }[] = [];
    const seenUrls = new Set<string>();

    for (const item of DEFAULT_NAV_ITEMS) {
      if (item.href && item.href !== "#" && !item.href.startsWith("http") && !seenUrls.has(item.href)) {
        seenUrls.add(item.href);
        list.push({ label: item.label, url: item.href });
      }
      if (item.megaMenuItems) {
        for (const mega of item.megaMenuItems) {
          const prefix = mega.group ? `${item.label} → ${mega.group}` : item.label;
          if (mega.groupHref && !mega.groupHref.startsWith("http") && !seenUrls.has(mega.groupHref)) {
            seenUrls.add(mega.groupHref);
            list.push({ label: prefix, url: mega.groupHref });
          }
          if (mega.items) {
            for (const sub of mega.items) {
              if (sub.href && !sub.href.startsWith("http") && !seenUrls.has(sub.href)) {
                seenUrls.add(sub.href);
                list.push({ label: `${prefix} → ${sub.label}`, url: sub.href });
              }
            }
          }
        }
      }
    }
    return list;
  }, []);

  const customCategoryDestinations = useMemo(() => {
    const seenSlugs: string[] = menuDestinations
      .map((m) => m.url.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() || "")
      .filter(Boolean);
    const list: { label: string; url: string }[] = [];

    const traverse = (nodes: ICategoryTree[], parentPath = "") => {
      for (const node of nodes) {
        const slug = String(node.slug || "").toLowerCase().trim();
        const name = String(node.name || "").trim();
        if (!slug || !name || isLegacyNonMenuCategory(slug) || node.includeInMenu === false) {
          continue;
        }
        const currentPath = parentPath ? `${parentPath} → ${name}` : name;
        const cleanUrl = `/${slug.replace(/^\/+/, "")}`;
        const dup = seenSlugs.some((s) => s === slug || areCategorySlugsEquivalent(s, slug));
        if (!dup) {
          seenSlugs.push(slug);
          list.push({ label: currentPath, url: cleanUrl });
        }
        if (node.children?.length) {
          traverse(node.children, currentPath);
        }
      }
    };

    if (Array.isArray(categoryTree)) {
      traverse(categoryTree);
    }
    return list;
  }, [categoryTree, menuDestinations]);

  const policyDestinations = useMemo(
    () =>
      OFFICIAL_PAGE_DEFINITIONS.map((def) => ({
        label: `${def.name} (/${def.slug})`,
        url: `/${def.slug}`,
      })),
    []
  );

  const openCreateModal = () => {
    setEditingItem(null);
    setFormFromPath("");
    setFormToPath("");
    setFormStatusCode(301);
    setFormIsActive(true);
    setFormNote("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: IUrlRedirect) => {
    setEditingItem(item);
    setFormFromPath(item.fromPath);
    setFormToPath(item.toPath);
    setFormStatusCode(item.statusCode === 302 ? 302 : 301);
    setFormIsActive(item.isActive);
    setFormNote(item.note || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFromPath.trim()) {
      toast.error("Please enter the source (old) URL path, e.g. /old-page");
      return;
    }
    if (!formToPath.trim()) {
      toast.error("Please select or enter a destination URL");
      return;
    }

    try {
      const payload: Partial<IUrlRedirect> = {
        fromPath: formFromPath.trim(),
        toPath: formToPath.trim(),
        statusCode: formStatusCode,
        isActive: formIsActive,
        note: formNote.trim(),
      };

      if (editingItem?._id) {
        await updateMutation.mutateAsync({ id: editingItem._id, data: payload });
        toast.success("Page redirect updated successfully");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Page redirect created successfully");
      }

      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to save redirect rule");
    }
  };

  const handleToggleStatus = async (item: IUrlRedirect) => {
    if (!item._id) return;
    try {
      await updateMutation.mutateAsync({
        id: item._id,
        data: { isActive: !item.isActive },
      });
      toast.success(`Redirect "${item.fromPath}" ${!item.isActive ? "enabled" : "paused"}`);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to toggle redirect");
    }
  };

  const handleDelete = async (item: IUrlRedirect) => {
    if (!item._id) return;
    if (!window.confirm(`Delete redirect rule "${item.fromPath} → ${item.toPath}"?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item._id);
      toast.success(`Redirect for "${item.fromPath}" deleted`);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete redirect");
    }
  };

  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;
  const totalHits = useMemo(
    () => items.reduce((sum, item) => sum + (item.hitCount || 0), 0),
    [items]
  );

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-900">
        <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Automatic SEO 301 Protection Active:</span> Whenever you change the slug of a Product, Category, Brand, or Guide Article, an automatic{" "}
          <span className="font-mono font-bold">301 Permanent Redirect</span> is created from the old URL to the new URL so you never get 404 errors. You can also add custom manual page redirects below.
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 flex items-center gap-4">
          <div className="p-3 bg-brand/10 text-brand rounded-xl">
            <CornerUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total URL Redirects</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active On Page</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {items.filter((i) => i.isActive).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ExternalLink className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Hits (Current Page)</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalHits}</p>
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search old path, destination URL, or note..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand focus:bg-white font-medium"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by redirect origin"
            className="px-3 py-2 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual Rules</option>
            <option value="auto_product">Auto: Product Slug</option>
            <option value="auto_category">Auto: Category Slug</option>
            <option value="auto_brand">Auto: Brand Slug</option>
            <option value="auto_blog">Auto: Guide Slug</option>
          </select>
        </div>

        <Button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase px-5 py-2.5 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Page Redirect</span>
        </Button>
      </div>

      {/* Redirects Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Loading page redirects...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400">
              <CornerUpRight className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h4 className="text-sm font-bold text-neutral-800">No Page Redirects Found</h4>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Redirect any old page URL (e.g. <code className="font-mono">/old-helmet-slug</code>) to a new page with HTTP 301 or 302.
            </p>
            <Button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Page Redirect</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/80 text-neutral-600 border-b border-neutral-200 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Old / Source Path</th>
                  <th className="py-3 px-4">Destination URL</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Origin</th>
                  <th className="py-3 px-4 text-center">Hits</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((item) => {
                  const sourceBadge = SOURCE_LABELS[item.source] || SOURCE_LABELS.manual;
                  return (
                    <tr key={item._id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{item.fromPath}</div>
                        {item.note && (
                          <div className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-xs">
                            {item.note}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-brand font-semibold">
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{item.toPath}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.statusCode === 302
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.statusCode === 302 ? "302 Temp" : "301 Permanent"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${sourceBadge.className}`}
                        >
                          {sourceBadge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {item.hitCount || 0}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                            item.isActive
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                          }`}
                        >
                          {item.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-neutral-400" />
                              <span>Paused</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit Redirect"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Delete Redirect"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingItem ? "Edit Page Redirect" : "New Page Redirect (301/302)"}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Automatically send visitors and search engines from an old page URL to a new page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Old / Source Page Path <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. /old-helmet-page"
                  value={formFromPath}
                  onChange={(e) => setFormFromPath(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand focus:bg-white"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Enter the old path without domain (e.g. <code className="font-mono">/axor-old-helmet</code>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Quick Destination Picker <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={
                    [
                      ...STORE_CORE_PAGES,
                      ...policyDestinations,
                      ...menuDestinations,
                      ...customCategoryDestinations,
                    ].some((opt) => opt.url === formToPath)
                      ? formToPath
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) setFormToPath(e.target.value);
                  }}
                  aria-label="Select destination page"
                  className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand focus:bg-white font-medium"
                >
                  <option value="">-- Pick a Store Page, Category, or Policy Page --</option>
                  <optgroup label="Storefront Core Pages">
                    {STORE_CORE_PAGES.map((p) => (
                      <option key={p.url} value={p.url}>
                        {p.label} ({p.url})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Policy & CMS Pages">
                    {policyDestinations.map((p) => (
                      <option key={p.url} value={p.url}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Store Menu Categories">
                    {menuDestinations.map((c) => (
                      <option key={c.url} value={c.url}>
                        {c.label} ({c.url})
                      </option>
                    ))}
                  </optgroup>
                  {customCategoryDestinations.length > 0 && (
                    <optgroup label="Custom Categories">
                      {customCategoryDestinations.map((c) => (
                        <option key={c.url} value={c.url}>
                          {c.label} ({c.url})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Destination URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. /motorcycle-helmets or /new-product-slug"
                  value={formToPath}
                  onChange={(e) => setFormToPath(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  HTTP Redirect Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatusCode(301)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      formStatusCode === 301
                        ? "border-brand bg-brand/5 text-brand font-bold"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    }`}
                  >
                    <div className="text-xs font-bold">301 Permanent (SEO)</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">Transfers search ranking</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatusCode(302)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      formStatusCode === 302
                        ? "border-brand bg-brand/5 text-brand font-bold"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    }`}
                  >
                    <div className="text-xs font-bold">302 Temporary</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">Short-term promo redirect</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Note <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Old campaign link redirected to new helmet page"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-neutral-700">Enable redirect immediately</span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-brand focus:ring-brand cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase px-5 py-2 rounded-lg shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Redirect"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUrlRedirectsManager;
