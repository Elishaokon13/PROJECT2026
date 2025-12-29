// Payout service - orchestrates payout creation with state machine
// Integrates ledger, idempotency, and state machine at domain level
// CRITICAL: External provider calls must not happen without locked funds

import type { FastifyInstance } from 'fastify';
import { LedgerService } from './ledger-service.js';
import { PayoutStateMachine } from '../domain/payouts/index.js';
import type {
  CheckIdempotencyParams,
  StoreIdempotencyParams,
  CompleteIdempotencyParams,
} from '../domain/idempotency/types.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { Currency, MoneyAmount } from '../types/index.js';
import type { PayoutStatus } from '../domain/payouts/types.js';

export interface CreatePayoutParams {
  merchantId: string;
  idempotencyKey: string;
  walletId: string;
  amount: MoneyAmount;
  currency: Currency;
  recipientAccount: string;
  recipientName: string;
  recipientBankCode?: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutResult {
  id: string;
  walletId: string;
  amount: MoneyAmount;
  currency: Currency;
  status: PayoutStatus;
  idempotencyKey: string;
  lockEntryId: string | null;
  providerPayoutId: string | null;
  createdAt: Date;
}

export class PayoutService {
  private stateMachine: PayoutStateMachine;

  constructor(
    private readonly db: FastifyInstance['db'],
    private readonly ledgerService: LedgerService,
    private readonly idempotencyService: FastifyInstance['idempotencyService'],
  ) {
    this.stateMachine = new PayoutStateMachine(db);
  }

  /**
   * Create a payout with idempotency handling at domain level
   * Flow:
   * 1. Check idempotency (returns stored response if duplicate)
   * 2. Store idempotency key (if new request)
   * 3. Lock funds via ledger
   * 4. Create payout record
   * 5. Call off-ramp adapter (async)
   * 6. Complete idempotency with response
   */
  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    // Step 1: Check idempotency at domain level
    const idempotencyCheck = await this.idempotencyService.checkIdempotency<PayoutResult>({
      merchantId: params.merchantId,
      key: params.idempotencyKey,
      requestMethod: 'POST',
      requestPath: '/api/v1/payouts',
      requestBody: {
        walletId: params.walletId,
        amount: params.amount,
        currency: params.currency,
        recipientAccount: params.recipientAccount,
        recipientName: params.recipientName,
        recipientBankCode: params.recipientBankCode,
        metadata: params.metadata,
      },
    });

    // If duplicate request with same payload, return stored response
    if (idempotencyCheck.isDuplicate && idempotencyCheck.response) {
      return idempotencyCheck.response.body;
    }

    // Step 2: Store idempotency key for new request
    await this.idempotencyService.storeIdempotency({
      merchantId: params.merchantId,
      key: params.idempotencyKey,
      requestMethod: 'POST',
      requestPath: '/api/v1/payouts',
      requestBody: {
        walletId: params.walletId,
        amount: params.amount,
        currency: params.currency,
        recipientAccount: params.recipientAccount,
        recipientName: params.recipientName,
        recipientBankCode: params.recipientBankCode,
        metadata: params.metadata,
      },
    });

    try {
      // Step 3: Verify wallet exists and belongs to merchant
      const wallet = await this.db.wallet.findFirst({
        where: {
          id: params.walletId,
          merchantId: params.merchantId,
          active: true,
        },
      });

      if (!wallet) {
        throw new NotFoundError('Wallet', params.walletId);
      }

      // Step 4: Lock funds via ledger (atomic operation)
      const lockEntry = await this.ledgerService.lockFunds({
        walletId: params.walletId,
        currency: params.currency,
        amount: params.amount,
        idempotencyKey: params.idempotencyKey,
        description: `Payout to ${params.recipientName}`,
        metadata: {
          payoutId: 'pending', // Will be updated after payout creation
          recipientAccount: params.recipientAccount,
        },
      });

      // Step 5: Create payout record
      const payout = await this.db.payout.create({
        data: {
          walletId: params.walletId,
          amount: params.amount,
          currency: params.currency,
          recipientAccount: params.recipientAccount,
          recipientName: params.recipientName,
          recipientBankCode: params.recipientBankCode ?? undefined,
          status: 'PENDING',
          idempotencyKey: params.idempotencyKey,
          lockEntryId: lockEntry.id,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        },
      });

      // Step 6: TODO - Call off-ramp adapter asynchronously
      // This would trigger the actual payout to Zerocard
      // For now, we'll mark it as pending

      const result: PayoutResult = {
        id: payout.id,
        walletId: payout.walletId,
        amount: payout.amount,
        currency: payout.currency as Currency,
        status: payout.status as PayoutResult['status'],
        idempotencyKey: payout.idempotencyKey,
        lockEntryId: lockEntry.id,
        createdAt: payout.createdAt,
      };

      // Step 7: Complete idempotency with response
      await this.idempotencyService.completeIdempotency({
        merchantId: params.merchantId,
        key: params.idempotencyKey,
        statusCode: 201,
        responseBody: result,
      });

      return result;
    } catch (error) {
      // Mark idempotency as failed to allow retry
      await this.idempotencyService.failIdempotency(params.merchantId, params.idempotencyKey);
      throw error;
    }
  }

  /**
   * Get payout by ID
   */
  async getPayout(merchantId: string, payoutId: string): Promise<PayoutResult | null> {
    const payout = await this.db.payout.findFirst({
      where: {
        id: payoutId,
        wallet: {
          merchantId,
        },
      },
    });

    if (!payout) {
      return null;
    }

    return {
      id: payout.id,
      walletId: payout.walletId,
      amount: payout.amount,
      currency: payout.currency as Currency,
      status: payout.status as PayoutResult['status'],
      idempotencyKey: payout.idempotencyKey,
      lockEntryId: payout.lockEntryId ?? '',
      createdAt: payout.createdAt,
    };
  }
}

// Fastify plugin to inject payout service
export async function payoutServicePlugin(fastify: FastifyInstance): Promise<void> {
  const payoutService = new PayoutService(
    fastify.db,
    fastify.ledgerService,
    fastify.idempotencyService,
  );
  fastify.decorate('payoutService', payoutService);
}

declare module 'fastify' {
  interface FastifyInstance {
    payoutService: PayoutService;
  }
}

