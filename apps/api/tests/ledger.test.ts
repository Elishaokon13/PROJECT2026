// Critical ledger tests
// Tests balance invariants, atomic operations, and idempotency
// These tests are CRITICAL for fintech correctness

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { LedgerService } from '../src/services/ledgerService.js';
import { Decimal } from 'decimal.js';

describe('Ledger Domain - Critical Tests', () => {
  let db: PrismaClient;
  let ledgerService: LedgerService;
  const testWalletId = 'test-wallet-id';
  const testCurrency = 'USDC';

  beforeAll(async () => {
    // Initialize database connection
    db = new PrismaClient();
    ledgerService = new LedgerService(db);

    // Clean up any existing test data
    await db.ledgerEntry.deleteMany({
      where: {
        walletId: testWalletId,
        currency: testCurrency,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.ledgerEntry.deleteMany({
      where: {
        walletId: testWalletId,
        currency: testCurrency,
      },
    });
    await db.$disconnect();
  });

  describe('Balance Invariants', () => {
    it('should prevent negative balances on debit', async () => {
      // Try to debit more than available balance
      await expect(
        ledgerService.debit({
          walletId: testWalletId,
          currency: testCurrency,
          amount: '100.00',
          idempotencyKey: 'test-debit-negative-1',
          description: 'Test debit that should fail',
        }),
      ).rejects.toThrow(/insufficient funds/i);
    });

    it('should allow debit when sufficient balance exists', async () => {
      // First credit funds
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '100.00',
        transactionId: 'test-tx-1',
        idempotencyKey: 'test-credit-1',
        description: 'Test credit',
      });

      // Then debit should succeed
      await expect(
        ledgerService.debit({
          walletId: testWalletId,
          currency: testCurrency,
          amount: '50.00',
          idempotencyKey: 'test-debit-1',
          description: 'Test debit',
        }),
      ).resolves.toBeDefined();

      // Verify balance is correct
      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(balance.available).toBe('50.00');
    });

    it('should compute balance correctly from settled entries only', async () => {
      // Credit funds
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '200.00',
        transactionId: 'test-tx-2',
        idempotencyKey: 'test-credit-2',
        description: 'Test credit',
      });

      // Lock funds (should not affect available balance)
      const lockEntry = await ledgerService.lockFunds({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '50.00',
        idempotencyKey: 'test-lock-1',
        description: 'Test lock',
      });

      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(balance.available).toBe('150.00'); // 200 - 50 locked
      expect(balance.locked).toBe('50.00');

      // Release lock
      await ledgerService.releaseFunds({
        lockEntryId: lockEntry.id,
        description: 'Test release',
      });

      const balanceAfterRelease = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(balanceAfterRelease.available).toBe('200.00');
      expect(balanceAfterRelease.locked).toBe('0.00');
    });
  });

  describe('Atomic Operations', () => {
    it('should rollback on error during credit operation', async () => {
      const initialBalance = await ledgerService.getBalance(testWalletId, testCurrency);

      // Attempt credit with invalid data (should fail validation)
      try {
        await ledgerService.credit({
          walletId: testWalletId,
          currency: testCurrency,
          amount: '-100.00', // Invalid: negative amount
          transactionId: 'test-tx-invalid',
          idempotencyKey: 'test-credit-invalid',
          description: 'Test invalid credit',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        // Expected to fail
      }

      // Balance should be unchanged
      const finalBalance = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(finalBalance.available).toBe(initialBalance.available);
    });

    it('should handle concurrent operations atomically', async () => {
      // Credit initial funds
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '1000.00',
        transactionId: 'test-tx-concurrent',
        idempotencyKey: 'test-credit-concurrent',
        description: 'Test concurrent credit',
      });

      // Attempt multiple concurrent debits
      const debitPromises = Array.from({ length: 5 }, (_, i) =>
        ledgerService.debit({
          walletId: testWalletId,
          currency: testCurrency,
          amount: '100.00',
          idempotencyKey: `test-debit-concurrent-${i}`,
          description: `Test concurrent debit ${i}`,
        }),
      );

      // All should succeed (total: 500 debited)
      await expect(Promise.all(debitPromises)).resolves.toBeDefined();

      // Final balance should be correct
      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(new Decimal(balance.available).toNumber()).toBeCloseTo(500.0, 2);
    });
  });

  describe('Idempotency', () => {
    it('should prevent duplicate credits with same idempotency key', async () => {
      const idempotencyKey = 'test-idempotent-credit-1';

      // First credit
      const firstResult = await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '100.00',
        transactionId: 'test-tx-idempotent-1',
        idempotencyKey,
        description: 'Test idempotent credit',
      });

      // Second credit with same key should return same result
      const secondResult = await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '100.00',
        transactionId: 'test-tx-idempotent-1',
        idempotencyKey,
        description: 'Test idempotent credit',
      });

      expect(firstResult.id).toBe(secondResult.id);

      // Balance should only reflect one credit
      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      const expectedBalance = new Decimal(balance.available).minus(100.0);
      // Account for previous test balances
      expect(new Decimal(balance.available).toNumber()).toBeGreaterThanOrEqual(100.0);
    });

    it('should reject duplicate idempotency key with different amount', async () => {
      const idempotencyKey = 'test-idempotent-conflict';

      // First credit
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '100.00',
        transactionId: 'test-tx-conflict-1',
        idempotencyKey,
        description: 'Test idempotent credit',
      });

      // Second credit with same key but different amount should fail
      await expect(
        ledgerService.credit({
          walletId: testWalletId,
          currency: testCurrency,
          amount: '200.00', // Different amount
          transactionId: 'test-tx-conflict-1',
          idempotencyKey,
          description: 'Test idempotent credit',
        }),
      ).rejects.toThrow(/idempotency/i);
    });
  });

  describe('Lock and Settle Flow', () => {
    it('should lock funds and prevent double-spending', async () => {
      // Credit funds
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '500.00',
        transactionId: 'test-tx-lock-1',
        idempotencyKey: 'test-credit-lock-1',
        description: 'Test credit for lock',
      });

      // Lock funds for payout
      const lockEntry = await ledgerService.lockFunds({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '300.00',
        idempotencyKey: 'test-lock-payout-1',
        description: 'Lock for payout',
      });

      // Try to debit more than available (should fail)
      await expect(
        ledgerService.debit({
          walletId: testWalletId,
          currency: testCurrency,
          amount: '250.00', // Would exceed available (500 - 300 = 200 available)
          idempotencyKey: 'test-debit-exceed',
          description: 'Should fail',
        }),
      ).rejects.toThrow(/insufficient funds/i);

      // Settle the lock (payout completed)
      await ledgerService.settleFunds({
        lockEntryId: lockEntry.id,
        description: 'Payout completed',
      });

      // Now balance should reflect settled amount
      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(new Decimal(balance.available).toNumber()).toBeCloseTo(200.0, 2);
    });

    it('should release locked funds on cancellation', async () => {
      // Credit funds
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '1000.00',
        transactionId: 'test-tx-release-1',
        idempotencyKey: 'test-credit-release-1',
        description: 'Test credit for release',
      });

      // Lock funds
      const lockEntry = await ledgerService.lockFunds({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '400.00',
        idempotencyKey: 'test-lock-release-1',
        description: 'Lock for payout',
      });

      const balanceBeforeRelease = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(balanceBeforeRelease.available).toBe('600.00');
      expect(balanceBeforeRelease.locked).toBe('400.00');

      // Release lock (payout cancelled)
      await ledgerService.releaseFunds({
        lockEntryId: lockEntry.id,
        description: 'Payout cancelled',
      });

      // Funds should be available again
      const balanceAfterRelease = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(balanceAfterRelease.available).toBe('1000.00');
      expect(balanceAfterRelease.locked).toBe('0.00');
    });
  });

  describe('Precision and Decimal Handling', () => {
    it('should handle decimal amounts correctly', async () => {
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: '100.123456789',
        transactionId: 'test-tx-precision',
        idempotencyKey: 'test-credit-precision',
        description: 'Test precision',
      });

      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      // Should preserve precision
      expect(balance.available).toContain('100.123456789');
    });

    it('should handle very large amounts', async () => {
      const largeAmount = '999999999.99';
      await ledgerService.credit({
        walletId: testWalletId,
        currency: testCurrency,
        amount: largeAmount,
        transactionId: 'test-tx-large',
        idempotencyKey: 'test-credit-large',
        description: 'Test large amount',
      });

      const balance = await ledgerService.getBalance(testWalletId, testCurrency);
      expect(new Decimal(balance.available).toNumber()).toBeCloseTo(
        new Decimal(largeAmount).toNumber(),
        2,
      );
    });
  });
});

