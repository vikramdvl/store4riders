import { toast } from "sonner";

export const PENDING_ORDER_STORAGE_KEY = "s4r_pending_payment_order";
export const PENDING_ORDER_TTL_MS = 2 * 60 * 60 * 1000;

export interface PendingPaymentOrder {
  orderNumber?: string;
  gatewayOrderId?: string;
  guestOrderToken?: string;
  paymentMethod?: string;
  createdAt: number;
}

/**
 * Persists a newly initiated gateway order before leaving or backgrounding checkout so
 * browser crashes, tab kills, or device switch-off before redirect-back can recover & verify status.
 */
export function savePendingPaymentOrder(
  entry: Omit<PendingPaymentOrder, "createdAt">
): void {
  if (typeof window === "undefined") return;
  if (!entry.orderNumber && !entry.gatewayOrderId) return;
  try {
    const payload: PendingPaymentOrder = {
      orderNumber: entry.orderNumber ? String(entry.orderNumber).trim() : undefined,
      gatewayOrderId: entry.gatewayOrderId ? String(entry.gatewayOrderId).trim() : undefined,
      guestOrderToken: entry.guestOrderToken ? String(entry.guestOrderToken).trim() : undefined,
      paymentMethod: entry.paymentMethod ? String(entry.paymentMethod).trim().toLowerCase() : undefined,
      createdAt: Date.now(),
    };
    window.localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-browsing errors cleanly
  }
}

/**
 * Loads a persisted pending payment order reference if it is still within the recovery TTL window.
 */
export function loadPendingPaymentOrder(
  maxAgeMs: number = PENDING_ORDER_TTL_MS
): PendingPaymentOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPaymentOrder> | null;
    if (!parsed || typeof parsed !== "object") {
      window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return null;
    }
    const createdAt = Number(parsed.createdAt);
    const hasRef = Boolean(parsed.orderNumber || parsed.gatewayOrderId);
    if (!hasRef || !Number.isFinite(createdAt) || Date.now() - createdAt > maxAgeMs) {
      window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return null;
    }
    return {
      orderNumber: typeof parsed.orderNumber === "string" ? parsed.orderNumber : undefined,
      gatewayOrderId: typeof parsed.gatewayOrderId === "string" ? parsed.gatewayOrderId : undefined,
      guestOrderToken: typeof parsed.guestOrderToken === "string" ? parsed.guestOrderToken : undefined,
      paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : undefined,
      createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Clears the persisted crash-recovery pending payment order record.
 */
export function clearPendingPaymentOrder(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors
  }
}

/**
 * Progressive backoff delays (ms) after the initial immediate S2S verification check.
 * Covers a ~30s bank/UPI settlement window across PayU, CCAvenue, and Snapmint without flooding the API.
 */
export const PAYMENT_VERIFY_RETRY_DELAYS_MS = [1500, 2500, 3500, 5000, 7000, 10000] as const;

/**
 * Fast progressive backoff delays (ms) when verifying an order that landed on a failure redirect.
 */
export const FAILED_SILENT_RETRY_DELAYS_MS = [1500, 3000] as const;

/**
 * Returns user-friendly display name for a resolved payment method or gateway fallback.
 */
export function formatGatewayDisplayName(method?: string): string {
  switch ((method || "").trim().toLowerCase()) {
    case "payu":
    case "cod":
      return "PayU";
    case "ccavenue":
      return "CCAvenue";
    case "snapmint":
      return "Snapmint";
    case "upi":
    case "gpay":
      return "UPI";
    default:
      return "the payment gateway";
  }
}

/**
 * Returns user-facing uppercase status label while browser navigates to an external gateway.
 */
export function getGatewayRedirectLabel(method: string): string {
  switch ((method || "").toLowerCase()) {
    case "payu":
    case "cod":
      return "REDIRECTING TO PAYU...";
    case "ccavenue":
      return "REDIRECTING TO CCAVENUE...";
    case "snapmint":
      return "REDIRECTING TO SNAPMINT...";
    default:
      return "REDIRECTING TO PAYMENT...";
  }
}

/**
 * Redirects or submits the auto-generated hidden POST form for PayU, CCAvenue, or Snapmint.
 * Shared across regular checkout and exchange shipping fee online payments.
 */
export function submitGatewayPaymentForm(
  method: string,
  gatewayResponse: Record<string, any>
): boolean {
  const normalized = method.toLowerCase();

  if (normalized === "payu" || normalized === "cod") {
    toast.success("Redirecting to PayU Payment Gateway...");

    if (gatewayResponse.redirectUrl) {
      window.location.href = gatewayResponse.redirectUrl;
      return true;
    }

    const isPayuLive = process.env.NEXT_PUBLIC_PAYU_MODE === "live";
    const payuAction =
      gatewayResponse.actionUrl ||
      (isPayuLive ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = payuAction;

    Object.entries(gatewayResponse).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== "redirectUrl" && key !== "actionUrl") {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      }
    });

    document.body.appendChild(form);
    form.submit();
    return true;
  }

  if (normalized === "ccavenue") {
    toast.success("Redirecting to CCAvenue...");

    const isLive = process.env.NEXT_PUBLIC_CCAVENUE_MODE === "live";
    const ccavAction =
      gatewayResponse.actionUrl ||
      (isLive
        ? "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction"
        : "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = ccavAction;
    form.setAttribute("referrerpolicy", "no-referrer");

    const encInput = document.createElement("input");
    encInput.type = "hidden";
    encInput.name = "encRequest";
    encInput.value = String(gatewayResponse.encRequest || "");
    form.appendChild(encInput);

    const accessInput = document.createElement("input");
    accessInput.type = "hidden";
    accessInput.name = "access_code";
    accessInput.value = String(gatewayResponse.access_code || "");
    form.appendChild(accessInput);

    document.body.appendChild(form);
    form.submit();
    return true;
  }

  if (normalized === "snapmint") {
    toast.success("Redirecting to Snapmint...");

    if (gatewayResponse.redirectUrl) {
      window.location.href = gatewayResponse.redirectUrl;
      return true;
    }

    const snapmintAction = gatewayResponse.actionUrl || "https://checkout.snapmint.com/pay";
    const form = document.createElement("form");
    form.method = "POST";
    form.action = snapmintAction;

    Object.entries(gatewayResponse).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== "actionUrl" && key !== "redirectUrl") {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = typeof value === "object" ? JSON.stringify(value) : String(value);
        form.appendChild(input);
      }
    });

    document.body.appendChild(form);
    form.submit();
    return true;
  }

  return false;
}
