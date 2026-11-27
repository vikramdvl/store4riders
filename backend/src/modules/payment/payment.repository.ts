import { IPayment, PaymentStatus, IRefund } from "@store4riders/shared-types";
import { PaymentModel, PaymentDocument } from "./payment.model";
import { ClientSession } from "mongoose";

export class PaymentRepository {
  static async create(data: Partial<IPayment>, session?: ClientSession): Promise<PaymentDocument> {
    const payment = new PaymentModel(data);
    return payment.save({ session });
  }

  static async findById(id: string, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findById(id).session(session || null).exec();
  }

  static async findByGatewayOrderId(gatewayOrderId: string, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({ gatewayOrderId }).session(session || null).exec();
  }

  static async findByGatewayPaymentId(gatewayPaymentId: string, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({
      gatewayPaymentId,
      status: { $in: ["captured", "refunded", "partially_refunded"] },
    })
      .session(session || null)
      .exec();
  }

  static async findByOrderId(orderId: string, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({
      orderId,
      paymentPurpose: { $ne: "exchange_fee" },
    })
      .sort({ createdAt: -1 })
      .session(session || null)
      .exec();
  }

  static async findByOrderIdAndPurpose(
    orderId: string,
    purpose: "order" | "exchange_fee",
    session?: ClientSession
  ): Promise<PaymentDocument | null> {
    const query =
      purpose === "order"
        ? { orderId, paymentPurpose: { $ne: "exchange_fee" } }
        : { orderId, paymentPurpose: "exchange_fee" };
    return PaymentModel.findOne(query)
      .sort({ createdAt: -1 })
      .session(session || null)
      .exec();
  }

  static async findByIdempotencyKey(idempotencyKey: string, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findOne({ idempotencyKey }).session(session || null).exec();
  }

  static async atomicStatusTransition(
    id: string,
    fromStatus: PaymentStatus | PaymentStatus[],
    toStatus: PaymentStatus,
    updates: Partial<IPayment> = {},
    session?: ClientSession
  ): Promise<PaymentDocument | null> {
    const statuses = Array.isArray(fromStatus) ? fromStatus : [fromStatus];
    
    return PaymentModel.findOneAndUpdate(
      { _id: id, status: { $in: statuses } },
      { $set: { status: toStatus, ...updates } },
      { new: true, session }
    ).exec();
  }

  static async addWebhookEvent(id: string, eventId: string, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findByIdAndUpdate(
      id,
      { $addToSet: { webhookEvents: eventId } },
      { new: true, session }
    ).exec();
  }

  /**
   * Atomically claims a webhook event ID in a single DB operation to prevent concurrent check-then-insert races.
   * Returns true if this call newly claimed the event ID, false if it had already been claimed.
   */
  static async claimWebhookEvent(id: string, eventId: string, session?: ClientSession): Promise<boolean> {
    const claimed = await PaymentModel.findOneAndUpdate(
      { _id: id, webhookEvents: { $ne: eventId } },
      { $addToSet: { webhookEvents: eventId } },
      { new: true, session }
    ).exec();
    return !!claimed;
  }

  static async hasProcessedEvent(id: string, eventId: string): Promise<boolean> {
    const payment = await PaymentModel.findOne({ _id: id, webhookEvents: eventId }).lean().exec();
    return !!payment;
  }

  static async addRefund(id: string, refund: IRefund, session?: ClientSession): Promise<PaymentDocument | null> {
    return PaymentModel.findByIdAndUpdate(
      id,
      { $push: { refunds: refund } },
      { new: true, session }
    ).exec();
  }
}
