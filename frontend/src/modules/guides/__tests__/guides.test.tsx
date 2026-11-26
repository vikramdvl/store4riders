import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { IBlogCategory, IBlogPost } from "@store4riders/shared-types";

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, priority: _priority, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => notFoundMock(),
}));

vi.mock("@/components/ui/Breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

const mockPosts: IBlogPost[] = [
  {
    _id: "post-1",
    title: "Choosing right Motorcycle Boots",
    slug: "choosing-right-riding-boots",
    content: "<p>Full guide content</p>",
    excerpt: "Complete guide to choosing motorcycle riding boots.",
    featuredImage:
      "https://d2zuvpvc0pfkya.cloudfront.net/uploads/1795620798564-Choosing_right_Motorcycle_Boots.webp",
    categoryName: "Choosing correct Riding Gear",
    categorySlug: "choosing-correct-riding-gear",
    tags: ["Boots", "Safety"],
    author: { name: "Vishwas Mokashi", jobTitle: "Founder" },
    status: "published",
    publishedAt: "2026-11-25T15:33:22.439Z",
    readingTimeMinutes: 6,
  },
  {
    _id: "post-2",
    title: "Motorcycle Smart Display: What It Is and How to Choose One",
    slug: "choosing-a-motorcycle-smart-display",
    content: "<p>Smart display content</p>",
    excerpt: "Guide to CarPlay and Android Auto motorcycle displays.",
    featuredImage: "",
    categoryName: "",
    categorySlug: "",
    tags: [],
    author: { name: "Store4Riders Team" },
    status: "published",
    publishedAt: "2026-11-20T07:46:00.612Z",
    readingTimeMinutes: 4,
  },
];

const mockCategories: IBlogCategory[] = [
  {
    _id: "cat-1",
    name: "Choosing correct Riding Gear",
    slug: "choosing-correct-riding-gear",
    description: "Gear buying guides",
    articleCount: 11,
  },
];

const usePublicBlogPostsMock = vi.fn();
const usePublicBlogCategoriesMock = vi.fn();
const useRelatedBlogPostsMock = vi.fn();

vi.mock("@/core/hooks/useBlog", () => ({
  usePublicBlogPosts: (...args: any[]) => usePublicBlogPostsMock(...args),
  usePublicBlogCategories: (...args: any[]) => usePublicBlogCategoriesMock(...args),
  useRelatedBlogPosts: (...args: any[]) => useRelatedBlogPostsMock(...args),
}));

import { GuideCard } from "../components/GuideCard";
import { GuideDetailModule } from "../components/GuideDetailModule";
import { GuidesHubModule } from "../components/GuidesHubModule";
import { GuidesCategoryModule } from "../components/GuidesCategoryModule";
import {
  fetchGuideOrBlogPost,
  fetchPublicBlogPosts,
  fetchPublicBlogCategories,
  fetchBlogCategoryBySlug,
  fetchRelatedBlogPosts,
} from "../utils/getPost";

describe("Guides Storefront Live Blog Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePublicBlogPostsMock.mockReturnValue({
      data: { items: mockPosts, totalCount: 2, page: 1, limit: 18, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePublicBlogCategoriesMock.mockReturnValue({
      data: mockCategories,
    });
    useRelatedBlogPostsMock.mockReturnValue({
      data: [mockPosts[1]],
    });
  });

  it("GuideCard renders CloudFront hero image and MongoDB excerpt", () => {
    render(<GuideCard post={mockPosts[0]} />);

    const img = screen.getByRole("img", { name: "Choosing right Motorcycle Boots" });
    expect(img.getAttribute("src")).toContain("https://d2zuvpvc0pfkya.cloudfront.net/uploads/");
    expect(screen.getByText("Complete guide to choosing motorcycle riding boots.")).toBeDefined();
  });

  it("GuideCard does not pass empty string src to Image when featuredImage is missing", () => {
    render(<GuideCard post={mockPosts[1]} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Guide to CarPlay and Android Auto motorcycle displays.")).toBeDefined();
  });

  it("GuideDetailModule renders live hero image, excerpt, and backend related posts", () => {
    render(
      <GuideDetailModule
        slug={mockPosts[0].slug}
        initialPost={mockPosts[0]}
        initialRelatedPosts={[mockPosts[1]]}
      />
    );

    const img = screen.getByRole("img", { name: "Choosing right Motorcycle Boots" });
    expect(img.getAttribute("src")).toContain("https://d2zuvpvc0pfkya.cloudfront.net/uploads/");
    expect(screen.getByText("Complete guide to choosing motorcycle riding boots.")).toBeDefined();
    expect(screen.getByText("Motorcycle Smart Display: What It Is and How to Choose One")).toBeDefined();
  });

  it("GuideDetailModule handles posts without categorySlug safely without broken category links", () => {
    render(
      <GuideDetailModule
        slug={mockPosts[1].slug}
        initialPost={mockPosts[1]}
        initialRelatedPosts={[]}
      />
    );

    const backLink = screen.getByRole("link", { name: /Back to All Guides/i });
    expect(backLink.getAttribute("href")).toBe("/guides");
  });

  it("GuidesHubModule renders strictly API posts and shows empty state instead of static fallback", () => {
    usePublicBlogPostsMock.mockReturnValue({
      data: { items: [], totalCount: 0, page: 1, limit: 18, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<GuidesHubModule />);

    expect(screen.getByText("No matching guides found")).toBeDefined();
    expect(screen.queryByText(/10 Steps for Cleaning Motorcycle Riding Gloves/i)).toBeNull();
  });

  it("GuidesHubModule uses backend pagination and category filter params", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    usePublicBlogPostsMock.mockReturnValue({
      data: { items: mockPosts, totalCount: 36, page: 1, limit: 18, totalPages: 2 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<GuidesHubModule />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(usePublicBlogPostsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, limit: 18 }),
      undefined
    );

    fireEvent.click(screen.getByRole("button", { name: /Choosing correct Riding Gear/i }));
    expect(usePublicBlogPostsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 18,
        categorySlug: "choosing-correct-riding-gear",
      }),
      undefined
    );
  });

  it("GuidesCategoryModule renders category empty state when 0 published posts exist", () => {
    usePublicBlogPostsMock.mockReturnValue({
      data: { items: [], totalCount: 0, page: 1, limit: 18, totalPages: 1 },
      isLoading: false,
      isFetching: false,
    });

    render(
      <GuidesCategoryModule
        categorySlug="bike-news"
        initialCategory={{ _id: "cat-empty", name: "Bike News", slug: "bike-news", articleCount: 0 }}
        initialCategories={mockCategories}
      />
    );

    expect(screen.getByText("No guides in this category yet")).toBeDefined();
  });

  it("GuidesCategoryModule calls notFound() when category is missing", () => {
    usePublicBlogCategoriesMock.mockReturnValue({ data: [] });

    expect(() =>
      render(<GuidesCategoryModule categorySlug="non-existent-category" />)
    ).toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("server fetchers never fall back to static guides-data when API returns 404 or fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    expect(await fetchGuideOrBlogPost("10-steps-for-cleaning-riding-gloves")).toBeNull();
    expect(await fetchBlogCategoryBySlug("choosing-correct-riding-gear")).toBeNull();
    expect(await fetchPublicBlogCategories()).toEqual([]);
    expect(await fetchRelatedBlogPosts("10-steps-for-cleaning-riding-gloves")).toEqual([]);
    expect(await fetchPublicBlogPosts(1, 18)).toEqual({
      items: [],
      totalCount: 0,
      page: 1,
      limit: 18,
      totalPages: 1,
    });

    fetchSpy.mockRestore();
  });
});
