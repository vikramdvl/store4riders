import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderFulfillmentPanel } from "../components/OrderFulfillmentPanel";

const { mockPushMutate, mockDirectMutate, mockSyncMutate } = vi.hoisted(() => ({
  mockPushMutate: vi.fn(),
  mockDirectMutate: vi.fn(),
  mockSyncMutate: vi.fn(),
}));

let mockOrderData: any = null;
let mockPublicSettingsData: any = null;

vi.mock("next/image", () => ({
  default: (props: any) => <img src={props.src} alt={props.alt || ""} />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/core/hooks/useOrderById", () => ({
  useAdminOrderById: () => ({
    data: mockOrderData,
    isLoading: false,
  }),
}));

vi.mock("@/core/hooks/usePaymentSettings", () => ({
  usePublicSettings: () => ({
    data: mockPublicSettingsData,
  }),
}));

vi.mock("@/core/hooks/useWarehouses", () => ({
  useWarehouses: () => ({
    data: [
      {
        _id: "wh_1",
        name: "Kolkata Main Hub",
        shiprocketLocationId: "SR_KOL_01",
        addressLine1: "12 Park Street",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700016",
        phone: "9876543210",
        isDefault: true,
      },
    ],
    isLoading: false,
  }),
  useSyncShiprocketWarehouses: () => ({
    mutate: mockSyncMutate,
    isPending: false,
  }),
}));

vi.mock("@/core/hooks/useAdminShipments", () => ({
  usePushToShiprocket: () => ({
    mutate: mockPushMutate,
    isPending: false,
  }),
  useCreateDirectShipment: () => ({
    mutate: mockDirectMutate,
    isPending: false,
  }),
}));

describe("OrderFulfillmentPanel - End-to-End Weight & Dimensions Dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicSettingsData = {
      packagePresets: [
        { name: "Helmet Box", length: 40, breadth: 30, height: 30 },
        { name: "Small Pouch", length: 20, breadth: 15, height: 10 },
      ],
    };
  });

  it("auto-fills child variant weight/LBH from order item, computes volumetric weight, and sends exact dims to Shiprocket", async () => {
    mockOrderData = {
      _id: "ord_101",
      orderNumber: "S4R-2026-101",
      paymentStatus: "paid",
      paymentMethod: "prepaid",
      createdAt: "2026-11-27T10:00:00.000Z",
      shippingAddress: {
        fullName: "Rohan Sharma",
        phone: "9876543210",
        addressLine1: "42 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
      items: [
        {
          productId: "prod_1",
          variantId: "var_m",
          sku: "AXOR-APEX-M",
          name: "Axor Apex Venomous Helmet",
          quantity: 1,
          unitPrice: 4999,
          weight: 1.65,
          weightUnit: "kg",
          length: 37,
          breadth: 29,
          height: 29,
          dimensionUnit: "cm",
          product: {
            weight: 1.5,
            weightUnit: "kg",
            length: 35,
            breadth: 28,
            height: 28,
            dimensionUnit: "cm",
            variants: [
              { id: "var_m", sku: "AXOR-APEX-M", weight: 1.65, length: 37, breadth: 29, height: 29 },
            ],
          },
        },
      ],
    };

    render(<OrderFulfillmentPanel orderId="ord_101" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/✓ Catalog Specs \(1\/1 items\) • Fit: Helmet Box/i)).toBeDefined();
    });

    // 37 * 29 * 29 / 5000 = 6.22 kg volumetric / billable weight
    const spinbuttons = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(spinbuttons.map((i) => i.value)).toEqual(["1.65", "37", "29", "29"]);
    expect(screen.getAllByText("6.22 kg").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /Send Order to Shiprocket Dashboard/i }));

    expect(mockPushMutate).toHaveBeenCalledTimes(1);
    expect(mockPushMutate.mock.calls[0][0]).toMatchObject({
      orderId: "ord_101",
      warehouseId: "wh_1",
      weightKg: 1.65,
      length: 37,
      breadth: 29,
      height: 29,
      recipientPhone: "9876543210",
    });
  });

  it("warns when catalog L×B×H is missing and applies manual warehouse carton preset override accurately", async () => {
    mockOrderData = {
      _id: "ord_102",
      orderNumber: "S4R-2026-102",
      paymentStatus: "paid",
      paymentMethod: "prepaid",
      createdAt: "2026-11-27T10:00:00.000Z",
      shippingAddress: {
        fullName: "Ankit Verma",
        phone: "9123456789",
        addressLine1: "14 Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
      },
      items: [
        {
          productId: "prod_2",
          sku: "NO-DIM-ITEM",
          name: "Custom Riding Strap",
          quantity: 1,
          unitPrice: 799,
          product: {},
        },
      ],
    };

    render(<OrderFulfillmentPanel orderId="ord_102" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Using default box \(15×15×10 cm\)/i)).toBeDefined();
      expect(screen.getByText(/Missing catalog weight \(0\.5 kg fallback used\):/i)).toBeDefined();
      expect(screen.getByText(/Missing catalog L×B×H:/i)).toBeDefined();
    });

    // Packer clicks master carton preset "Helmet Box"
    fireEvent.click(screen.getByRole("button", { name: /Helmet Box/i }));

    await waitFor(() => {
      expect(screen.getByText(/✓ Custom \/ Preset Box Applied \(40×30×30 cm\)/i)).toBeDefined();
    });

    // Packer weighs actual parcel at 2.1 kg
    const spinbuttons = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(spinbuttons[0], { target: { value: "2.1" } });

    fireEvent.click(screen.getByRole("button", { name: /Send Order to Shiprocket Dashboard/i }));

    expect(mockPushMutate).toHaveBeenCalledTimes(1);
    expect(mockPushMutate.mock.calls[0][0]).toMatchObject({
      orderId: "ord_102",
      weightKg: 2.1,
      length: 40,
      breadth: 30,
      height: 30,
    });
  });
});
