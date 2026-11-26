import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Home,
  Users,
  Box,
  ShoppingCart,
  Settings,
  LogOut,
  Tags,
  FolderTree,
  Truck,
  Database,
  LayoutTemplate,
  Globe,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Instagram,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Search,
  Plus,
  BookOpen,
  FileText,
  CreditCard,
  Receipt,
  Star,
  Ticket,
  Info,
  Phone,
  Activity,
  CornerUpRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogout } from "@/core/hooks/useAuth";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface SubItem {
  name: string;
  href: string;
  icon: any;
}

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  subItems?: SubItem[];
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  // 1. Dashboard (Top-level overview)
  { 
    name: "Dashboard", 
    href: "/admin", 
    icon: Home, 
    allowedRoles: ["super_admin", "admin"] 
  },
  // 2. Orders & Fulfillment
  { 
    name: "Orders", 
    icon: ShoppingCart, 
    allowedRoles: ["super_admin", "admin", "logistic", "order_manager"],
    subItems: [
      { name: "All Placed Orders", href: "/admin/orders", icon: ShoppingCart },
      { name: "Failed Transactions", href: "/admin/orders/failed", icon: AlertTriangle },
      { name: "Exchange Requests", href: "/admin/orders/exchanges", icon: RefreshCw },
    ],
  },
  // 3. Shipping & Logistics
  { 
    name: "Logistics", 
    href: "/admin/shipping", 
    icon: Truck, 
    allowedRoles: ["super_admin", "admin", "logistic"] 
  },
  // 4. Products & Catalog
  { 
    name: "Products", 
    href: "/admin/products", 
    icon: Box, 
    allowedRoles: ["super_admin", "admin"] 
  },
  { 
    name: "Categories", 
    href: "/admin/categories", 
    icon: FolderTree, 
    allowedRoles: ["super_admin", "admin"] 
  },
  { 
    name: "Brands", 
    href: "/admin/brands", 
    icon: Tags, 
    allowedRoles: ["super_admin", "admin"] 
  },
  { 
    name: "Search Redirects", 
    href: "/admin/search-terms", 
    icon: Search, 
    allowedRoles: ["super_admin", "admin"] 
  },
  { 
    name: "Page Redirects", 
    href: "/admin/redirects", 
    icon: CornerUpRight, 
    allowedRoles: ["super_admin", "admin"] 
  },
  { 
    name: "Bulk Upload", 
    href: "/admin/products/migration", 
    icon: Database, 
    allowedRoles: ["super_admin", "admin"] 
  },
  // 5. Marketing & Promotions
  { 
    name: "Promo Coupons", 
    href: "/admin/coupons", 
    icon: Ticket, 
    allowedRoles: ["super_admin", "admin"] 
  },
  // 6. Homepage Experience
  {
    name: "Homepage",
    icon: LayoutTemplate,
    allowedRoles: ["super_admin", "admin"],
    subItems: [
      { name: "Hero & SEO", href: "/admin/homepage/hero-seo", icon: Globe },
      { name: "Section Edit", href: "/admin/homepage/sections", icon: Layers },
      { name: "Store4Riders on Insta", href: "/admin/homepage/reels", icon: Instagram },
    ],
  },
  // 7. Blog & Editorial
  { 
    name: "Blog", 
    icon: BookOpen, 
    allowedRoles: ["super_admin", "admin"],
    subItems: [
      { name: "All Articles", href: "/admin/blog", icon: FileText },
      { name: "New Article", href: "/admin/blog/new", icon: Plus },
      { name: "Categories", href: "/admin/blog/categories", icon: FolderTree },
    ],
  },
  // 8. Users & Access Control
  { 
    name: "Users", 
    icon: Users, 
    allowedRoles: ["super_admin", "admin"],
    subItems: [
      { name: "Staff & Team", href: "/admin/users?tab=staff", icon: ShieldCheck },
      { name: "Customers", href: "/admin/users?tab=customers", icon: UserCheck },
    ],
  },
  // 8.1 Security & Audit Trail
  {
    name: "Logs & Health",
    href: "/admin/audit-logs",
    icon: Activity,
    allowedRoles: ["super_admin", "admin"],
  },
  // 9. Customer Care & Support
  { 
    name: "Contact Inquiries", 
    href: "/admin?tab=inquiries", 
    icon: MessageSquare, 
    allowedRoles: ["customer_care", "customer_support", "super_admin", "admin"] 
  },
  { 
    name: "Order Search", 
    href: "/admin?tab=orders", 
    icon: Search, 
    allowedRoles: ["customer_care", "customer_support"] 
  },
  { 
    name: "Failed Transactions", 
    href: "/admin/orders/failed", 
    icon: AlertTriangle, 
    allowedRoles: ["customer_care", "customer_support"] 
  },
  // 10. Store Settings
  { 
    name: "Settings", 
    icon: Settings, 
    allowedRoles: ["super_admin", "admin"],
    subItems: [
      { name: "Store Contact & SEO", href: "/admin/settings?tab=contact", icon: Globe },
      { name: "About Us Content", href: "/admin/settings?tab=policies&page=about-us", icon: Info },
      { name: "Contact Us Content", href: "/admin/settings?tab=policies&page=contact-us", icon: Phone },
      { name: "Policy & Page Content", href: "/admin/settings?tab=policies", icon: FileText },
      { name: "Footer Navigation", href: "/admin/settings?tab=footer", icon: Layers },
      { name: "Shipping & Delivery", href: "/admin/settings?tab=shipping", icon: Truck },
      { name: "Payment & COD", href: "/admin/settings?tab=payments", icon: CreditCard },
      { name: "Tax & GST", href: "/admin/settings?tab=gst", icon: Receipt },
      { name: "Search & Discovery", href: "/admin/settings?tab=search", icon: Search },
      { name: "Google Reviews", href: "/admin/settings?tab=google-reviews", icon: Star },
    ]
  },
];

const getRoleBadge = (role?: string) => {
  switch (role) {
    case "super_admin":
      return { label: "Super Admin", className: "bg-red-500/20 text-red-400 border border-red-500/30" };
    case "admin":
      return { label: "Admin", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" };
    case "logistic":
      return { label: "Logistics", className: "bg-amber-500/20 text-amber-400 border border-amber-500/30" };
    case "customer_care":
    case "customer_support":
      return { label: "Customer Care", className: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" };
    default:
      return { label: role?.replace("_", " ") || "Staff", className: "bg-slate-800 text-slate-300 border border-slate-700" };
  }
};

const PAGE_PARAM_ALIASES: Record<string, string> = {
  "about-us": "about-us-store4riders",
  "about-us-store4riders": "about-us",
  "contact-us": "contact-store4riders",
  "contact-store4riders": "contact-us",
};

function matchesQueryParam(key: string, expected: string, actual: string | null): boolean {
  if (actual === expected) return true;
  if (key === "page" && actual) {
    return PAGE_PARAM_ALIASES[expected] === actual;
  }
  return false;
}

export function isSidebarLinkActive(
  href: string,
  pathname: string,
  searchParams: { get: (key: string) => string | null },
  userRole?: string,
  allVisibleHrefs: string[] = []
): boolean {
  const currentTab = searchParams.get("tab");

  if (href === "/admin") {
    return pathname === "/admin" && !currentTab;
  }
  if (href === "/admin?tab=inquiries") {
    return (
      pathname === "/admin" &&
      (currentTab === "inquiries" ||
        (!currentTab && (userRole === "customer_care" || userRole === "customer_support")))
    );
  }
  if (href === "/admin?tab=orders") {
    return pathname === "/admin" && currentTab === "orders";
  }
  if (href === "/admin/orders") {
    return pathname === "/admin/orders" || /^\/admin\/orders\/[0-9a-fA-F-]+$/.test(pathname);
  }

  const [baseHref, queryString] = href.split("?");

  if (queryString) {
    if (pathname !== baseHref) return false;
    const targetParams = Array.from(new URLSearchParams(queryString).entries());
    const allMatch = targetParams.every(([key, val]) =>
      matchesQueryParam(key, val, searchParams.get(key))
    );
    if (!allMatch) return false;

    // Yield to any visible sibling link on the same path that matches more query params (e.g. ?tab=policies&page=about-us over ?tab=policies)
    const hasMoreSpecificSibling = allVisibleHrefs.some((otherHref) => {
      if (otherHref === href || !otherHref.includes("?")) return false;
      const [otherBase, otherQuery] = otherHref.split("?");
      if (otherBase !== baseHref || !otherQuery) return false;
      const otherParams = Array.from(new URLSearchParams(otherQuery).entries());
      if (otherParams.length <= targetParams.length) return false;
      return otherParams.every(([key, val]) =>
        matchesQueryParam(key, val, searchParams.get(key))
      );
    });

    return !hasMoreSpecificSibling;
  }

  const matchesPath = pathname === baseHref || pathname.startsWith(baseHref + "/");
  if (!matchesPath) return false;

  // Yield to any visible sibling link with a more specific path prefix (e.g. /admin/blog/new over /admin/blog, /admin/products/migration over /admin/products)
  const hasMoreSpecificPathSibling = allVisibleHrefs.some((otherHref) => {
    if (otherHref === href || otherHref.includes("?")) return false;
    const otherBase = otherHref.split("?")[0];
    if (otherBase === baseHref || !otherBase.startsWith(baseHref + "/")) return false;
    return pathname === otherBase || pathname.startsWith(otherBase + "/");
  });

  return !hasMoreSpecificPathSibling;
}

export function AdminSidebar() {
  const { user } = useAuthStore();
  const logoutMutation = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Orders: pathname.startsWith("/admin/orders"),
    Blog: pathname.startsWith("/admin/blog"),
    Homepage: pathname.startsWith("/admin/homepage"),
    Users: pathname.startsWith("/admin/users"),
    Settings: pathname.startsWith("/admin/settings"),
  });

  useEffect(() => {
    if (pathname.startsWith("/admin/orders")) {
      setOpenMenus(prev => ({ ...prev, Orders: true }));
    }
    if (pathname.startsWith("/admin/blog")) {
      setOpenMenus(prev => ({ ...prev, Blog: true }));
    }
    if (pathname.startsWith("/admin/homepage")) {
      setOpenMenus(prev => ({ ...prev, Homepage: true }));
    }
    if (pathname.startsWith("/admin/users")) {
      setOpenMenus(prev => ({ ...prev, Users: true }));
    }
    if (pathname.startsWith("/admin/settings")) {
      setOpenMenus(prev => ({ ...prev, Settings: true }));
    }
  }, [pathname]);

  const toggleMenu = (name: string) => {
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.allowedRoles) return true;
    return user?.role && item.allowedRoles.includes(user.role);
  });

  const allVisibleHrefs = filteredNavItems.flatMap((item) =>
    item.subItems ? item.subItems.map((sub) => sub.href) : item.href ? [item.href] : []
  );

  const roleBadge = getRoleBadge(user?.role);

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl z-10">
      <div className="p-6 border-b border-slate-800 flex items-center">
        <Link href={user?.role === "logistic" ? "/admin/shipping" : "/admin"} className="hover:opacity-80 transition-opacity block w-full relative h-10">
          <Image
            src="/Store4riders-Logo.jpg"
            alt="Store4Riders"
            fill
            sizes="200px"
            className="object-contain rounded"
            priority
          />
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {filteredNavItems.map((item) => {
          // If item has sub-items (like Orders, Blog, Homepage or Users)
          if (item.subItems) {
            const isSubActive = item.subItems.some((sub) => {
              const baseHref = sub.href.split("?")[0];
              return pathname === baseHref || pathname.startsWith(baseHref + "/");
            });
            const isOpen = openMenus[item.name] ?? isSubActive;

            return (
              <div key={item.name} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleMenu(item.name)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                    isSubActive
                      ? "bg-slate-800/80 text-white font-semibold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon size={20} className={isSubActive ? "text-brand" : "text-slate-400"} />
                    <span>{item.name}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-slate-800 ml-5">
                    {item.subItems.map((sub) => {
                      const isChildActive = isSidebarLinkActive(
                        sub.href,
                        pathname,
                        searchParams,
                        user?.role,
                        allVisibleHrefs
                      );
                      return (
                        <Link
                          key={sub.name}
                          href={sub.href}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-all ${
                            isChildActive
                              ? "bg-brand text-white font-semibold shadow-sm"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <sub.icon size={16} className={isChildActive ? "text-white" : "text-slate-400"} />
                          <span>{sub.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = item.href
            ? isSidebarLinkActive(
                item.href,
                pathname,
                searchParams,
                user?.role,
                allVisibleHrefs
              )
            : false; 

          return (
            <Link
              key={item.name}
              href={item.href!}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                isActive 
                  ? "bg-brand text-white font-semibold shadow-md" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center px-2 py-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-bold mr-3 shrink-0">
            {user?.firstName?.[0] || "A"}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold truncate text-white">{user?.firstName} {user?.lastName}</span>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadge.className}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
