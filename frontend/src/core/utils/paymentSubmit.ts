import { toast } from "sonner";

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
