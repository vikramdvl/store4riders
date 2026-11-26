"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Plus, Edit2, Trash2, Upload, X, Check, Image as ImageIcon, ExternalLink, Globe, Download, HelpCircle, Search, EyeOff, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { usePaginatedBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/core/hooks/useBrands";
import { Pagination } from "@/components/ui/Pagination";
import { IBrand } from "@store4riders/shared-types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrandSchema } from "@store4riders/shared-validation";
import { compressImageToWebP, uploadImageToS3 } from "@/core/utils/imageCompressor";
import { downloadBrandProductCsv } from "@/core/utils/exportCsv";
import { revalidateStorefrontPaths } from "@/core/utils/revalidateStorefront";
import { apiClient } from "@/core/api/client";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { DEFAULT_NAV_ITEMS } from "@/modules/homepage/components/navbar/nav.constants";
import { resolveBrandLogo } from "@/modules/brands/constants/brandLogos";

const PRESET_MENU_GROUPS = [
  "Helmet Brands",
  "Riding Gear",
  "Boots & Protection",
  "Luggage & Accessories",
  "Parts & Performance",
  "Care & Maintenance",
  "Popular Brands"
];

const detectBrandGroup = (brandName: string, brandSlug: string): string[] => {
  const brandNav = DEFAULT_NAV_ITEMS.find((n) => n.id === "shop-by-brand");
  if (brandNav?.megaMenuItems) {
    for (const grp of brandNav.megaMenuItems) {
      const match = grp.items.some((item) => {
        const leaf = item.href.replace(/^\/brands\/?/, "").split("?")[0].toLowerCase().trim();
        const label = item.label.toLowerCase().trim();
        const bSlug = (brandSlug || "").toLowerCase().trim();
        const bName = (brandName || "").toLowerCase().trim();
        return (
          (leaf && bSlug && (leaf === bSlug || leaf.includes(bSlug) || bSlug.includes(leaf))) ||
          (label && bName && (label === bName || label.includes(bName) || bName.includes(label)))
        );
      });
      if (match && grp.group) return [grp.group];
    }
  }

  const lower = `${brandName} ${brandSlug}`.toLowerCase();
  if (lower.includes("helmet")) return ["Helmet Brands"];
  if (lower.includes("boot") || lower.includes("protect")) return ["Boots & Protection"];
  if (lower.includes("exhaust") || lower.includes("filter") || lower.includes("spark") || lower.includes("chain") || lower.includes("oil") || lower.includes("part")) return ["Parts & Performance"];
  if (lower.includes("luggage") || lower.includes("bag") || lower.includes("phone") || lower.includes("mount")) return ["Luggage & Accessories"];
  return ["Riding Gear"];
};

export const isBrandInSubmenu = (brand: Partial<IBrand> | null | undefined): boolean => {
  if (!brand) return false;
  const val = brand.showInMenu;
  if (val === false || (val as any) === "false" || (val as any) === 0 || (val as any) === "0") {
    return false;
  }
  if (val === true || (val as any) === "true" || (val as any) === 1 || (val as any) === "1") {
    return true;
  }
  return false;
};

type BrandFormValues = {
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  isActive: boolean;
  showInMenu?: boolean;
  menuGroup?: string;
  menuGroups?: string[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
};

function BrandLogoCell({ logo, name, slug }: { logo?: string; name: string; slug?: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || "BR").substring(0, 2).toUpperCase();
  const effectiveLogo = resolveBrandLogo({ logo, name, slug });

  if (!effectiveLogo || imgError) {
    return (
      <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
        {initials}
      </div>
    );
  }

  return (
    <div className="relative w-10 h-10 bg-white border border-slate-200 rounded p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
      <Image 
        src={effectiveLogo} 
        alt={name} 
        fill 
        sizes="40px" 
        unoptimized
        className="object-contain p-1"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

export function AdminBrands() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [brandSearch, setBrandSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [submenuFilter, setSubmenuFilter] = useState<"all" | "in_submenu" | "hidden">("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(brandSearch);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [brandSearch]);

  const {
    data: paginatedData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePaginatedBrands(
    {
      page,
      limit,
      search: debouncedSearch,
      status: statusFilter,
      submenu: submenuFilter,
      section: sectionFilter,
      includeInactive: true,
    },
    {
      staleTime: 10 * 1000,
      refetchOnMount: "always",
    }
  );

  const brands = paginatedData?.items || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 1;

  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<IBrand | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);

  // Parent /brands directory page SEO and header content state
  const [isPageSeoModalOpen, setIsPageSeoModalOpen] = useState(false);
  const [isSavingPageSeo, setIsSavingPageSeo] = useState(false);
  const [pageSeo, setPageSeo] = useState({
    heroTitle: "Shop By Brand",
    heroDescription:
      "Store4Riders is an online multi-brand riding gear store launched in 2016 for fellow riders looking out for quality motorcycle riding gear. We house brands ranging from premium brands to more affordable riding gear brands like etc. Other than riding gear, we offer a host of accessories, luggage and performance parts for bike riders. We deliver all products across India. Check out the brands we have on offer.",
    metaTitle: "",
    metaDescription: "",
    metaKeywords: "",
  });

  useEffect(() => {
    apiClient
      .get("/brands/page-seo")
      .then((res) => {
        if (res.data?.data) {
          setPageSeo({
            heroTitle: res.data.data.heroTitle || "Shop By Brand",
            heroDescription:
              res.data.data.heroDescription ||
              "Store4Riders is an online multi-brand riding gear store launched in 2016 for fellow riders looking out for quality motorcycle riding gear. We house brands ranging from premium brands to more affordable riding gear brands like etc. Other than riding gear, we offer a host of accessories, luggage and performance parts for bike riders. We deliver all products across India. Check out the brands we have on offer.",
            metaTitle: res.data.data.metaTitle || "",
            metaDescription: res.data.data.metaDescription || "",
            metaKeywords: res.data.data.metaKeywords || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSavePageSeo = async () => {
    try {
      setIsSavingPageSeo(true);
      await apiClient.put("/brands/page-seo", pageSeo);
      revalidateStorefrontPaths(["/brands"]);
      toast.success("Shop by Brand directory (/brands) content and SEO updated successfully!");
      setIsPageSeoModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update page settings");
    } finally {
      setIsSavingPageSeo(false);
    }
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<BrandFormValues>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: { 
      isActive: true, 
      showInMenu: false, 
      menuGroup: "",
      menuGroups: [],
      metaTitle: "",
      metaDescription: "",
      metaKeywords: "",
    }
  });

  useEffect(() => {
    register("description");
    register("menuGroups");
  }, [register]);

  const logoValue = watch("logo");
  const showInMenuValue = watch("showInMenu");
  const menuGroupValue = watch("menuGroup");
  const menuGroupsValue = watch("menuGroups") ?? (menuGroupValue ? [menuGroupValue] : []);

  const toggleMenuGroup = (group: string) => {
    const current = watch("menuGroups") || (menuGroupValue ? [menuGroupValue] : []);
    const updated = current.includes(group)
      ? current.filter((g) => g !== group)
      : [...current, group];
    setValue("menuGroups", updated, { shouldDirty: true, shouldValidate: true });
    setValue("menuGroup", updated[0] || "", { shouldDirty: true });
  };

  const openCreateModal = () => {
    setEditingBrand(null);
    setFaqs([]);
    reset({ 
      name: "", 
      slug: "", 
      logo: "", 
      description: "", 
      isActive: true, 
      showInMenu: false, 
      menuGroup: "",
      menuGroups: [],
      metaTitle: "",
      metaDescription: "",
      metaKeywords: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (brand: IBrand) => {
    setEditingBrand(brand);
    setFaqs(
      brand.faqs && Array.isArray(brand.faqs)
        ? brand.faqs.map((f) => ({ question: f.question, answer: f.answer }))
        : []
    );
    const inSubmenu = isBrandInSubmenu(brand);
    const rawGroups = brand.menuGroups && brand.menuGroups.length > 0
      ? brand.menuGroups
      : brand.menuGroup
      ? [brand.menuGroup]
      : [];

    const initialGroups = rawGroups.length > 0
      ? rawGroups
      : inSubmenu
      ? detectBrandGroup(brand.name, brand.slug)
      : [];

    const effectiveLogo = brand.logo || resolveBrandLogo(brand) || "";

    reset({
      name: brand.name,
      slug: brand.slug,
      logo: effectiveLogo,
      description: brand.description || "",
      isActive: brand.isActive !== false,
      showInMenu: inSubmenu,
      menuGroup: initialGroups[0] || brand.menuGroup || "",
      menuGroups: initialGroups,
      metaTitle: brand.metaTitle || "",
      metaDescription: brand.metaDescription || "",
      metaKeywords: brand.metaKeywords || "",
    });
    setIsModalOpen(true);
  };

  const handleToggleShowInMenu = (brand: IBrand) => {
    const isCurrentlyIn = isBrandInSubmenu(brand);
    const nextShowInMenu = !isCurrentlyIn;
    const existingGroups = (brand.menuGroups && brand.menuGroups.length > 0)
      ? brand.menuGroups
      : brand.menuGroup
      ? [brand.menuGroup]
      : detectBrandGroup(brand.name, brand.slug);

    updateBrand.mutate({
      id: brand._id,
      data: {
        showInMenu: nextShowInMenu,
        menuGroups: nextShowInMenu ? existingGroups : [],
        menuGroup: nextShowInMenu ? (existingGroups[0] || "") : "",
      },
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      toast.info("Compressing brand logo to WebP...");
      const compressed = await compressImageToWebP(file, 800, 0.9);
      const s3Url = await uploadImageToS3(compressed.file);
      setValue("logo", s3Url);
      toast.success("Logo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = (data: BrandFormValues) => {
    const isShowInMenu = Boolean(data.showInMenu);
    const watchedGroups = watch("menuGroups");
    const watchedSingle = watch("menuGroup");
    const selectedGroups: string[] = isShowInMenu
      ? (
          Array.isArray(watchedGroups) && watchedGroups.length > 0
            ? watchedGroups
            : Array.isArray(data.menuGroups) && data.menuGroups.length > 0
            ? data.menuGroups
            : watchedSingle
            ? [watchedSingle]
            : []
        ).filter((g): g is string => typeof g === "string")
      : [];

    const currentDesc = watch("description") ?? data.description ?? "";
    const cleanFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    const payload = {
      ...data,
      showInMenu: isShowInMenu,
      description: currentDesc,
      menuGroup: selectedGroups[0] || "",
      menuGroups: selectedGroups,
      faqs: cleanFaqs,
    };
    if (editingBrand) {
      updateBrand.mutate(
        { id: editingBrand._id, data: payload },
        { onSuccess: () => setIsModalOpen(false) }
      );
    } else {
      createBrand.mutate(payload, { onSuccess: () => setIsModalOpen(false) });
    }
  };

  const onInvalid = (fieldErrors: any) => {
    const errorMsgs = Object.values(fieldErrors)
      .map((e: any) => e?.message)
      .filter(Boolean);
    if (errorMsgs.length > 0) {
      toast.error(errorMsgs[0] as string);
    } else {
      toast.error("Please verify brand form fields");
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this brand?")) {
      deleteBrand.mutate(id);
    }
  };

  const filteredBrands = brands;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Brands</h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage product brands, storefront navigation submenu placement, and logos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsPageSeoModalOpen(true)}
            className="flex items-center space-x-2 text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
            title="Configure SEO for main /brands page"
          >
            <Globe size={16} className="text-brand" />
            <span>/brands Page SEO</span>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await refetch();
              toast.success("Brand catalog refreshed");
            }}
            disabled={isFetching}
            className="flex items-center space-x-2 text-slate-700 bg-white hover:bg-slate-50 border-slate-200 cursor-pointer"
            title="Refetch latest brand catalog from server"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin text-brand" : "text-slate-600"} />
            <span>{isFetching ? "Refreshing..." : "Refresh"}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadBrandProductCsv()}
            className="flex items-center space-x-2 text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
            title="Download full product catalog CSV"
          >
            <Download size={16} />
            <span>Export Catalog CSV</span>
          </Button>
          <Button onClick={openCreateModal} className="flex items-center space-x-2">
            <Plus size={18} />
            <span>Add Brand</span>
          </Button>
        </div>
      </div>

      {/* Brands Directory Page Content & SEO Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
            <Globe size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Shop by Brand Directory Content & SEO (<span className="text-slate-900 font-mono font-bold">/brands</span>)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl truncate">
              {pageSeo.heroTitle}: {pageSeo.heroDescription ? pageSeo.heroDescription : "Store4Riders is an online multi-brand riding gear store..."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPageSeoModalOpen(true)}
          className="text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          <Edit2 size={13} />
          <span>Edit /brands Page & SEO</span>
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Search & Status Filter Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Search brand by name or slug (e.g. 'MT', 'LS2', 'Axor', 'Rynox')..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand shadow-2xs font-medium"
            />
            {brandSearch && (
              <button
                type="button"
                onClick={() => setBrandSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setStatusFilter("all"); setPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${statusFilter === "all" ? "bg-slate-800 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter("active"); setPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${statusFilter === "active" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter("inactive"); setPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${statusFilter === "inactive" ? "bg-amber-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                Inactive
              </button>
            </div>

            {/* Submenu Filter */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setSubmenuFilter("all"); setPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${submenuFilter === "all" ? "bg-slate-700 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
              >
                Menu: All
              </button>
              <button
                type="button"
                onClick={() => { setSubmenuFilter("in_submenu"); setPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${submenuFilter === "in_submenu" ? "bg-emerald-700 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                title="Brands shown in storefront top dropdown"
              >
                In Menu
              </button>
              <button
                type="button"
                onClick={() => { setSubmenuFilter("hidden"); setPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${submenuFilter === "hidden" ? "bg-slate-500 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                title="Brands hidden from storefront top dropdown"
              >
                Hidden
              </button>
            </div>

            {/* Section Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={sectionFilter}
                onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
                className="text-xs py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-brand focus:outline-none shadow-2xs"
              >
                <option value="all">All Sections</option>
                {PRESET_MENU_GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium ml-1">
              Total <span className="font-bold text-slate-800">{totalCount}</span> brands
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4"></div>
            Loading brands...
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-medium">Brand</th>
                <th className="px-6 py-4 font-medium">Slug</th>
                <th className="px-6 py-4 font-medium">Submenu Display</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    No brands match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                <tr key={brand._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <BrandLogoCell logo={brand.logo} name={brand.name} slug={brand.slug} />
                      <div>
                        <span className="font-semibold text-slate-800 block">{brand.name}</span>
                        {brand.description && (
                          <span
                            className="text-xs text-slate-400 truncate max-w-xs block"
                            title={brand.description.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()}
                          >
                            {brand.description.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()}
                          </span>
                        )}
                        {brand.faqs && brand.faqs.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 mt-1">
                            <HelpCircle size={10} />
                            {brand.faqs.length} FAQs
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{brand.slug}</td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleToggleShowInMenu(brand)}
                      className="group flex flex-wrap items-center gap-1.5 text-left cursor-pointer focus:outline-none"
                      title={`Click to ${isBrandInSubmenu(brand) ? "hide from" : "show in"} storefront menu`}
                    >
                      {isBrandInSubmenu(brand) ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 group-hover:bg-emerald-100 transition-colors">
                            <Globe size={11} />
                            In Submenu
                          </span>
                          {(brand.menuGroups && brand.menuGroups.length > 0
                            ? brand.menuGroups
                            : (brand.menuGroup ? [brand.menuGroup] : [])
                          ).map((g) => (
                            <span key={g} className="text-[11px] text-slate-700 bg-slate-100 font-medium px-2 py-0.5 rounded border border-slate-200">
                              {g}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-slate-200 transition-colors">
                          <EyeOff size={11} />
                          Hidden from Submenu
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      brand.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {brand.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => downloadBrandProductCsv(brand.name)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50"
                        title={`Download ${brand.name} Products CSV`}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(brand)}
                        className="p-2 text-slate-400 hover:text-brand transition-colors rounded-lg hover:bg-slate-100"
                        title="Edit Brand"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(brand._id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                        title="Delete Brand"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        )}

        {/* Error Banner */}
        {isError && (
          <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm font-semibold text-red-700">Failed to load brand catalog</p>
            <p className="text-xs text-red-500 mt-1">{(error as any)?.message || "Please check backend connection"}</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-3 text-xs">
              Retry
            </Button>
          </div>
        )}

        {/* Pagination & Count Bar */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-white text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <span className="font-bold text-slate-800">
                {totalCount === 0 ? 0 : (page - 1) * limit + 1}
              </span>
              {" – "}
              <span className="font-bold text-slate-800">
                {Math.min(page * limit, totalCount)}
              </span>{" "}
              of <span className="font-bold text-slate-800">{totalCount}</span> brands
            </span>

            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
              <span className="text-slate-400">Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="py-1 px-2 border border-slate-200 rounded text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={limit}
              itemLabel="brands"
              onPageChange={(newPage) => setPage(newPage)}
            />
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBrand ? "Edit Brand" : "Add New Brand"}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Brand Name *"
              placeholder="e.g. AGV, Alpinestars, Rynox, Motul"
              {...register("name")}
              error={errors.name?.message}
              onChange={(e) => {
                register("name").onChange(e);
                if (!editingBrand) {
                  setValue(
                    "slug", 
                    e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
                  );
                }
              }}
            />

            <Input
              label="URL Key / Slug *"
              placeholder="e.g. agv, alpinestars, rynox"
              {...register("slug")}
              error={errors.slug?.message}
            />
          </div>

          {/* Logo Upload + Preview */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Brand Logo (WebP Compressed)
            </label>
            <div className="flex items-center gap-3 mb-2">
              {logoValue ? (
                <div className="relative w-14 h-14 bg-slate-50 border border-slate-200 rounded-lg p-1 flex items-center justify-center overflow-hidden">
                  <Image 
                    src={logoValue} 
                    alt="Brand Logo Preview" 
                    fill 
                    sizes="56px" 
                    unoptimized
                    className="object-contain p-1" 
                  />
                  <button
                    type="button"
                    onClick={() => setValue("logo", "")}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600"
                    title="Remove Logo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-14 h-14 bg-slate-100 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
                  <ImageIcon size={20} />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Upload size={14} />
                  <span>{isUploadingLogo ? "Compressing & Uploading..." : "Upload Logo (Auto-WebP)"}</span>
                </Button>
                <p className="text-[11px] text-slate-400">
                  Direct upload automatically converts to optimized WebP.
                </p>
              </div>
            </div>
            <Input
              placeholder="Or paste image URL (https://...)"
              {...register("logo")}
              error={errors.logo?.message}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <span className="text-[11px] text-slate-400">Visual Rich Text (HTML)</span>
            </div>
            <RichTextEditor
              value={watch("description") || ""}
              onChange={(val) => setValue("description", val, { shouldDirty: true })}
              placeholder="Brief description about the brand, heritage, or product specialties..."
              minHeight="140px"
            />
            {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>}
          </div>

          {/* Submenu Display Controls */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="showInMenu"
                {...register("showInMenu")}
                className="w-4 h-4 mt-0.5 text-brand rounded border-slate-300 focus:ring-brand cursor-pointer"
              />
              <div>
                <label htmlFor="showInMenu" className="text-sm font-semibold text-slate-800 cursor-pointer block">
                  Show in Top Menu (&apos;Shop By Brand&apos;)
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  When enabled, this brand will be shown in the storefront dropdown under &quot;Shop By Brand&quot;.
                </p>
              </div>
            </div>

            {showInMenuValue && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Brand Section in Menu (Select All That Apply)
                  </label>
                  <span className="text-[11px] font-medium text-brand">Multi-Select Enabled</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Click to select multiple categories (e.g. choose both Helmet Brands &amp; Riding Gear if the brand makes both):
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {PRESET_MENU_GROUPS.map((group) => {
                    const isSelected = menuGroupsValue.includes(group);
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => toggleMenuGroup(group)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-brand text-white border-brand shadow-xs font-semibold"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {isSelected && <span className="font-bold text-xs">✓</span>}
                        <span>{group}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2.5 bg-slate-100/70 border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 font-medium">Selected Sections:</span>
                    {menuGroupsValue.length > 0 ? (
                      menuGroupsValue.map((grp) => (
                        <span key={grp} className="bg-white text-brand border border-brand/30 px-2 py-0.5 rounded font-semibold text-[11px]">
                          {grp}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">None (No section assigned)</span>
                    )}
                  </div>
                  {menuGroupsValue.length > 1 && (
                    <span className="text-emerald-700 font-bold text-[10px] uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 self-start sm:self-auto">
                      Multi-Section ({menuGroupsValue.length})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SEO & Search Engine Optimization */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-brand" />
              <h3 className="text-sm font-semibold text-slate-800">SEO & Search Engine Metadata</h3>
            </div>
            <p className="text-xs text-slate-500">
              Configure custom search engine metadata for this brand page. If left blank, default store formatting will be used.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Meta Title"
                  placeholder="e.g. AGV Helmets India | Buy AGV Motorcycle Helmets Online"
                  {...register("metaTitle")}
                  error={errors.metaTitle?.message}
                />
              </div>

              <div>
                <Input
                  label="Meta Keywords"
                  placeholder="e.g. agv, helmets, agv pista gp rr, agv k6 s, motorcycle helmet india"
                  {...register("metaKeywords")}
                  error={errors.metaKeywords?.message}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
              <textarea
                {...register("metaDescription")}
                placeholder="e.g. Explore certified AGV motorcycle helmets with official warranty, express shipping across India, and best prices at Store4Riders."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all resize-y min-h-[70px] text-sm"
              />
              {errors.metaDescription && <p className="mt-1 text-sm text-red-500">{errors.metaDescription.message}</p>}
            </div>
          </div>

          {/* BRAND FAQS SECTION (Google SEO & Rider Guidance) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <HelpCircle size={16} className="text-brand" />
                  <span>Brand FAQs &amp; Buyer Guidance ({faqs.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rendered on the brand catalog page (/brands/{watch("slug") || "brand-slug"}) with Google FAQ rich snippet schema.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
                className="text-xs py-1 px-3 flex items-center gap-1 cursor-pointer bg-white border-slate-300 hover:bg-slate-100"
              >
                <Plus size={13} />
                <span>Add FAQ</span>
              </Button>
            </div>

            {faqs.length === 0 ? (
              <div className="p-4 bg-white border border-dashed border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-400 italic">No FAQs added for this brand yet.</p>
                <button
                  type="button"
                  onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
                  className="mt-1.5 text-xs text-brand font-semibold hover:underline cursor-pointer"
                >
                  + Click here to add the first FAQ
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2 relative shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 cursor-pointer transition-colors"
                      title="Delete FAQ"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="w-[92%]">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Question #{idx + 1} *
                      </label>
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFaqs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, question: val } : item))
                          );
                        }}
                        placeholder={`e.g. Are ${watch("name") || "this brand"} helmets ECE or DOT certified?`}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Answer *
                      </label>
                      <textarea
                        value={faq.answer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFaqs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, answer: val } : item))
                          );
                        }}
                        rows={2}
                        placeholder="Provide a clear, helpful answer for riders and Google search rich snippets..."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand resize-y"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              {...register("isActive")}
              className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand cursor-pointer"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700 font-medium cursor-pointer">
              Active Brand (Available in store catalog)
            </label>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBrand.isPending || updateBrand.isPending || isUploadingLogo}
            >
              {createBrand.isPending || updateBrand.isPending ? "Saving..." : "Save Brand"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Brand Directory (/brands) Page Header & SEO Modal */}
      <Modal
        isOpen={isPageSeoModalOpen}
        onClose={() => setIsPageSeoModalOpen(false)}
        title="Edit Brand Directory Page Content & SEO (/brands)"
      >
        <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-neutral-600">
            Customize the live hero title, store heritage description, and search engine SEO tags for the public{" "}
            <span className="font-semibold text-neutral-800">/brands</span> directory page.
          </div>

          <div className="space-y-3 pt-1">
            <h5 className="text-xs font-black uppercase tracking-wider text-neutral-900">1. Storefront Page Content</h5>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Directory Hero Title
              </label>
              <Input
                value={pageSeo.heroTitle}
                onChange={(e) => setPageSeo({ ...pageSeo, heroTitle: e.target.value })}
                placeholder="e.g. Shop By Brand"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Store Description / Riding Story
              </label>
              <textarea
                value={pageSeo.heroDescription}
                onChange={(e) => setPageSeo({ ...pageSeo, heroDescription: e.target.value })}
                rows={4}
                placeholder="Store4Riders is an online multi-brand riding gear store launched in 2016 for fellow riders looking out for quality motorcycle riding gear..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Displayed in the premium hero section on the /brands page. Highlights store heritage, multi-brand catalog, accessories, and all-India shipping.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h5 className="text-xs font-black uppercase tracking-wider text-neutral-900">2. Search Engine Optimization (SEO)</h5>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Meta Title
              </label>
              <Input
                value={pageSeo.metaTitle}
                onChange={(e) => setPageSeo({ ...pageSeo, metaTitle: e.target.value })}
                placeholder="e.g. Shop By Brand | All Motorcycle Brands A–Z | Store4Riders"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Meta Description
              </label>
              <textarea
                value={pageSeo.metaDescription}
                onChange={(e) => setPageSeo({ ...pageSeo, metaDescription: e.target.value })}
                rows={3}
                placeholder="e.g. Browse authentic motorcycle helmets, riding gear, accessories, and performance parts by brand. Explore our complete A-Z brand directory at Store4Riders."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Meta Keywords
              </label>
              <Input
                value={pageSeo.metaKeywords}
                onChange={(e) => setPageSeo({ ...pageSeo, metaKeywords: e.target.value })}
                placeholder="e.g. motorcycle brands, riding gear brands, helmet brands, store4riders"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsPageSeoModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isSavingPageSeo}
              onClick={handleSavePageSeo}
              className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold"
            >
              {isSavingPageSeo ? "Saving..." : "Save Page Settings"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
