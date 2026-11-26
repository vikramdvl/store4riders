import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AdminSidebar } from "../components/AdminSidebar";

let mockPathname = "/admin";
let mockSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, priority: _priority, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: () => ({
    user: { firstName: "Vikram", lastName: "Kumar", role: "super_admin" },
  }),
}));

vi.mock("@/core/hooks/useAuth", () => ({
  useLogout: () => ({ mutate: vi.fn() }),
}));

function getActiveSidebarLinks(container: HTMLElement): string[] {
  const links = Array.from(container.querySelectorAll("nav a"));
  return links
    .filter((el) => el.className.includes("bg-brand"))
    .map((el) => el.textContent?.trim() || "");
}

describe("AdminSidebar active highlight exclusivity", () => {
  beforeEach(() => {
    mockPathname = "/admin";
    mockSearch = "";
  });

  it("highlights only About Us Content on /admin/settings?tab=policies&page=about-us", () => {
    mockPathname = "/admin/settings";
    mockSearch = "tab=policies&page=about-us";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["About Us Content"]);
  });

  it("highlights only Contact Us Content on /admin/settings?tab=policies&page=contact-us", () => {
    mockPathname = "/admin/settings";
    mockSearch = "tab=policies&page=contact-us";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["Contact Us Content"]);
  });

  it("highlights only Policy & Page Content on /admin/settings?tab=policies", () => {
    mockPathname = "/admin/settings";
    mockSearch = "tab=policies";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["Policy & Page Content"]);
  });

  it("highlights only New Article on /admin/blog/new (not All Articles)", () => {
    mockPathname = "/admin/blog/new";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["New Article"]);
  });

  it("highlights only Categories on /admin/blog/categories (not All Articles)", () => {
    mockPathname = "/admin/blog/categories";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["Categories"]);
  });

  it("highlights only All Articles when editing an article on /admin/blog/edit/123", () => {
    mockPathname = "/admin/blog/edit/123";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["All Articles"]);
  });

  it("highlights only Bulk Upload on /admin/products/migration (not Products)", () => {
    mockPathname = "/admin/products/migration";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["Bulk Upload"]);
  });

  it("highlights only Products on /admin/products/new", () => {
    mockPathname = "/admin/products/new";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["Products"]);
    expect(screen.getByRole("link", { name: "Products" }).className).toContain("bg-brand");
  });

  it("highlights only Page Redirects on /admin/redirects", () => {
    mockPathname = "/admin/redirects";

    const { container } = render(<AdminSidebar />);
    expect(getActiveSidebarLinks(container)).toEqual(["Page Redirects"]);
  });
});
