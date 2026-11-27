import { PaymentRepository } from "./payment.repository";
import { OrderService } from "../order/order.service";
import { AppError, ForbiddenError } from "../../core/errors/AppError";

export class PaymentService {
  
  static async processWebhook(gateway: string, rawBody: string, signature: string, headers: Record<string, string>) {
    // We delegate the business logic of order fulfillment via webhook to the OrderService,
    // which internally uses PaymentGatewayFactory and transitions both Payment and Order.
    
    // Check if gateway is valid
    const validGateways = ["payu", "ccavenue", "snapmint"];
    if (!validGateways.includes(gateway)) {
      throw new AppError(`Invalid gateway specified in webhook URL: ${gateway}`, 400);
    }
    
    // The OrderService currently handles the heavy lifting of atomic transitions and emails
    // We pass the actual gateway
    await OrderService.handleWebhook(rawBody, { ...headers, "x-gateway-source": gateway }, gateway);
  }

  static async getPaymentStatus(paymentId: string, requesterUserId?: string) {
    if (!requesterUserId) {
      throw new AppError("Authentication required", 401);
    }

    const payment = await PaymentRepository.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);

    const { OrderRepository } = await import("../order/order.repository");
    const order =
      (payment.orderId ? await OrderRepository.findById(payment.orderId) : null) ||
      (payment.gatewayOrderId ? await OrderRepository.findByGatewayOrderId(payment.gatewayOrderId) : null);

    const isOwner = Boolean(order?.userId && String(order.userId) === String(requesterUserId));
    if (!isOwner) {
      const { UserService } = await import("../user/user.service");
      const role = await UserService.getRole(requesterUserId);
      if (role === "customer") {
        throw new ForbiddenError("You do not have permission to view this payment");
      }
    }

    return {
      id: payment._id,
      status: payment.status,
      gatewayOrderId: payment.gatewayOrderId,
      amount: payment.amount,
      method: payment.method
    };
  }
}
