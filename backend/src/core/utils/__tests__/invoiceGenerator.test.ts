import { describe, it, expect, vi, beforeEach } from "vitest";
import zlib from "zlib";
import { InvoiceGenerator, formatInvoiceOriginAddress } from "../invoiceGenerator";
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

  it("deduplicates repeated address segments from warehouse addressLine1 and addressLine2", () => {
    const formatted = formatInvoiceOriginAddress(
      "2041 TILAK ROAD, Nikhil Pride Apartment, Next to Abhinav Kala Vidyalaya, Near Monarch Yamaha",
      "Next to Abhinav Kala Vidyalaya, Near Monarch Yamaha"
    );

    expect(formatted).toBe(
      "2041 TILAK ROAD, Nikhil Pride Apartment, Next to Abhinav Kala Vidyalaya, Near Monarch Yamaha"
    );
  });

  it("keeps seller name constant as Store4riders.com (Motohive Media Pvt. Ltd.) even when a warehouse name is present", async () => {
    vi.mocked(SettingRepository.getSettings).mockResolvedValue({
      legalBusinessName: "Store4Riders",
      gstin: "27AAKCM0308G1ZP",
      taxRate: 18,
      returnWindowDays: 7,
    } as any);

    vi.mocked(WarehouseRepository.findDefault).mockResolvedValue({
      name: "MMPL new",
      addressLine1: "2041 TILAK ROAD, Nikhil Pride Apartment, Next to Abhinav Kala Vidyalaya, Near Monarch Yamaha",
      addressLine2: "Next to Abhinav Kala Vidyalaya, Near Monarch Yamaha",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411030",
      phone: "9834999284",
    } as any);

    const mockOrder: any = {
      id: "ord_const_1",
      orderNumber: "OD-S4R-2611270001",
      createdAt: new Date("2026-11-27T10:00:00Z"),
      paymentMethod: "payu",
      status: "confirmed",
      shippingAddress: {
        fullName: "Test Rider",
        phone: "+919876543210",
        addressLine1: "MG Road",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        country: "India",
      },
      items: [
        {
          name: "Test Helmet",
          sku: "TEST-HLM-01",
          hsnCode: "6506",
          quantity: 1,
          unitPrice: 1000,
          taxRate: 18,
          taxAmount: 152.54,
        },
      ],
      pricing: {
        subtotal: 1000,
        tax: 152.54,
        taxRate: 18,
        discount: 0,
        couponDiscount: 0,
        shipping: 0,
        total: 1000,
      },
    };

    const buffer = await InvoiceGenerator.generateInvoiceBuffer(mockOrder);
    const pdfRaw = buffer.toString("latin1");

    // Decompress FlateDecode PDF streams to inspect the actual rendered text operators
    const decompressedChunks: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(pdfRaw)) !== null) {
      const rawStream = Buffer.from(match[1], "latin1");
      try {
        decompressedChunks.push(zlib.inflateSync(rawStream).toString("latin1"));
      } catch {
        decompressedChunks.push(match[1]);
      }
    }
    const extractedPdfContent = decompressedChunks.join("\n");
    const hexStrings = Array.from(extractedPdfContent.matchAll(/<([0-9a-fA-F]+)>/g)).map((m) =>
      Buffer.from(m[1], "hex").toString("latin1")
    );
    const allText = `${extractedPdfContent}\n${hexStrings.join("")}`;

    expect(allText).toContain("Store4riders.com");
    expect(allText).toContain("Motohive Media Pvt. Ltd.");
    expect(allText).not.toContain("MMPL new");

    const addressMatches = allText.match(/Next to Abhinav Kala Vidyalaya/g) || [];
    expect(addressMatches.length).toBe(1);
  });
});
