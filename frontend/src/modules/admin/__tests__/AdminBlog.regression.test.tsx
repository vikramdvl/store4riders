import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
const createMutateAsyncMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();
const compressMock = vi.fn();
const uploadS3Mock = vi.fn();

let mockPostData: any = undefined;
const mockCategories = [
  { _id: "6b03d5a0a0c1048288ea84b3", name: "Choosing correct Riding Gear", slug: "choosing-correct-riding-gear" },
  { _id: "6b03d5a0a0c1048288ea84b6", name: "Riding Gear care", slug: "riding-gear-care" },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

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

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
    info: (...args: any[]) => toastInfoMock(...args),
  },
}));

vi.mock("@/core/api/client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

vi.mock("@/components/ui/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      aria-label="Article Content"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/Modal", () => ({
  default: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/core/utils/imageCompressor", () => ({
  compressImageToWebP: (...args: any[]) => compressMock(...args),
  uploadImageToS3: (...args: any[]) => uploadS3Mock(...args),
}));

vi.mock("@/core/hooks/useBlog", () => ({
  useAdminBlogPost: () => ({ data: mockPostData, isLoading: false }),
  useAdminBlogPosts: () => ({
    data: {
      items: [
        {
          _id: "post-1",
          title: "Choosing right Motorcycle Boots",
          slug: "choosing-right-riding-boots",
          featuredImage: "https://d2zuvpvc0pfkya.cloudfront.net/uploads/boots.webp",
          categoryName: "Choosing correct Riding Gear",
          status: "published",
          views: 10,
          readingTimeMinutes: 5,
          author: { name: "Vishwas Mokashi" },
        },
      ],
      totalCount: 1,
      totalPages: 1,
    },
    isLoading: false,
  }),
  useAdminBlogCategories: () => ({ data: mockCategories }),
  useCreateBlogPost: () => ({ mutateAsync: createMutateAsyncMock, isPending: false }),
  useUpdateBlogPost: () => ({ mutateAsync: updateMutateAsyncMock, isPending: false }),
  useDeleteBlogPost: () => ({ mutateAsync: deleteMutateAsyncMock, isPending: false }),
  useSeedBlogContent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { AdminBlogEditor } from "../components/AdminBlogEditor";
import { AdminBlogPosts } from "../components/AdminBlogPosts";

describe("Admin Blog Create / Upload / Edit / Delete Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostData = undefined;
    createMutateAsyncMock.mockResolvedValue({ _id: "created-1", slug: "new-helmet-guide" });
    updateMutateAsyncMock.mockResolvedValue({ _id: "post-1", slug: "choosing-right-riding-boots" });
    deleteMutateAsyncMock.mockResolvedValue({ _id: "post-1" });
    compressMock.mockResolvedValue({ file: new File(["webp"], "hero.webp", { type: "image/webp" }) });
    uploadS3Mock.mockResolvedValue("https://d2zuvpvc0pfkya.cloudfront.net/uploads/hero-123.webp");
  });

  it("AdminBlogPosts links view button to /guides/post/:slug and triggers delete mutation", async () => {
    render(<AdminBlogPosts />);

    const viewLink = screen.getByTitle("View live article");
    expect(viewLink.getAttribute("href")).toBe("/guides/post/choosing-right-riding-boots");

    fireEvent.click(screen.getByTitle("Delete article"));
    fireEvent.click(screen.getByRole("button", { name: "Delete Permanently" }));

    await waitFor(() => {
      expect(deleteMutateAsyncMock).toHaveBeenCalledWith("post-1");
    });
  });

  it("AdminBlogEditor creates new post with uploaded CloudFront hero image and category", async () => {
    const { container } = render(<AdminBlogEditor />);

    fireEvent.change(
      screen.getByPlaceholderText("e.g. How to Choose the Right Helmet for Indian Highway Touring"),
      { target: { value: "New Helmet Guide" } }
    );
    fireEvent.change(screen.getByLabelText("Article Content"), {
      target: { value: "<p>Detailed motorcycle helmet guide for highway touring in India.</p>" },
    });

    // Switch to Cover & Media tab and upload hero image
    fireEvent.click(screen.getByRole("button", { name: /Cover & Media/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const rawFile = new File(["img"], "hero.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [rawFile] } });

    await waitFor(() => {
      expect(uploadS3Mock).toHaveBeenCalled();
    });

    // Switch to Category & Tags tab and choose category
    fireEvent.click(screen.getByRole("button", { name: /Category & Tags/i }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "6b03d5a0a0c1048288ea84b3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));

    await waitFor(() => {
      expect(createMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Helmet Guide",
          slug: "new-helmet-guide",
          featuredImage: "https://d2zuvpvc0pfkya.cloudfront.net/uploads/hero-123.webp",
          categoryName: "Choosing correct Riding Gear",
          categorySlug: "choosing-correct-riding-gear",
          status: "published",
        })
      );
      expect(pushMock).toHaveBeenCalledWith("/admin/blog");
    });
  });

  it("AdminBlogEditor pre-selects category by categorySlug when categoryId is empty and clears it on unselect", async () => {
    mockPostData = {
      _id: "post-edit-1",
      title: "Existing Helmet Guide",
      slug: "existing-helmet-guide",
      content: "<p>Existing content with enough characters.</p>",
      excerpt: "Existing excerpt",
      featuredImage: "https://d2zuvpvc0pfkya.cloudfront.net/uploads/old.webp",
      categoryId: "",
      categoryName: "Riding Gear care",
      categorySlug: "riding-gear-care",
      tags: ["Helmets"],
      author: { name: "Vishwas Mokashi" },
      status: "published",
    };

    render(<AdminBlogEditor id="post-edit-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Category & Tags/i }));
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("6b03d5a0a0c1048288ea84b6");

    // Unassign category and save
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Update/i }));

    await waitFor(() => {
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        id: "post-edit-1",
        data: expect.objectContaining({
          categoryId: "",
          categoryName: "",
          categorySlug: "",
        }),
      });
    });
  });

  it("AdminBlogEditor switches to failing tab and shows toast error if validation fails on hidden tab", async () => {
    render(<AdminBlogEditor />);

    // Move away from Content tab while title & content are empty
    fireEvent.click(screen.getByRole("button", { name: /Cover & Media/i }));
    expect(screen.queryByPlaceholderText("e.g. How to Choose the Right Helmet for Indian Highway Touring")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
      expect(
        screen.getByPlaceholderText("e.g. How to Choose the Right Helmet for Indian Highway Touring")
      ).toBeDefined();
    });
    expect(createMutateAsyncMock).not.toHaveBeenCalled();
  });
});
