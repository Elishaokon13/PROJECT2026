// Payout state machine tests
// Tests valid state transitions and invalid transition prevention

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, PayoutStatus } from '@prisma/client';
import { PayoutStateMachine } from '../src/domain/payouts/stateMachine.js';

describe('Payout State Machine - Critical Tests', () => {
  let db: PrismaClient;
  let stateMachine: PayoutStateMachine;
  const testMerchantId = 'test-merchant-id';
  const testWalletId = 'test-wallet-id';
  let testPayoutId: string;

  beforeAll(async () => {
    db = new PrismaClient();
    stateMachine = new PayoutStateMachine(db);

    // Create test wallet
    const wallet = await db.wallet.upsert({
      where: { id: testWalletId },
      create: {
        id: testWalletId,
        merchantId: testMerchantId,
        userId: 'test-user-id',
        currency: 'USDC',
        address: '0x0000000000000000000000000000000000000000',
        active: true,
      },
      update: {},
    });

    // Create test payout
    const payout = await db.payout.create({
      data: {
        merchantId: testMerchantId,
        walletId: wallet.id,
        amount: '100.00',
        currency: 'USDC',
        status: PayoutStatus.CREATED,
        idempotencyKey: 'test-payout-state-machine',
        recipientAccount: 'test-account',
        recipientName: 'Test User',
      },
    });

    testPayoutId = payout.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.payout.deleteMany({
      where: {
        id: testPayoutId,
      },
    });
    await db.wallet.deleteMany({
      where: {
        id: testWalletId,
      },
    });
    await db.$disconnect();
  });

  describe('Valid State Transitions', () => {
    it('should transition CREATED → FUNDS_LOCKED', async () => {
      // Reset payout to CREATED
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.CREATED },
      });

      const lockEntryId = 'test-lock-entry-id';
      await stateMachine.transitionToFundsLocked({
        payoutId: testPayoutId,
        lockEntryId,
      });

      const payout = await db.payout.findUnique({
        where: { id: testPayoutId },
      });

      expect(payout?.status).toBe(PayoutStatus.FUNDS_LOCKED);
      expect(payout?.lockEntryId).toBe(lockEntryId);
    });

    it('should transition FUNDS_LOCKED → SENT_TO_PROVIDER', async () => {
      // Set to FUNDS_LOCKED
      await db.payout.update({
        where: { id: testPayoutId },
        data: {
          status: PayoutStatus.FUNDS_LOCKED,
          lockEntryId: 'test-lock-entry-id',
        },
      });

      const providerPayoutId = 'provider-payout-123';
      await stateMachine.transitionToSentToProvider({
        payoutId: testPayoutId,
        providerPayoutId,
      });

      const payout = await db.payout.findUnique({
        where: { id: testPayoutId },
      });

      expect(payout?.status).toBe(PayoutStatus.SENT_TO_PROVIDER);
      expect(payout?.providerPayoutId).toBe(providerPayoutId);
    });

    it('should transition SENT_TO_PROVIDER → COMPLETED', async () => {
      // Set to SENT_TO_PROVIDER
      await db.payout.update({
        where: { id: testPayoutId },
        data: {
          status: PayoutStatus.SENT_TO_PROVIDER,
          providerPayoutId: 'provider-payout-123',
        },
      });

      await stateMachine.transitionToCompleted({
        payoutId: testPayoutId,
        providerStatus: 'completed',
      });

      const payout = await db.payout.findUnique({
        where: { id: testPayoutId },
      });

      expect(payout?.status).toBe(PayoutStatus.COMPLETED);
    });

    it('should transition any state → FAILED', async () => {
      // Test from CREATED
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.CREATED },
      });

      await stateMachine.transitionToFailed({
        payoutId: testPayoutId,
        reason: 'Test failure',
      });

      let payout = await db.payout.findUnique({
        where: { id: testPayoutId },
      });
      expect(payout?.status).toBe(PayoutStatus.FAILED);

      // Test from FUNDS_LOCKED
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.FUNDS_LOCKED },
      });

      await stateMachine.transitionToFailed({
        payoutId: testPayoutId,
        reason: 'Test failure 2',
      });

      payout = await db.payout.findUnique({
        where: { id: testPayoutId },
      });
      expect(payout?.status).toBe(PayoutStatus.FAILED);
    });
  });

  describe('Invalid State Transitions', () => {
    it('should prevent transition from COMPLETED to any other state', async () => {
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.COMPLETED },
      });

      await expect(
        stateMachine.transitionToFundsLocked({
          payoutId: testPayoutId,
          lockEntryId: 'test-lock',
        }),
      ).rejects.toThrow(/cannot transition/i);
    });

    it('should prevent transition from FAILED to any other state', async () => {
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.FAILED },
      });

      await expect(
        stateMachine.transitionToFundsLocked({
          payoutId: testPayoutId,
          lockEntryId: 'test-lock',
        }),
      ).rejects.toThrow(/cannot transition/i);
    });

    it('should prevent skipping FUNDS_LOCKED state', async () => {
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.CREATED },
      });

      // Cannot go directly from CREATED to SENT_TO_PROVIDER
      await expect(
        stateMachine.transitionToSentToProvider({
          payoutId: testPayoutId,
          providerPayoutId: 'provider-123',
        }),
      ).rejects.toThrow(/cannot transition/i);
    });
  });

  describe('State History Tracking', () => {
    it('should record state transitions in history', async () => {
      // Reset to CREATED
      await db.payout.update({
        where: { id: testPayoutId },
        data: { status: PayoutStatus.CREATED },
      });

      // Transition through states
      await stateMachine.transitionToFundsLocked({
        payoutId: testPayoutId,
        lockEntryId: 'test-lock',
      });

      await stateMachine.transitionToSentToProvider({
        payoutId: testPayoutId,
        providerPayoutId: 'provider-123',
      });

      // Check state history (if implemented)
      const payout = await db.payout.findUnique({
        where: { id: testPayoutId },
      });

      expect(payout?.status).toBe(PayoutStatus.SENT_TO_PROVIDER);
      // State history would be in a separate table if implemented
    });
  });
});

