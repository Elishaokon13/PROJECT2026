// Idempotency service tests
// Tests request hash validation, response replay, and merchant scoping

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { IdempotencyService } from '../src/domain/idempotency/idempotency.js';

describe('Idempotency Service - Critical Tests', () => {
  let db: PrismaClient;
  let idempotencyService: IdempotencyService;
  const testMerchantId = 'test-merchant-id';

  beforeAll(async () => {
    db = new PrismaClient();
    idempotencyService = new IdempotencyService(db);

    // Clean up test data
    await db.idempotencyKey.deleteMany({
      where: {
        merchantId: testMerchantId,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.idempotencyKey.deleteMany({
      where: {
        merchantId: testMerchantId,
      },
    });
    await db.$disconnect();
  });

  describe('Request Hash Validation', () => {
    it('should accept duplicate request with same payload', async () => {
      const key = 'test-key-same-payload';
      const requestBody = { amount: '100.00', currency: 'USDC' };

      // First request
      const firstCheck = await idempotencyService.checkIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody,
      });

      expect(firstCheck.isDuplicate).toBe(false);

      // Store idempotency
      await idempotencyService.storeIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody,
      });

      // Complete with response
      await idempotencyService.completeIdempotency({
        merchantId: testMerchantId,
        key,
        statusCode: 201,
        responseBody: { id: 'payout-123' },
      });

      // Second request with same payload
      const secondCheck = await idempotencyService.checkIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody, // Same payload
      });

      expect(secondCheck.isDuplicate).toBe(true);
      expect(secondCheck.response?.statusCode).toBe(201);
      expect(secondCheck.response?.body).toEqual({ id: 'payout-123' });
    });

    it('should reject duplicate request with different payload', async () => {
      const key = 'test-key-different-payload';

      // First request
      await idempotencyService.storeIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody: { amount: '100.00', currency: 'USDC' },
      });

      await idempotencyService.completeIdempotency({
        merchantId: testMerchantId,
        key,
        statusCode: 201,
        responseBody: { id: 'payout-123' },
      });

      // Second request with different payload
      await expect(
        idempotencyService.checkIdempotency({
          merchantId: testMerchantId,
          key,
          requestMethod: 'POST',
          requestPath: '/api/v1/payouts',
          requestBody: { amount: '200.00', currency: 'USDC' }, // Different amount
        }),
      ).rejects.toThrow(/idempotency key.*different request payload/i);
    });
  });

  describe('Merchant Scoping', () => {
    it('should allow same key for different merchants', async () => {
      const key = 'shared-key';
      const merchant1 = 'merchant-1';
      const merchant2 = 'merchant-2';

      // Store for merchant 1
      await idempotencyService.storeIdempotency({
        merchantId: merchant1,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody: { amount: '100.00' },
      });

      await idempotencyService.completeIdempotency({
        merchantId: merchant1,
        key,
        statusCode: 201,
        responseBody: { id: 'payout-1' },
      });

      // Same key for merchant 2 should be allowed (new request)
      const check = await idempotencyService.checkIdempotency({
        merchantId: merchant2,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody: { amount: '100.00' },
      });

      expect(check.isDuplicate).toBe(false);
    });
  });

  describe('Response Replay', () => {
    it('should replay stored response for duplicate requests', async () => {
      const key = 'test-key-replay';
      const responseBody = {
        id: 'payout-456',
        status: 'pending',
        amount: '100.00',
      };

      // Store and complete
      await idempotencyService.storeIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody: { amount: '100.00' },
      });

      await idempotencyService.completeIdempotency({
        merchantId: testMerchantId,
        key,
        statusCode: 201,
        responseBody,
      });

      // Check should return stored response
      const result = await idempotencyService.checkIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody: { amount: '100.00' },
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.response?.statusCode).toBe(201);
      expect(result.response?.body).toEqual(responseBody);
    });
  });

  describe('Pending Request Handling', () => {
    it('should reject request if previous request is still pending', async () => {
      const key = 'test-key-pending';

      // Store as pending
      await idempotencyService.storeIdempotency({
        merchantId: testMerchantId,
        key,
        requestMethod: 'POST',
        requestPath: '/api/v1/payouts',
        requestBody: { amount: '100.00' },
      });

      // Try to use same key again (should fail - request in progress)
      await expect(
        idempotencyService.checkIdempotency({
          merchantId: testMerchantId,
          key,
          requestMethod: 'POST',
          requestPath: '/api/v1/payouts',
          requestBody: { amount: '100.00' },
        }),
      ).rejects.toThrow(/already in progress/i);
    });
  });
});

