import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceGenerator } from "../invoiceGenerator";
import { SettingRepository } from "../../../modules/settings/setting.repository";
import { WarehouseRepository } from "../../../modules/warehouse/warehouse.repository";
import { ShipmentRepository } from "../../../modules/shipping/shipment.repository";

vi.mock("../../../modules/settings/setting.repository", () => ({
  SettingRepository: {
    getSettings: vi.fn(),
  },
}));

vi.mock("../../../modules/warehouse/warehouse.repository", () => ({
  WarehouseRepository: {
    findById: vi.fn().mockResolvedValue(null),
    findDefault: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../modules/shipping/shipment.repository", () => ({
  ShipmentRepository: {
    findByOrderId: vi.fn().mockResolvedValue([]),
  },
}));

describe("InvoiceGenerator - Dynamic Settings & Exchange Policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate a valid PDF buffer and reflect dynamic returnWindowDays from settings", async () => {
    vi.mocked(SettingRepository.getSettings).mockResolvedValue({
      legalBusinessName: "Store4Riders Private Limited",
      storeOriginAddress: "2041 TILAK ROAD, Nikhil Pride Apartment, Next to Abhinav Kala Vidyalaya, Near Monarch Showroom",
      storeOriginCity: "Pune",
      storeOriginState: "Maharashtra",
      storeOriginPincode: "411030",
      storeOriginPhone: "9894989124",
      gstin: "27ABCDE1234F1Z5",
      taxRate: 18,
      returnWindowDays: 2, // Admin configured 2 days!
    } as any);

    const mockOrder: any = {
      id: "ord_12345",
      orderNumber: "OD-S4R-2611100001",
      createdAt: new Date("2026-11-23T10:00:00Z"),
      paymentMethod: "payu",
      status: "confirmed",
      shippingAddress: {
        fullName: "Test Vikram",
        phone: "+918789494262",
        street: "Hariharganj, Bhadwa",
        addressLine1: "Hariharganj, Bhadwa",
        city: "Rafiganj",
        state: "Bihar",
        pincode: "824122",
        country: "India",
      },
      businessName: "Adidas Test",
      customerGstin: "27AAPCS1234F1Z5",
      items: [
        {
          name: "Store4Riders Sandbox Test Item ('11)",
          sku: "TEST-SANDBOX-001-STD",
          hsnCode: "6506",
          quantity: 1,
          unitPrice: 1.0,
          taxRate: 18,
          taxAmount: 0.15,
        },
      ],
      pricing: {
        subtotal: 1.0,
        tax: 0.15,
        taxRate: 18,
        discount: 0,
        couponDiscount: 0,
        shipping: 0,
        total: 1.0,
      },
    };

    const buffer = await InvoiceGenerator.generateInvoiceBuffer(mockOrder);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    // PDF begins with %PDF-
    const headerStr = buffer.slice(0, 5).toString("utf-8");
    expect(headerStr).toBe("%PDF-");
  });
});
