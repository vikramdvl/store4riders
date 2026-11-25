import { NextRequest, NextResponse } from "next/server";
/**
 * @file order.route.ts
 * @description Defines API endpoints for Orders and maps them to Controller methods.
 */
import { OrderController } from "./order.controller";
import { checkOrderRateLimit } from "../../core/middlewares/rateLimiter";

/**
 * @swagger
 * /api/v1/orders/admin:
 *   get:
 *     summary: List all orders (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated orders list
 * /api/v1/orders/admin/{id}/status:
 *   put:
 *     summary: Update order status (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Order updated
 * /api/v1/orders/admin/{id}/notes:
 *   post:
 *     summary: Add internal note to order (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Note added
 * /api/v1/orders/{id}/return:
 *   post:
 *     summary: Submit an exchange request for a delivered order (Customer)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *               images: { type: array, items: { type: string } }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId]
 *                   properties:
 *                     orderItemId: { type: string }
 *                     productId: { type: string }
 *                     variantId: { type: string }
 *                     sku: { type: string }
 *                     name: { type: string }
 *                     quantity: { type: integer }
 *                     desiredReplacement: { type: string }
 *     responses:
 *       200:
 *         description: Exchange request submitted
 * /api/v1/orders/admin/{id}/return:
 *   put:
 *     summary: Approve or reject an exchange request with optional Shiprocket/Delhivery/Xpressbees/Manual reverse pickup (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               exchangeId: { type: string }
 *               action: { type: string, enum: [approve, reject] }
 *               adminNote: { type: string }
 *               shippingFee: { type: number }
 *               triggerCourier: { type: string, enum: [none, shiprocket, delhivery, xpressbees, manual] }
 *               warehouseId: { type: string }
 *               reverseCourier: { type: string }
 *               reverseAwb: { type: string }
 *               reverseTrackingUrl: { type: string }
 *     responses:
 *       200:
 *         description: Exchange approval or rejection processed
 * /api/v1/orders/admin/{id}/exchange/pickup:
 *   put:
 *     summary: Schedule or update reverse pickup for exchange via Shiprocket, Delhivery, Xpressbees, or Manual AWB (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               exchangeId: { type: string }
 *               action: { type: string, enum: [schedule_reverse, mark_picked_up, update_tracking] }
 *               provider: { type: string, enum: [shiprocket, delhivery, xpressbees, manual] }
 *               warehouseId: { type: string }
 *               reverseCourier: { type: string }
 *               reverseAwb: { type: string }
 *               reverseTrackingUrl: { type: string }
 *     responses:
 *       200:
 *         description: Reverse pickup updated
 * /api/v1/orders/admin/{id}/exchange/qc:
 *   post:
 *     summary: Submit warehouse QC inspection result and select Online Pay vs COD shipping fee mode (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [result, tagsIntact, unusedCondition, packagingIntact, qcNotes]
 *             properties:
 *               exchangeId: { type: string }
 *               result: { type: string, enum: [passed, failed] }
 *               tagsIntact: { type: boolean }
 *               unusedCondition: { type: boolean }
 *               packagingIntact: { type: boolean }
 *               qcNotes: { type: string }
 *               shippingFee: { type: number }
 *               feeCollectionMode: { type: string, enum: [online, cod, waived] }
 *     responses:
 *       200:
 *         description: QC result recorded
 * /api/v1/orders/admin/{id}/exchange/fee:
 *   put:
 *     summary: Switch fee mode to Online Pay (PayU/UPI), Mark Paid Manually, COD on Replacement, or Waive (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [settlementMode]
 *             properties:
 *               exchangeId: { type: string }
 *               settlementMode: { type: string, enum: [online_pending, paid_manual, cod_on_replacement, waived] }
 *               paymentRef: { type: string }
 *               shippingFee: { type: number }
 *               note: { type: string }
 *     responses:
 *       200:
 *         description: Exchange shipping fee mode updated
 * /api/v1/orders/admin/{id}/exchange/dispatch:
 *   post:
 *     summary: Dispatch replacement product for exchange via Shiprocket, Delhivery, Xpressbees, or Manual (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider]
 *             properties:
 *               exchangeId: { type: string }
 *               provider: { type: string, enum: [shiprocket, delhivery, xpressbees, manual] }
 *               warehouseId: { type: string }
 *               courierName: { type: string }
 *               awb: { type: string }
 *               trackingUrl: { type: string }
 *               replacementVariant: { type: string }
 *               autoAssignAwb: { type: boolean }
 *     responses:
 *       200:
 *         description: Replacement dispatched
 * /api/v1/orders/admin/{id}/exchange/complete:
 *   put:
 *     summary: Mark exchange as completed upon replacement delivery (Admin)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exchange completed
 * /api/v1/orders/{id}/exchange/fee-pay:
 *   post:
 *     summary: Initialize online payment session (PayU/CCAvenue/UPI) for exchange 2-way shipping fee (Customer)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod]
 *             properties:
 *               exchangeId: { type: string }
 *               paymentMethod: { type: string, enum: [payu, ccavenue, upi] }
 *     responses:
 *       200:
 *         description: Gateway payment payload returned
 */
export async function orderRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

  if (method === "POST" && pathLen === 0) {
    await checkOrderRateLimit(ip);
    return await OrderController.create(req);
  }

  if ((method === "POST" || method === "GET") && routePath[0] === "webhook") {
    return await OrderController.webhook(req, routePath);
  }

  if (method === "POST" && pathLen === 1 && routePath[0] === "sync-payment") {
    return await OrderController.syncPaymentStatus(req);
  }

  if (method === "POST" && pathLen === 1 && (routePath[0] === "verify" || routePath[0] === "verify-payment")) {
    return await OrderController.verify(req);
  }

  if (method === "GET" && pathLen === 1 && routePath[0] === "me") {
    return await OrderController.myOrders(req);
  }

  if (method === "GET" && pathLen === 1 && routePath[0] === "admin") {
    return await OrderController.adminGetAll(req);
  }

  if (method === "GET" && pathLen === 2 && routePath[0] === "admin" && routePath[1] === "counts") {
    return await OrderController.adminGetCounts(req);
  }

  if (method === "GET" && pathLen === 2 && routePath[0] === "admin" && routePath[1] === "suggest") {
    return await OrderController.adminSuggest(req);
  }

  if (method === "GET" && pathLen === 2 && routePath[0] === "admin") {
    return await OrderController.adminGetById(req, routePath[1]);
  }

  if (method === "PUT" && pathLen === 3 && routePath[0] === "admin" && routePath[2] === "status") {
    return await OrderController.adminUpdateStatus(req, routePath[1]);
  }

  if (method === "DELETE" && pathLen === 2 && routePath[0] === "admin") {
    return await OrderController.adminDeleteOrder(req, routePath[1]);
  }

  if (method === "POST" && pathLen === 3 && routePath[0] === "admin" && routePath[2] === "notes") {
    return await OrderController.adminAddNote(req, routePath[1]);
  }

  if (method === "PUT" && pathLen === 3 && routePath[0] === "admin" && routePath[2] === "return") {
    return await OrderController.adminHandleReturn(req, routePath[1]);
  }

  if (pathLen === 4 && routePath[0] === "admin" && routePath[2] === "exchange") {
    const orderId = routePath[1];
    const action = routePath[3];
    if (method === "PUT" && action === "pickup") {
      return await OrderController.adminExchangePickup(req, orderId);
    }
    if (method === "POST" && action === "qc") {
      return await OrderController.adminSubmitExchangeQc(req, orderId);
    }
    if (method === "PUT" && action === "fee") {
      return await OrderController.adminSettleExchangeFee(req, orderId);
    }
    if (method === "POST" && action === "dispatch") {
      return await OrderController.adminDispatchReplacement(req, orderId);
    }
    if (method === "PUT" && action === "complete") {
      return await OrderController.adminCompleteExchange(req, orderId);
    }
  }

  if (method === "POST" && pathLen === 3 && routePath[0] !== "admin" && routePath[1] === "exchange" && routePath[2] === "fee-pay") {
    return await OrderController.initiateExchangeFeePayment(req, routePath[0]);
  }

  if (method === "POST" && pathLen === 2 && routePath[1] === "return") {
    return await OrderController.requestReturn(req, routePath[0]);
  }

  if (method === "POST" && pathLen === 3 && routePath[0] === "admin" && routePath[2] === "resend-invoice-email") {
    return await OrderController.adminResendInvoiceEmail(req, routePath[1]);
  }

  if (method === "PUT" && pathLen === 3 && routePath[0] === "admin" && routePath[2] === "warehouse") {
    return await OrderController.adminAssignWarehouse(req, routePath[1]);
  }

  if (method === "GET" && pathLen === 2 && routePath[1] === "invoice") {
    return await OrderController.generateInvoice(req, routePath[0]);
  }

  if (method === "GET" && pathLen === 1 && routePath[0] !== "admin") {
    return await OrderController.getById(req, routePath[0]);
  }

  return null;
}
