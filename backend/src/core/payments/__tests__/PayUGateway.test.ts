import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { PayUGateway } from '../PayUGateway';
import { AppError } from '../../errors/AppError';

// Mock the environment variables
vi.mock('../../config/env', () => ({
  ENV: {
    PAYU_MERCHANT_KEY: 'test_key',
    PAYU_SALT: 'test_salt',
    PAYU_MODE: 'live',
    NEXT_PUBLIC_API_URL: 'http://localhost:3000'
  }
}));

describe('PayUGateway - Edge Cases & Security (Step 12)', () => {
  let gateway: PayUGateway;

  beforeEach(() => {
    gateway = new PayUGateway();
    vi.clearAllMocks();
  });

  describe('Amount Tampering & Signature Spoofing', () => {
    it('should reject payment if the signature hash is invalid (Spoofing Attack)', async () => {
      const mockPayment: any = { amount: 5000 };
      const verificationData = {
        status: 'success',
        txnid: 'txn_123',
        amount: '5000.00',
        productinfo: 'Helmet',
        firstname: 'Test',
        email: 'test@example.com',
        hash: 'invalid_fake_hash', // Hacker sends a fake hash
        mihpayid: 'payu_999'
      };

      const result = await gateway.verifyPayment(mockPayment, verificationData);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid PayU signature');
    });

    it('should reject payment if the paid amount is less than the database amount (Amount Tampering)', async () => {
      const dbPaymentAmount = 50000; // Original amount Rs 50,000
      const mockPayment: any = { amount: dbPaymentAmount };
      
      // Hacker manipulated frontend to charge Rs 10 instead
      const verificationData = {
        status: 'success',
        txnid: 'txn_123',
        amount: '10.00', 
        productinfo: 'Helmet',
        firstname: 'Test',
        email: 'test@example.com',
        hash: '', // We will generate the CORRECT hash for Rs 10 to simulate a real PayU response for the tampered amount
        mihpayid: 'payu_999'
      };

      // Generate valid hash for the tampered amount
      const salt = 'test_salt';
      const key = 'test_key';
      const hashString = `${salt}|success|||||||||||test@example.com|Test|Helmet|10.00|txn_123|${key}`;
      verificationData.hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const result = await gateway.verifyPayment(mockPayment, verificationData);
      
      // The hash is technically valid, BUT our backend should catch the amount mismatch!
      expect(result.success).toBe(false);
      expect(result.message).toBe('Amount mismatch detected');
    });

    it('should accept payment if signature is valid and amount matches exactly', async () => {
      const mockPayment: any = { amount: 5000 };
      
      const verificationData = {
        status: 'success',
        txnid: 'txn_123',
        amount: '5000', 
        productinfo: 'Helmet',
        firstname: 'Test',
        email: 'test@example.com',
        hash: '', 
        mihpayid: 'payu_999'
      };

      const hashString = `test_salt|success|||||||||||test@example.com|Test|Helmet|5000|txn_123|test_key`;
      verificationData.hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const result = await gateway.verifyPayment(mockPayment, verificationData);
      
      expect(result.success).toBe(true);
      expect(result.gatewayPaymentId).toBe('payu_999');
    });

    it('should verify valid webhook signature and emit payment.captured event', async () => {
      const salt = 'test_salt';
      const key = 'test_key';
      const hashString = `${salt}|success|||||||||||test@example.com|Test|Helmet|5000|txn_123|${key}`;
      const validHash = crypto.createHash("sha512").update(hashString).digest("hex");

      const rawBody = `status=success&txnid=txn_123&amount=5000&productinfo=Helmet&firstname=Test&email=test@example.com&hash=${validHash}&mihpayid=mih_999&key=test_key`;
      
      const result = await gateway.handleWebhook({}, rawBody);
      expect(result.event).toBe('payment.captured');
      expect(result.gatewayOrderId).toBe('txn_123');
      expect(result.payload.id).toBe('mih_999');
      expect(result.payload.amount).toBe(5000);
    });

    it('should throw AppError on invalid webhook signature in live mode', async () => {
      const rawBody = `status=success&txnid=txn_123&amount=5000&productinfo=Helmet&firstname=Test&email=test@example.com&hash=fake_invalid_hash&mihpayid=mih_999&key=test_key`;
      
      await expect(gateway.handleWebhook({}, rawBody)).rejects.toThrow('Invalid PayU webhook signature');
    });

    it('should map pending or in-progress PayU responses to payment.pending with distinct deduplication ID', async () => {
      const salt = 'test_salt';
      const key = 'test_key';
      const hashString = `${salt}|pending|||||||||||test@example.com|Test|Helmet|5000|txn_pending|${key}`;
      const validHash = crypto.createHash("sha512").update(hashString).digest("hex");

      const rawBody = `status=pending&unmappedstatus=in+progress&txnid=txn_pending&amount=5000&productinfo=Helmet&firstname=Test&email=test@example.com&hash=${validHash}&mihpayid=mih_pending_1&key=test_key`;

      const pendingResult = await gateway.handleWebhook({}, rawBody);
      expect(pendingResult.event).toBe('payment.pending');
      expect(pendingResult.gatewayOrderId).toBe('txn_pending');
      expect(pendingResult.id).toBe('mih_pending_1:payment.pending');

      const capHashString = `${salt}|success|||||||||||test@example.com|Test|Helmet|5000|txn_pending|${key}`;
      const capHash = crypto.createHash("sha512").update(capHashString).digest("hex");
      const capBody = JSON.stringify({
        status: 'success',
        txnid: 'txn_pending',
        amount: '5000',
        productinfo: 'Helmet',
        firstname: 'Test',
        email: 'test@example.com',
        hash: capHash,
        mihpayid: 'mih_pending_1',
        key: 'test_key',
      });

      const capturedResult = await gateway.handleWebhook({}, capBody);
      expect(capturedResult.event).toBe('payment.captured');
      expect(capturedResult.id).toBe('mih_pending_1');
      expect(capturedResult.id).not.toBe(pendingResult.id);
    });

    it('should include surl, furl, and curl in PayU createOrder payload', async () => {
      const order: any = {
        orderNumber: 'OD-S4R-1001',
        guestEmail: 'rider@store4riders.com',
        shippingAddress: { fullName: 'Vikram Kumar', phone: '9876543210' },
      };

      const res = await gateway.createOrder(order, 2499);
      expect(res.gatewayResponse.surl).toBe('http://localhost:3000/api/v1/orders/webhook/payu/success');
      expect(res.gatewayResponse.furl).toBe('http://localhost:3000/api/v1/orders/webhook/payu/failure');
      expect(res.gatewayResponse.curl).toBe('http://localhost:3000/api/v1/orders/webhook/payu/cancel');
      expect(res.gatewayResponse.amount).toBe('2499.00');
    });

    it('should reject webhooks with mismatched merchant key in live mode (key-spoofing defense)', async () => {
      const attackerKey = 'attacker_key';
      const salt = 'test_salt';
      const hashString = `${salt}|success|||||||||||a@b.com|Hack|Helmet|1.00|txn_spoof|${attackerKey}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');

      const rawBody = `status=success&txnid=txn_spoof&amount=1.00&productinfo=Helmet&firstname=Hack&email=a@b.com&hash=${hash}&mihpayid=mih_spoof&key=${attackerKey}`;
      await expect(gateway.handleWebhook({}, rawBody)).rejects.toThrow('Invalid PayU webhook signature');
    });

    it('should validate reverse hash when additionalCharges convenience fee is included', async () => {
      const salt = 'test_salt';
      const key = 'test_key';
      const additionalCharges = '50.00';
      const hashString = `${additionalCharges}|${salt}|success|||||||||||a@b.com|User|Helmet|1000.00|txn_fee|${key}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex').toUpperCase();

      const rawBody = `status=success&txnid=txn_fee&amount=1000.00&additionalCharges=${additionalCharges}&productinfo=Helmet&firstname=User&email=a@b.com&hash=${hash}&mihpayid=mih_fee&key=${key}`;
      const res = await gateway.handleWebhook({}, rawBody);

      expect(res.event).toBe('payment.captured');
      expect(res.payload.id).toBe('mih_fee');
    });

    it('should flag userCancelled PayU webhook with isCancelled=true', async () => {
      const salt = 'test_salt';
      const key = 'test_key';
      const hashString = `${salt}|failure|||||||||||a@b.com|User|Helmet|1000.00|txn_can|${key}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');

      const rawBody = `status=failure&unmappedstatus=userCancelled&txnid=txn_can&amount=1000.00&productinfo=Helmet&firstname=User&email=a@b.com&hash=${hash}&mihpayid=mih_can&key=${key}`;
      const res = await gateway.handleWebhook({}, rawBody);

      expect(res.event).toBe('payment.failed');
      expect(res.payload.isCancelled).toBe(true);
      expect(res.id).toBe('mih_can:payment.failed');
    });

    it('should throw 400 AppError for malformed JSON webhook body', async () => {
      await expect(gateway.handleWebhook({}, '{not-valid-json')).rejects.toThrow('Malformed PayU webhook payload');
    });

    it('should wrap getPaymentStatus network failures cleanly as AppError', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
      await expect(gateway.getPaymentStatus('txn_timeout')).rejects.toThrow('Failed to fetch PayU payment status');
      fetchSpy.mockRestore();
    });

    it('should emit refund.processed for PayU refund webhook notifications with valid hash', async () => {
      const salt = 'test_salt';
      const key = 'test_key';
      const hashString = `${salt}|success|||||||||||a@b.com|User|Helmet|1500.00|txn_ref1|${key}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');

      const rawBody = `action=refund&status=success&txnid=txn_ref1&amount=1500.00&productinfo=Helmet&firstname=User&email=a@b.com&hash=${hash}&mihpayid=mih_ref1&bank_arn=ARN9988&key=${key}`;
      const res = await gateway.handleWebhook({}, rawBody);

      expect(res.event).toBe('refund.processed');
      expect(res.gatewayOrderId).toBe('txn_ref1');
      expect(res.payload.bankArn).toBe('ARN9988');
      expect(res.id).toContain('refund:');
    });

    it('should emit payment.disputed for PayU chargeback/dispute webhooks', async () => {
      const rawBody = JSON.stringify({
        event: 'dispute',
        cb_id: 987654,
        txn_id: 'txn_cb_1',
        cb_status: 'Bank Comm Sent',
        cb_amount: '2499.00',
        reason_code: 'Services Not Rendered',
        due_date: '2026-12-10',
      });

      const res = await gateway.handleWebhook({}, rawBody);
      expect(res.event).toBe('payment.disputed');
      expect(res.gatewayOrderId).toBe('txn_cb_1');
      expect(res.id).toBe('dispute:987654:bank_comm_sent');
      expect(res.payload.dueDate).toBe('2026-12-10');
    });
  });
});
