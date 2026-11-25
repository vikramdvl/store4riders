export interface ParsedExchangeNote {
  raw: string;
  reasonType: string;
  replacementRequirement: string;
  itemsList: string;
  customerNote: string;
}

/**
 * Parses pipe-delimited or legacy exchange request note strings into clean structured fields.
 */
export function parseExchangeNote(text?: string): ParsedExchangeNote {
  if (!text) {
    return {
      raw: "",
      reasonType: "Customer Exchange Request",
      replacementRequirement: "",
      itemsList: "",
      customerNote: "",
    };
  }

  const clean = text.replace(/^(Exchange|Return)\s+requested:\s*/i, "").trim();

  if (clean.includes("|")) {
    const parts = clean.split("|").map((p) => p.trim());
    let reasonType = "";
    let replacementRequirement = "";
    let itemsList = "";
    let customerNote = "";

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower.startsWith("reason:") || lower.startsWith("type:")) {
        reasonType = part.replace(/^(reason|type):\s*/i, "").trim();
      } else if (lower.startsWith("replacement:") || lower.startsWith("desired replacement:")) {
        replacementRequirement = part.replace(/^(replacement|desired replacement):\s*/i, "").trim();
      } else if (lower.startsWith("item(s):") || lower.startsWith("item:") || lower.startsWith("items:")) {
        itemsList = part.replace(/^items?(\(s\))?:\s*/i, "").trim();
      } else if (lower.startsWith("note:") || lower.startsWith("details:")) {
        customerNote = part.replace(/^(note|details):\s*/i, "").trim();
      }
    }

    return {
      raw: text,
      reasonType: reasonType || "Exchange Requested",
      replacementRequirement,
      itemsList,
      customerNote,
    };
  }

  return {
    raw: text,
    reasonType: "Exchange Requested",
    replacementRequirement: "",
    itemsList: "",
    customerNote: clean,
  };
}

export interface WhatsAppFeeMessageParams {
  customerName?: string;
  orderNumber: string;
  desiredReplacement?: string;
  shippingFee: number;
  orderUrl?: string;
  upiMerchantVpa?: string;
}

/**
 * Builds a clear, customer-friendly WhatsApp message to request return + re-shipping fee after QC passes.
 */
export function buildWhatsAppExchangeFeeMessage(params: WhatsAppFeeMessageParams): string {
  const {
    customerName = "Rider",
    orderNumber,
    desiredReplacement,
    shippingFee,
    orderUrl,
    upiMerchantVpa,
  } = params;

  const replacementLine = desiredReplacement
    ? `Your replacement (*${desiredReplacement}*) is ready for packing once shipping charges are settled.\n\n`
    : `Your replacement gear is ready for packing once shipping charges are settled.\n\n`;

  const lines = [
    `*Store4Riders — Exchange QC Passed!*`,
    ``,
    `Hello *${customerName}*,`,
    `Your gear exchange for Order *#${orderNumber}* has passed our warehouse quality inspection.`,
    ``,
    replacementLine.trim(),
    `As per our Exchange Policy (customer bears 2-way pickup & replacement shipping charges), please settle *₹${shippingFee}* using any option below:`,
  ];

  if (orderUrl) {
    lines.push(`• *Pay Online (UPI / Card / NetBanking):* ${orderUrl}`);
  }
  if (upiMerchantVpa) {
    lines.push(`• *Direct UPI ID:* ${upiMerchantVpa} (Amount: ₹${shippingFee})`);
  }
  lines.push(`• *Prefer Cash on Delivery?* Reply "COD" and we will dispatch your replacement with ₹${shippingFee} COD payable at delivery.`);
  lines.push(``);
  lines.push(`Reply with payment confirmation/screenshot if paying via Direct UPI so we can dispatch immediately!`);

  return lines.join("\n");
}

export interface ExchangeNoteEntry {
  text?: string;
  timestamp?: string | Date;
}

const SYSTEM_EXCHANGE_NOTE_PREFIXES = [
  "exchange approved",
  "exchange rejected",
  "reverse pickup",
  "reverse tracking",
  "courier picked up exchange parcel",
  "warehouse qc ",
  "exchange shipping fee",
  "replacement dispatched",
  "exchange completed",
];

/**
 * Finds the original customer exchange/return request note instead of picking up
 * subsequent admin lifecycle log entries (approval, pickup, QC, fee, dispatch).
 */
export function findExchangeRequestNote<T extends ExchangeNoteEntry>(notes?: T[] | null): T | undefined {
  if (!Array.isArray(notes) || notes.length === 0) return undefined;

  const valid = notes.filter((n) => typeof n?.text === "string" && n.text.trim().length > 0);
  const reversed = valid.slice().reverse();

  const explicitRequest = reversed.find((n) => {
    const lower = n.text!.trim().toLowerCase();
    return lower.startsWith("exchange requested:") || lower.startsWith("return requested:");
  });
  if (explicitRequest) return explicitRequest;

  const structuredNote = reversed.find((n) => {
    const lower = n.text!.toLowerCase();
    return lower.includes("reason:") && lower.includes("|");
  });
  if (structuredNote) return structuredNote;

  const nonSystemExchangeNote = reversed.find((n) => {
    const lower = n.text!.trim().toLowerCase();
    const isSystemLog = SYSTEM_EXCHANGE_NOTE_PREFIXES.some((prefix) => lower.startsWith(prefix));
    return !isSystemLog && (lower.includes("exchange") || lower.includes("return"));
  });
  if (nonSystemExchangeNote) return nonSystemExchangeNote;

  return undefined;
}

export interface InferredExchangeState {
  stage: string;
  qcStatus: "pending" | "passed" | "failed";
  shippingFee: number;
  shippingFeeStatus: string;
  qcNotes: string;
  rejectionReason: string;
  reverseAwb: string;
  replacementAwb: string;
}

/**
 * Reconstructs exchange lifecycle stage, QC status, and shipping fee status
 * from order status + chronological order notes when `order.exchangeDetails` is missing.
 */
export function inferExchangeProgressFromNotes(
  notes?: ExchangeNoteEntry[] | null,
  orderStatus?: string,
  configuredDefaultFee = 299
): InferredExchangeState {
  const status = String(orderStatus || "").toLowerCase();
  let stage = "requested";
  let qcStatus: "pending" | "passed" | "failed" = "pending";
  let shippingFee = configuredDefaultFee;
  let shippingFeeStatus = shippingFee <= 0 ? "waived" : "pending";
  let qcNotes = "";
  let rejectionReason = "";
  let reverseAwb = "";
  let replacementAwb = "";

  if (status === "return_approved") stage = "approved";
  else if (status === "return_picked") stage = "picked_up";
  else if (status === "returned") {
    stage = "completed";
    qcStatus = "passed";
  }

  if (Array.isArray(notes)) {
    for (const note of notes) {
      const text = typeof note?.text === "string" ? note.text.trim() : "";
      if (!text) continue;
      const lower = text.toLowerCase();

      if (lower.startsWith("exchange approved")) {
        if (stage === "requested") stage = "approved";
        const awbMatch = text.match(/AWB:\s*([A-Za-z0-9_-]+)/i);
        if (awbMatch?.[1]) reverseAwb = awbMatch[1];
      } else if (lower.startsWith("exchange rejected")) {
        stage = "rejected";
        rejectionReason = text.replace(/^Exchange rejected\.?\s*(Reason:\s*)?/i, "").trim();
      } else if (lower.startsWith("reverse pickup") || lower.startsWith("reverse tracking")) {
        if (stage === "requested") stage = "approved";
        const awbMatch = text.match(/AWB:\s*([A-Za-z0-9_-]+)/i);
        if (awbMatch?.[1]) reverseAwb = awbMatch[1];
      } else if (lower.startsWith("courier picked up exchange parcel")) {
        if (qcStatus !== "passed") stage = "picked_up";
        const awbMatch = text.match(/AWB:\s*([A-Za-z0-9_-]+)/i);
        if (awbMatch?.[1]) reverseAwb = awbMatch[1];
      } else if (lower.startsWith("warehouse qc passed")) {
        qcStatus = "passed";
        const notesMatch = text.match(/^Warehouse QC PASSED\s*\(([^)]+)\)/i);
        if (notesMatch?.[1]) qcNotes = notesMatch[1].trim();
        const feeMatch = text.match(/Rs\.\s*(\d+(?:\.\d+)?)/i);
        if (feeMatch?.[1]) shippingFee = Number(feeMatch[1]);
        shippingFeeStatus =
          shippingFee <= 0
            ? "waived"
            : shippingFeeStatus !== "pending"
            ? shippingFeeStatus
            : "pending";
        stage = shippingFee <= 0 || shippingFeeStatus !== "pending" ? "fee_settled" : "qc_passed";
      } else if (lower.startsWith("warehouse qc failed")) {
        qcStatus = "failed";
        stage = "qc_failed";
        qcNotes = text.replace(/^Warehouse QC FAILED:\s*/i, "").trim();
        rejectionReason = qcNotes;
      } else if (lower.startsWith("exchange shipping fee")) {
        const feeMatch = text.match(/Rs\.\s*(\d+(?:\.\d+)?)/i);
        if (feeMatch?.[1]) shippingFee = Number(feeMatch[1]);
        if (lower.includes("online pay mode")) {
          shippingFeeStatus = "pending";
          stage = "qc_passed";
          continue;
        }
        if (lower.includes("paid online")) {
          shippingFeeStatus = "paid_online";
        } else if (lower.includes("paid manually")) {
          shippingFeeStatus = "paid_manual";
        } else if (lower.includes("cod on replacement")) {
          shippingFeeStatus = "cod_on_replacement";
        } else if (lower.includes("waived")) {
          shippingFeeStatus = "waived";
          shippingFee = 0;
        }
        if (stage !== "replacement_dispatched" && stage !== "completed") {
          stage = "fee_settled";
        }
      } else if (lower.startsWith("replacement dispatched via")) {
        qcStatus = "passed";
        stage = "replacement_dispatched";
        const awbMatch = text.match(/AWB:\s*([A-Za-z0-9_-]+)/i);
        if (awbMatch?.[1]) replacementAwb = awbMatch[1];
      } else if (lower.startsWith("exchange completed")) {
        qcStatus = "passed";
        stage = "completed";
      }
    }
  }

  return {
    stage,
    qcStatus,
    shippingFee,
    shippingFeeStatus,
    qcNotes,
    rejectionReason,
    reverseAwb,
    replacementAwb,
  };
}

export interface ExchangeWindowStatus {
  allowed: boolean;
  reason?: "disabled" | "expired";
  daysElapsed: number;
  windowDays?: number;
}

/**
 * Evaluates whether a delivered order falls within the Admin-configured exchange window.
 */
export function getExchangeWindowStatus(
  deliveredAt?: string | Date | null,
  returnWindowDays?: number,
  nowMs: number = Date.now()
): ExchangeWindowStatus {
  if (returnWindowDays === 0) {
    return { allowed: false, reason: "disabled", daysElapsed: 0, windowDays: 0 };
  }

  if (typeof returnWindowDays === "number" && returnWindowDays > 0 && deliveredAt) {
    const deliveredTime = new Date(deliveredAt).getTime();
    if (Number.isFinite(deliveredTime)) {
      const daysElapsed = Math.max(0, (nowMs - deliveredTime) / (1000 * 60 * 60 * 24));
      if (daysElapsed > returnWindowDays) {
        return {
          allowed: false,
          reason: "expired",
          daysElapsed,
          windowDays: returnWindowDays,
        };
      }
      return {
        allowed: true,
        daysElapsed,
        windowDays: returnWindowDays,
      };
    }
  }

  return {
    allowed: true,
    daysElapsed: 0,
    windowDays: returnWindowDays,
  };
}

export function doesExchangeCoverOrderItem(exchange: any, orderItem: any): boolean {
  if (!exchange || !orderItem) return false;
  const exItems = Array.isArray(exchange.items) ? exchange.items : [];
  if (exItems.length === 0) {
    return true;
  }

  const oiId = String(orderItem._id || orderItem.id || "");
  const oiProdId = String(orderItem.productId || "");
  const oiVar = String(orderItem.variantId || "").toLowerCase();
  const oiSku = String(orderItem.sku || "").toLowerCase();

  return exItems.some((exItm: any) => {
    const exOrderItemId = exItm?.orderItemId ? String(exItm.orderItemId) : "";
    if (exOrderItemId && oiId && exOrderItemId === oiId) return true;

    const exProdId = exItm?.productId ? String(exItm.productId) : "";
    if (exProdId && oiProdId && exProdId === oiProdId) {
      const exVar = String(exItm?.variantId || "").toLowerCase();
      if (exVar) return exVar === oiVar;
      const exSku = String(exItm?.sku || "").toLowerCase();
      if (exSku) return exSku === oiSku;
      return true;
    }

    const exSku = String(exItm?.sku || "").toLowerCase();
    return Boolean(exSku && oiSku && exSku === oiSku);
  });
}

export function getOrderExchangesList(order: any): any[] {
  if (Array.isArray(order?.exchanges) && order.exchanges.length > 0) {
    return order.exchanges;
  }
  if (order?.exchangeDetails?.stage) {
    return [order.exchangeDetails];
  }
  return [];
}

export function findExchangeForOrderItem(order: any, orderItem: any): any | undefined {
  const list = getOrderExchangesList(order);
  if (list.length === 0) return undefined;

  const activeMatch = list.find(
    (ex) => !["rejected", "qc_failed"].includes(ex?.stage) && doesExchangeCoverOrderItem(ex, orderItem)
  );
  if (activeMatch) return activeMatch;

  return list.find((ex) => doesExchangeCoverOrderItem(ex, orderItem));
}
