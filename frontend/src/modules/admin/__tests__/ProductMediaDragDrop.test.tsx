import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const compressImageToWebPMock = vi.fn();
const uploadImageToS3Mock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, unoptimized: _unoptimized, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/core/utils/imageCompressor", () => ({
  compressImageToWebP: (...args: any[]) => compressImageToWebPMock(...args),
  uploadImageToS3: (...args: any[]) => uploadImageToS3Mock(...args),
}));

vi.mock("@/modules/admin/components/StorefrontCardPreview", () => ({
  StorefrontCardPreview: () => <div data-testid="storefront-card-preview" />,
}));

vi.mock("@/core/api/client", () => ({
  apiClient: { post: vi.fn() },
}));

const useProductFormContextMock = vi.fn();
vi.mock("../components/product-form/ProductFormContext", () => ({
  useProductFormContext: () => useProductFormContextMock(),
}));

import { ProductMediaTab } from "../components/product-form/tabs/ProductMediaTab";
import { MultiImageUploadWebP } from "../components/MultiImageUploadWebP";

describe("Admin Product Image Drag & Drop Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compressImageToWebPMock.mockResolvedValue({
      file: new File(["webp"], "helmet.webp", { type: "image/webp" }),
      originalSize: 204800,
      compressedSize: 51200,
    });
    uploadImageToS3Mock.mockResolvedValue("https://d2zuvpvc0pfkya.cloudfront.net/uploads/helmet.webp");
  });

  it("ProductMediaTab handles file dragOver and drop on the upload dropzone", async () => {
    const handleUploadImages = vi.fn().mockResolvedValue(undefined);
    useProductFormContextMock.mockReturnValue({
      name: "AGV K6 Helmet",
      brand: "AGV",
      basePrice: 45000,
      specialPrice: "",
      images: [],
      setImages: vi.fn(),
      draggedImgIdx: null,
      setDraggedImgIdx: vi.fn(),
      variants: [],
      setVariantImageModalIndex: vi.fn(),
      videoUrl: "",
      setVideoUrl: vi.fn(),
      manualImageUrl: "",
      setManualImageUrl: vi.fn(),
      manualImageAlt: "",
      setManualImageAlt: vi.fn(),
      isCompressing: false,
      compressionBadge: null,
      handleUploadImages,
      setPrimaryImage: vi.fn(),
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDrop: vi.fn(),
      productType: "simple",
      handleTabChange: vi.fn(),
    });

    render(<ProductMediaTab />);

    const dropzone = screen.getByRole("button", {
      name: /Upload product images by dragging files here/i,
    });

    const fakeFile = new File(["img"], "helmet.png", { type: "image/png" });
    const dataTransfer = {
      files: [fakeFile] as unknown as FileList,
      types: ["Files"],
      dropEffect: "none",
    };

    fireEvent.dragEnter(dropzone, { dataTransfer });
    fireEvent.dragOver(dropzone, { dataTransfer });
    expect(screen.getByText("Drop product images here to upload")).toBeDefined();

    fireEvent.drop(dropzone, { dataTransfer });
    await waitFor(() => {
      expect(handleUploadImages).toHaveBeenCalledTimes(1);
    });
    expect(handleUploadImages.mock.calls[0][0]).toHaveLength(1);
  });

  it("ProductMediaTab supports drag-and-drop reordering across gallery image cards", () => {
    const handleDragStart = vi.fn();
    const handleDragOver = vi.fn((e: React.DragEvent) => e.preventDefault());
    const handleDrop = vi.fn();
    const setDraggedImgIdx = vi.fn();

    useProductFormContextMock.mockReturnValue({
      name: "Rynox Storm Evo",
      brand: "Rynox",
      basePrice: 12500,
      specialPrice: "",
      images: [
        { id: "img-1", url: "https://cdn.example.com/1.webp", altText: "Front View", isBase: true },
        { id: "img-2", url: "https://cdn.example.com/2.webp", altText: "Side View", isBase: false },
      ],
      setImages: vi.fn(),
      draggedImgIdx: 0,
      setDraggedImgIdx,
      variants: [],
      setVariantImageModalIndex: vi.fn(),
      videoUrl: "",
      setVideoUrl: vi.fn(),
      manualImageUrl: "",
      setManualImageUrl: vi.fn(),
      manualImageAlt: "",
      setManualImageAlt: vi.fn(),
      isCompressing: false,
      compressionBadge: null,
      handleUploadImages: vi.fn(),
      setPrimaryImage: vi.fn(),
      handleDragStart,
      handleDragOver,
      handleDrop,
      productType: "simple",
      handleTabChange: vi.fn(),
    });

    render(<ProductMediaTab />);

    const img1 = screen.getByRole("img", { name: "Front View" });
    const img2 = screen.getByRole("img", { name: "Side View" });
    expect(img1.getAttribute("draggable")).toBe("false");

    const card1 = img1.closest("[draggable='true']") as HTMLElement;
    const card2 = img2.closest("[draggable='true']") as HTMLElement;
    expect(card1).toBeTruthy();
    expect(card2).toBeTruthy();

    const setData = vi.fn();
    fireEvent.dragStart(card1, {
      dataTransfer: { setData, getData: () => "0", effectAllowed: "move" },
    });
    expect(handleDragStart).toHaveBeenCalledWith(0);
    expect(setData).toHaveBeenCalledWith("text/plain", "0");

    fireEvent.dragOver(card2);
    expect(handleDragOver).toHaveBeenCalled();

    fireEvent.drop(card2, {
      dataTransfer: { getData: () => "0" },
    });
    expect(handleDrop).toHaveBeenCalledWith(1);
  });

  it("MultiImageUploadWebP uploads dropped files and reorders thumbnails via drag and drop", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <MultiImageUploadWebP values={[]} onChange={onChange} />
    );

    const dropzoneText = screen.getByText(/Select Multiple Images/i);
    const dropzone = dropzoneText.closest("div[class*='border-dashed']") as HTMLElement;
    const file = new File(["img"], "glove.png", { type: "image/png" });

    fireEvent.dragOver(dropzone, {
      dataTransfer: { files: [file], types: ["Files"], dropEffect: "none" },
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ["Files"] },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        "https://d2zuvpvc0pfkya.cloudfront.net/uploads/helmet.webp",
      ]);
    });

    const onReorder = vi.fn();
    rerender(
      <MultiImageUploadWebP
        values={[
          "https://cdn.example.com/a.webp",
          "https://cdn.example.com/b.webp",
        ]}
        onChange={onReorder}
      />
    );

    const cards = container.querySelectorAll("[draggable='true']");
    expect(cards.length).toBe(2);

    fireEvent.dragStart(cards[0], {
      dataTransfer: { setData: vi.fn(), getData: () => "0", effectAllowed: "move" },
    });
    fireEvent.drop(cards[1], {
      dataTransfer: { getData: () => "0" },
    });

    expect(onReorder).toHaveBeenCalledWith([
      "https://cdn.example.com/b.webp",
      "https://cdn.example.com/a.webp",
    ]);
  });
});
