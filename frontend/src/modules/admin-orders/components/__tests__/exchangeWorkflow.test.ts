import { describe, it, expect } from "vitest";
import { parseExchangeNote, buildWhatsAppExchangeFeeMessage, getExchangeWindowStatus } from "@store4riders/shared-utils";
import { resolveOrderExchangeState } from "../ExchangeWorkflowModals";

describe("Exchange Utilities & Admin State Resolution", () => {
  it("parses pipe-delimited exchange notes cleanly", () => {
    const parsed = parseExchangeNote(
      "Exchange requested: Type: Size Too Small | Item(s): Axor Apex Helmet [L] | Replacement: Need Size XL | Note: Cheeks too tight"
    );

    expect(parsed.reasonType).toBe("Size Too Small");
    expect(parsed.itemsList).toBe("Axor Apex Helmet [L]");
    expect(parsed.replacementRequirement).toBe("Need Size XL");
    expect(parsed.customerNote).toBe("Cheeks too tight");
  });

  it("builds WhatsApp payment request message with online order URL and direct UPI", () => {
    const msg = buildWhatsAppExchangeFeeMessage({
      customerName: "Vikram",
      orderNumber: "OD-S4R-2026",
      desiredReplacement: "Size XL",
      shippingFee: 299,
      orderUrl: "https://store4riders.com/account/orders/ord_1",
      upiMerchantVpa: "store4riders@icici",
    });

    expect(msg).toContain("OD-S4R-2026");
    expect(msg).toContain("Size XL");
    expect(msg).toContain("299");
    expect(msg).toContain("https://store4riders.com/account/orders/ord_1");
    expect(msg).toContain("store4riders@icici");
    expect(msg).toContain('Reply "COD"');
  });

  it("derives structured state safely for legacy exchange orders missing exchangeDetails", () => {
    const legacyOrder = {
      status: "return_approved",
      notes: [
        {
          text: "Exchange requested: Reason: Color / Graphic Exchange | Desired Replacement: Matte Black | Note: Want stealth finish",
        },
      ],
    };

    const resolved = resolveOrderExchangeState(legacyOrder, 299);
    expect(resolved.stage).toBe("approved");
    expect(resolved.reasonType).toBe("Color / Graphic Exchange");
    expect(resolved.desiredReplacement).toBe("Matte Black");
    expect(resolved.feeAmount).toBe(299);
    expect(resolved.feeStatus).toBe("pending");
    expect(resolved.qcStatus).toBe("pending");
  });

  it("prefers customer request note over subsequent approval note and recovers QC stage from notes if exchangeDetails was dropped", () => {
    const orderWithNotesOnly = {
      status: "return_picked",
      notes: [
        {
          text: "Exchange requested: Type: Size Too Small | Replacement: Need Size XL | Note: Tight fit around cheeks",
        },
        {
          text: "Exchange approved. Note: Approved for gear exchange.",
        },
        {
          text: "Warehouse QC PASSED (Original tags, packaging and unused condition verified at hub.). Awaiting 2-way courier fee of Rs. 299 from customer.",
        },
      ],
    };

    const resolved = resolveOrderExchangeState(orderWithNotesOnly, 299);
    expect(resolved.reasonType).toBe("Size Too Small");
    expect(resolved.desiredReplacement).toBe("Need Size XL");
    expect(resolved.customerNote).toBe("Tight fit around cheeks");
    expect(resolved.qcStatus).toBe("passed");
    expect(resolved.stage).toBe("qc_passed");
    expect(resolved.feeAmount).toBe(299);
    expect(resolved.feeStatus).toBe("pending");
  });

  it("prefers structured exchangeDetails over legacy note text when present", () => {
    const structuredOrder = {
      status: "return_picked",
      exchangeDetails: {
        stage: "fee_settled",
        reasonType: "Size Too Small",
        desiredReplacement: "Size XL",
        customerNote: "Tight fit",
        qcStatus: "passed",
        qcNotes: "Verified unused",
        shippingFee: 349,
        shippingFeeStatus: "cod_on_replacement",
        reverseAwb: "REV-111",
        reverseCourier: "Shiprocket Reverse",
      },
    };

    const resolved = resolveOrderExchangeState(structuredOrder, 299);
    expect(resolved.stage).toBe("fee_settled");
    expect(resolved.qcStatus).toBe("passed");
    expect(resolved.feeAmount).toBe(349);
    expect(resolved.feeStatus).toBe("cod_on_replacement");
    expect(resolved.reverseAwb).toBe("REV-111");
  });

  it("evaluates Admin-configured exchange window dynamically instead of assuming 7 days", () => {
    const now = new Date("2026-11-25T12:00:00Z").getTime();
    const threeDaysAgo = new Date("2026-11-22T11:00:00Z").toISOString();
    const tenDaysAgo = new Date("2026-11-15T11:00:00Z").toISOString();

    expect(getExchangeWindowStatus(threeDaysAgo, 2, now)).toMatchObject({ allowed: false, reason: "expired", windowDays: 2 });
    expect(getExchangeWindowStatus(tenDaysAgo, 15, now)).toMatchObject({ allowed: true, windowDays: 15 });
    expect(getExchangeWindowStatus(threeDaysAgo, 0, now)).toMatchObject({ allowed: false, reason: "disabled", windowDays: 0 });
  });
});
