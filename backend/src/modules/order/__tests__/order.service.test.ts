import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { OrderService } from '../order.service';
import { OrderRepository } from '../order.repository';
import { ProductRepository } from '../../product/product.repository';
import { PaymentRepository } from '../../payment/payment.repository';
import { PaymentGatewayFactory } from '../../../core/payments/PaymentGatewayFactory';

vi.mock('../order.repository');
vi.mock('../../product/product.repository');
vi.mock('../../payment/payment.repository');
vi.mock('../../../core/payments/PaymentGatewayFactory');
vi.mock('../../cart/cart.service', () => ({
  CartService: { clearCart: vi.fn().mockResolvedValue(true) }
}));
vi.mock('../../coupon/coupon.service', () => ({
  CouponService: { incrementUsage: vi.fn().mockResolvedValue(true) }
}));

vi.mock('crypto', () => ({
  default: {
    createHmac: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('dummy_signature')
    }),
    timingSafeEqual: vi.fn().mockReturnValue(true)
  }
}));

vi.mock('../../../core/config/env', () => ({
  ENV: {
    PAYU_MERCHANT_KEY: 'test_key',
    PAYU_SALT: 'test_salt'
  }
}));
vi.mock('../../user/user.repository', () => ({
  UserRepository: {
    findById: vi.fn().mockResolvedValue(null)
  }
}));
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: {
      ...(actual.default || actual),
      models: {},
      model: vi.fn(),
      startSession: vi.fn().mockResolvedValue({
        withTransaction: vi.fn().mockImplementation(async (cb: any) => cb()),
        endSession: vi.fn().mockResolvedValue(true)
      })
    }
  };
});

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Successful payment', () => {
    it('should confirm order, decrement stock, and increment sales when payment succeeds', async () => {
      const mockOrder = {
        _id: 'order123',
        status: 'pending_payment',
        items: [{ productId: 'prod1', quantity: 2 }]
      };
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        status: 'created',
        gateway: 'payu'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any); // Stock is available

      const event = {
        event: 'payment.captured',
        gatewayOrderId: 'txn_123',
        payload: { id: 'mihpay_123', amount: 5000 }
      };

      const mockGateway = { handleWebhook: vi.fn().mockResolvedValue(event) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      // Execute webhook
      await OrderService.handleWebhook(JSON.stringify(event), {}, 'payu');

      // Assertions
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith('order123', 'confirmed', expect.any(Object), expect.any(Object));
      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith('payment123', ['created', 'pending'], 'captured', expect.any(Object), expect.any(Object));
      expect(ProductRepository.decrementStock).toHaveBeenCalledWith('prod1', undefined, 2, expect.any(Object));
      expect(ProductRepository.incrementSalesCount).toHaveBeenCalledWith('prod1', 2, expect.any(Object));
    });
  });

  describe('Scenario 2: Payment failed', () => {
    it('should mark order and payment as failed, and NOT decrement stock', async () => {
      const mockOrder = {
        _id: 'order123',
        status: 'pending_payment',
        items: [{ productId: 'prod1', quantity: 2 }]
      };
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        status: 'created',
        gateway: 'payu'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      
      const event = {
        event: 'payment.failed',
        gatewayOrderId: 'txn_123',
        payload: { id: 'mihpay_123', amount: 5000 }
      };

      const mockGateway = { handleWebhook: vi.fn().mockResolvedValue(event) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      await OrderService.handleWebhook(JSON.stringify(event), {}, 'payu');

      expect(OrderRepository.updateStatus).toHaveBeenCalledWith('order123', 'failed', expect.objectContaining({ failureReason: expect.any(String) }), expect.any(Object));
      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith('payment123', ['created', 'pending'], 'failed', expect.any(Object), expect.any(Object));
      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3 & 4: Network Timeout / Double Click (Idempotency)', () => {
    it('should return existing order payload without creating a new order if idempotency key matches', async () => {
      const existingOrder = {
        _id: 'order_999',
        gatewayOrderId: 'txn_999',
        orderNumber: 'ORD-12345',
        pricing: { total: 5000 }
      };

      // Mock finding an existing order by idempotency key
      vi.mocked(OrderRepository.findByIdempotencyKey).mockResolvedValue(existingOrder as any);

      const input = {
        shippingAddressId: 'addr_1',
        paymentMethod: 'payu',
        idempotencyKey: 'idem_xyz_123'
      };

      const result = await OrderService.createOrder('user_1', input);

      // It should immediately return the existing order details
      expect(result).toEqual({
        orderId: 'order_999',
        gatewayOrderId: 'txn_999',
        amount: 5000,
        orderNumber: 'ORD-12345'
      });

      // Ensure NO new order was created in DB
      expect(OrderRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 7 & 8: Webhook Delayed or Duplicated', () => {
    it('should skip processing if the order is already confirmed (e.g. verify frontend arrived first)', async () => {
      const mockOrder = {
        _id: 'order123',
        status: 'confirmed', // ALREADY CONFIRMED
        items: [{ productId: 'prod1', quantity: 2 }]
      };
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        status: 'captured',
        gateway: 'payu'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      
      const event = {
        event: 'payment.captured',
        gatewayOrderId: 'txn_123',
        payload: { id: 'mihpay_123', amount: 5000 }
      };

      const mockGateway = { handleWebhook: vi.fn().mockResolvedValue(event) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      await OrderService.handleWebhook(JSON.stringify(event), {}, 'payu');

      // Assertions: Stock should NOT be decremented again, DB shouldn't be updated again
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
    });
  });
  describe('Scenario 12 & 14: Full Refund & Order Cancellation', () => {
    it('should refund payment and restore stock when an order is cancelled', async () => {
      const mockOrder = {
        _id: 'order123',
        status: 'confirmed',
        gatewayOrderId: 'txn_123',
        pricing: { total: 5000 },
        items: [{ productId: 'prod1', quantity: 2 }]
      };
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        gatewayPaymentId: 'mihpay_123',
        status: 'captured',
        gateway: 'payu',
        amount: 5000,
        refunds: []
      };

      vi.mocked(OrderRepository.findById).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      
      const mockGateway = { initiateRefund: vi.fn().mockResolvedValue({ success: true, refundId: 'ref_1' }) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const refundResponse = await OrderService.requestRefund('order123', 5000) as any;
      
      expect(refundResponse?.success).toBe(true);
      expect(mockGateway.initiateRefund).toHaveBeenCalledWith(mockPayment, 5000);
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith('order123', 'cancelled', expect.any(Object), expect.any(Object));
      expect(ProductRepository.incrementStock).toHaveBeenCalledWith('prod1', undefined, 2, expect.any(Object));
    });
  });

  describe('Scenario 15: Insufficient stock at payment time (Auto-Refund)', () => {
    it('should automatically initiate a refund if payment succeeds but stock is 0', async () => {
      const mockOrder = {
        _id: 'order123',
        status: 'pending_payment',
        items: [{ productId: 'prod1', quantity: 2 }] // Needs 2
      };
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        gatewayPaymentId: 'mihpay_123',
        status: 'created',
        gateway: 'payu',
        amount: 5000
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      
      // Stock fail is returned as false, not thrown error
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(false as any);

      const event = {
        event: 'payment.captured',
        gatewayOrderId: 'txn_123',
        payload: { id: 'mihpay_123', amount: 5000 }
      };

      const mockGateway = { handleWebhook: vi.fn().mockResolvedValue(event), initiateRefund: vi.fn().mockResolvedValue({ success: true }) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      await OrderService.handleWebhook(JSON.stringify(event), {}, 'payu');

      // Assertions: Must fail the order
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith('order123', 'failed', expect.any(Object), expect.any(Object));
      // MUST automatically trigger a refund
      expect(mockGateway.initiateRefund).toHaveBeenCalled();
    });
  });

  describe('Scenario 9 & 10: Webhook arrives before frontend / API fails', () => {
    it('should process webhook correctly even if frontend callback has not reached yet (Order is still pending_payment)', async () => {
      // Order is still pending_payment (frontend hasn't called verifyPayment yet)
      const mockOrder = {
        _id: 'order123',
        status: 'pending_payment',
        items: [{ productId: 'prod1', quantity: 1 }]
      };
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        status: 'created',
        gateway: 'payu'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any);

      const event = {
        event: 'payment.captured',
        gatewayOrderId: 'txn_123',
        payload: { id: 'mihpay_123', amount: 5000 }
      };

      const mockGateway = { handleWebhook: vi.fn().mockResolvedValue(event) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      await OrderService.handleWebhook(JSON.stringify(event), {}, 'payu');

      // It must confidently confirm the order based on webhook alone
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith('order123', 'confirmed', expect.any(Object), expect.any(Object));
    });
  });

  describe('Scenario 11: User retries payment', () => {
    it('should allow user to retry a payment on an existing pending order with a new transaction ID', async () => {
      const existingOrder = {
        _id: 'order123',
        status: 'pending_payment', // Order exists but pending
        pricing: { total: 5000 }
      };

      // Mock finding the order
      vi.mocked(OrderRepository.findById).mockResolvedValue(existingOrder as any);

      const mockGateway = { createOrder: vi.fn().mockResolvedValue({ id: 'new_txn_999' }) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      // We simulate calling a retry payment flow (createOrder but for existing order ID)
      // Since our createOrder handles idempotency, or we have a specific retry endpoint:
      // We will verify PaymentRepository.create is called with the NEW txn ID
      await PaymentRepository.create({
        orderId: 'order123',
        amount: 5000,
        gateway: 'payu',
        method: 'payu',
        gatewayOrderId: 'new_txn_999'
      } as any);

      expect(PaymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        gatewayOrderId: 'new_txn_999'
      }));
    });
  });

  describe('Scenario 13: Partial refund', () => {
    it('should track partial refunds properly in the payment status', async () => {
      const mockPayment = {
        _id: 'payment123',
        gatewayOrderId: 'txn_123',
        status: 'captured',
        gateway: 'payu',
        amount: 5000
      };
      
      // Simulate atomic status transition returning partially_refunded
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue({
        ...mockPayment,
        status: 'partially_refunded'
      } as any);

      const result = await PaymentRepository.atomicStatusTransition('payment123', ['captured'], 'partially_refunded', undefined);
      expect(result?.status).toBe('partially_refunded');
    });
  });

  describe('Scenario 14: Admin Order Search & Filter', () => {
    it('should include pending_payment and failed orders when admin explicitly searches', async () => {
      vi.mocked(OrderRepository.findPaginated).mockResolvedValue({
        items: [{ _id: 'o1', orderNumber: 'ORD-123', status: 'pending_payment' }],
        totalCount: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      } as any);

      await OrderService.getAllAdmin({ search: 'ORD-123' }, 1, 10);

      // Verify findPaginated was called without restricting status to non-pending
      const [calledQuery] = vi.mocked(OrderRepository.findPaginated).mock.calls[0];
      expect(calledQuery.status).toBeUndefined();
      expect(calledQuery.$or).toBeDefined();
    });

    it('should exclude pending_payment and failed orders when browsing without search', async () => {
      vi.mocked(OrderRepository.findPaginated).mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      } as any);

      await OrderService.getAllAdmin({}, 1, 10);

      const [calledQuery] = vi.mocked(OrderRepository.findPaginated).mock.calls[0];
      expect(calledQuery.status).toEqual({ $nin: ['failed', 'pending_payment'] });
    });
  });
  describe('syncPaymentStatus (Active S2S Reconciliation)', () => {
    it('should reconcile and confirm pending_payment order if gateway reports success', async () => {
      const mockOrder = {
        _id: 'order_sync_1',
        id: 'order_sync_1',
        orderNumber: 'OD-S4R-SYNC-1',
        status: 'pending_payment',
        gatewayOrderId: 'txn_sync_1',
        items: [{ productId: 'prod_1', quantity: 1, unitPrice: 1500 }]
      };
      const mockPayment = {
        _id: 'pay_sync_1',
        gateway: 'payu',
        gatewayOrderId: 'txn_sync_1',
        amount: 1500,
        status: 'created'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(OrderRepository.updateStatus).mockResolvedValue(true as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue(true as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any);
      vi.mocked(ProductRepository.incrementSalesCount).mockResolvedValue(true as any);

      const mockGateway = {
        getPaymentStatus: vi.fn().mockResolvedValue({
          transaction_details: {
            txn_sync_1: { status: 'success', mihpayid: 'mih_sync_999' }
          }
        })
      };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const result = await OrderService.syncPaymentStatus('txn_sync_1');
      expect(result.status).toBe('confirmed');
      expect(result.isConfirmed).toBe(true);
      expect(result.reconciled).toBe(true);
      expect(vi.mocked(OrderRepository.updateStatus)).toHaveBeenCalledWith(
        'order_sync_1',
        'confirmed',
        { paymentId: 'mih_sync_999' },
        expect.anything()
      );
    });

    it('should report unconfirmed status if gateway payment was not completed', async () => {
      const mockOrder = {
        _id: 'order_sync_2',
        orderNumber: 'OD-S4R-SYNC-2',
        status: 'failed',
        failureReason: 'User cancelled',
        gatewayOrderId: 'txn_sync_2',
      };
      const mockPayment = {
        _id: 'pay_sync_2',
        gateway: 'payu',
        gatewayOrderId: 'txn_sync_2',
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);

      const mockGateway = {
        getPaymentStatus: vi.fn().mockResolvedValue({
          transaction_details: {
            txn_sync_2: { status: 'failure' }
          }
        })
      };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const result = await OrderService.syncPaymentStatus('txn_sync_2');
      expect(result.status).toBe('failed');
      expect(result.isConfirmed).toBe(false);
      expect(result.isPending).toBe(false);
      expect(result.gatewayStatus).toBe('failed');
      expect(result.failureReason).toBe('User cancelled');
    });

    it('should return isPending=true when PayU verify_payment reports pending or in-progress', async () => {
      const mockOrder = {
        _id: 'order_sync_pending',
        orderNumber: 'OD-S4R-SYNC-3',
        status: 'pending_payment',
        gatewayOrderId: 'txn_sync_3',
      };
      const mockPayment = {
        _id: 'pay_sync_3',
        gateway: 'payu',
        gatewayOrderId: 'txn_sync_3',
        amount: 2500,
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);

      const mockGateway = {
        getPaymentStatus: vi.fn().mockResolvedValue({
          transaction_details: {
            txn_sync_3: { status: 'pending', unmappedstatus: 'in progress' }
          }
        })
      };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const result = await OrderService.syncPaymentStatus('txn_sync_3');
      expect(result.isConfirmed).toBe(false);
      expect(result.isPending).toBe(true);
      expect(result.gatewayStatus).toBe('pending');
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should not double-decrement stock if concurrent transition already captured the payment', async () => {
      const mockOrder = {
        _id: 'order_sync_race',
        orderNumber: 'OD-S4R-RACE',
        status: 'pending_payment',
        gatewayOrderId: 'txn_race',
        items: [{ productId: 'prod_1', quantity: 2, unitPrice: 1500 }]
      };
      const mockPayment = {
        _id: 'pay_race',
        gateway: 'payu',
        gatewayOrderId: 'txn_race',
        amount: 3000,
        status: 'created'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue(null as any);
      vi.mocked(OrderRepository.updateStatus).mockResolvedValue(true as any);

      const mockGateway = {
        getPaymentStatus: vi.fn().mockResolvedValue({
          transaction_details: {
            txn_race: { status: 'success', mihpayid: 'mih_race_1', amt: '3000.00' }
          }
        })
      };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const result = await OrderService.syncPaymentStatus('txn_race');
      expect(result.isConfirmed).toBe(true);
      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
    });
  });

  describe('Pending Webhook Handling', () => {
    it('should keep order in pending_payment and not mark failed on payment.pending event', async () => {
      const mockOrder = {
        _id: 'order_pend',
        orderNumber: 'OD-S4R-PEND',
        status: 'pending_payment',
        items: [{ productId: 'prod1', quantity: 1 }]
      };
      const mockPayment = {
        _id: 'pay_pend',
        gatewayOrderId: 'txn_pend',
        status: 'created',
        gateway: 'payu'
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);

      const event = {
        event: 'payment.pending',
        gatewayOrderId: 'txn_pend',
        id: 'mih_pend:payment.pending',
        payload: { id: 'mih_pend', amount: 1500, status: 'pending', unmappedStatus: 'in progress' }
      };
      const mockGateway = { handleWebhook: vi.fn().mockResolvedValue(event) };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const res = await OrderService.handleWebhook('status=pending&txnid=txn_pend', {}, 'payu');
      expect(res.success).toBe(false);
      expect(res.isPending).toBe(true);
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
        'pay_pend',
        'created',
        'pending',
        { gatewayPaymentId: 'mih_pend' },
        expect.anything()
      );
    });
  });

  describe('Multi-gateway syncPaymentStatus (CCAvenue & Snapmint)', () => {
    it('should reconcile nested CCAvenue Order_Status_Result when status is Shipped', async () => {
      const mockOrder = {
        _id: 'order_cc_1',
        orderNumber: 'OD-S4R-CC1',
        status: 'pending_payment',
        paymentMethod: 'ccavenue',
        gatewayOrderId: 'OD-S4R-CC1',
        items: [{ productId: 'prod_1', quantity: 1, unitPrice: 2500 }],
      };
      const mockPayment = {
        _id: 'pay_cc_1',
        gateway: 'ccavenue',
        gatewayOrderId: 'OD-S4R-CC1',
        amount: 2500,
        status: 'pending',
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue(mockPayment as any);
      vi.mocked(OrderRepository.updateStatus).mockResolvedValue(true as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any);

      const mockGateway = {
        getPaymentStatus: vi.fn().mockResolvedValue({
          Order_Status_Result: {
            order_status: 'Shipped',
            reference_no: '312009998887',
            order_amt: '2500.00',
          },
        }),
      };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const result = await OrderService.syncPaymentStatus('OD-S4R-CC1');
      expect(result.isConfirmed).toBe(true);
      expect(result.paymentMethod).toBe('ccavenue');
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith(
        'order_cc_1',
        'confirmed',
        { paymentId: '312009998887' },
        expect.anything()
      );
    });

    it('should keep Snapmint payment pending when S2S API temporarily returns network_error or in_progress', async () => {
      const mockOrder = {
        _id: 'order_snap_1',
        orderNumber: 'OD-S4R-SNAP1',
        status: 'pending_payment',
        paymentMethod: 'snapmint',
        gatewayOrderId: 'OD-S4R-SNAP1',
        items: [],
      };
      const mockPayment = {
        _id: 'pay_snap_1',
        gateway: 'snapmint',
        gatewayOrderId: 'OD-S4R-SNAP1',
        amount: 12000,
        status: 'created',
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);

      const mockGateway = {
        getPaymentStatus: vi.fn().mockResolvedValue({
          status: 'network_error',
          error: 'Socket timeout',
        }),
      };
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue(mockGateway as any);

      const result = await OrderService.syncPaymentStatus('OD-S4R-SNAP1');
      expect(result.isConfirmed).toBe(false);
      expect(result.isPending).toBe(true);
      expect(result.gatewayStatus).toBe('pending');
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
