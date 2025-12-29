// Payout service - orchestrates payout creation with state machine
// Integrates ledger, idempotency, and state machine at domain level
// CRITICAL: External provider calls must not happen without locked funds

import type { FastifyInstance } from 'fastify';
import { LedgerService } from './ledgerService.js';
import { PayoutStateMachine } from '../domain/payouts/index.js';
import { ZerocardOfframpAdapter } from '../adapters/offramp/index.js';
import { ProviderError } from '../errors/index.js';
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
  private offrampAdapter: ZerocardOfframpAdapter;

  constructor(
    private readonly db: FastifyInstance['db'],
    private readonly ledgerService: LedgerService,
    private readonly idempotencyService: FastifyInstance['idempotencyService'],
    private readonly webhookService?: FastifyInstance['webhookService'],
  ) {
    this.stateMachine = new PayoutStateMachine(db);
    this.offrampAdapter = new ZerocardOfframpAdapter();
  }

  /**
   * Create a payout with state machine orchestration
   * Flow:
   * 1. Check idempotency (returns stored response if duplicate)
   * 2. Store idempotency key (if new request)
   * 3. Create payout record (status: CREATED)
   * 4. Lock funds via ledger (atomic)
   * 5. Transition to FUNDS_LOCKED
   * 6. Call off-ramp adapter (retry-safe)
   * 7. Transition to SENT_TO_PROVIDER
   * 8. Complete idempotency with response
   * 
   * CRITICAL: External provider calls only happen after funds are locked
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

      // Step 4: Create payout record (status: CREATED)
      const payout = await this.db.payout.create({
        data: {
          walletId: params.walletId,
          amount: params.amount,
          currency: params.currency,
          recipientAccount: params.recipientAccount,
          recipientName: params.recipientName,
          recipientBankCode: params.recipientBankCode ?? undefined,
          status: 'CREATED',
          idempotencyKey: params.idempotencyKey,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        },
      });

      // Step 5: Lock funds via ledger (atomic operation)
      // CRITICAL: Funds must be locked before provider call
      const lockEntry = await this.ledgerService.lockFunds({
        walletId: params.walletId,
        currency: params.currency,
        amount: params.amount,
        idempotencyKey: params.idempotencyKey,
        description: `Payout to ${params.recipientName}`,
        metadata: {
          payoutId: payout.id,
          recipientAccount: params.recipientAccount,
        },
      });

      // Step 6: Transition to FUNDS_LOCKED
      await this.stateMachine.transitionToFundsLocked({
        payoutId: payout.id,
        lockEntryId: lockEntry.id,
      });

      // Step 7: Call off-ramp adapter (retry-safe)
      // This is where we'd call the Zerocard adapter
      // For now, we'll simulate it and transition to SENT_TO_PROVIDER
      // TODO: Implement actual provider call with retry logic
      const providerPayoutId = await this.sendToProvider(payout.id, {
        amount: params.amount,
        currency: params.currency,
        recipientAccount: params.recipientAccount,
        recipientName: params.recipientName,
        recipientBankCode: params.recipientBankCode,
      });

      // Step 8: Transition to SENT_TO_PROVIDER
      await this.stateMachine.transitionToSentToProvider({
        payoutId: payout.id,
        providerPayoutId,
      });

      // Refresh payout to get updated state
      const updatedPayout = await this.db.payout.findUnique({
        where: { id: payout.id },
      });

      if (!updatedPayout) {
        throw new ValidationError(`Payout ${payout.id} not found after state transition`);
      }

      const result: PayoutResult = {
        id: updatedPayout.id,
        walletId: updatedPayout.walletId,
        amount: updatedPayout.amount,
        currency: updatedPayout.currency as Currency,
        status: updatedPayout.status as PayoutStatus,
        idempotencyKey: updatedPayout.idempotencyKey,
        lockEntryId: updatedPayout.lockEntryId,
        providerPayoutId: updatedPayout.providerPayoutId,
        createdAt: updatedPayout.createdAt,
      };

      // Step 9: Complete idempotency with response
      await this.idempotencyService.completeIdempotency({
        merchantId: params.merchantId,
        key: params.idempotencyKey,
        statusCode: 201,
        responseBody: result,
      });

      return result;
    } catch (error) {
      // If payout was created, transition to FAILED and release funds
      // This ensures funds are released safely on error
      if (params.idempotencyKey) {
        const payout = await this.db.payout.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });

        if (payout && payout.status !== 'COMPLETED' && payout.status !== 'FAILED') {
          try {
            await this.failPayout(payout.id, error instanceof Error ? error.message : 'Unknown error');
          } catch (failError) {
            // Log but don't throw - original error is more important
            console.error('Failed to transition payout to FAILED:', failError);
          }
        }
      }

      // Mark idempotency as failed to allow retry
      await this.idempotencyService.failIdempotency(params.merchantId, params.idempotencyKey);
      throw error;
    }
  }

  /**
   * Send payout to provider (retry-safe)
   */
  private async sendToProvider(
    payoutId: string,
    params: {
      amount: MoneyAmount;
      currency: Currency;
      recipientAccount: string;
      recipientName: string;
      recipientBankCode?: string;
    },
  ): Promise<string> {
    try {
      const result = await this.offrampAdapter.createPayout({
        amount: params.amount,
        currency: params.currency,
        recipientAccount: params.recipientAccount,
        recipientName: params.recipientName,
        recipientBankCode: params.recipientBankCode,
        metadata: {
          payoutId,
        },
      });

      return result.providerPayoutId;
    } catch (error) {
      throw new ProviderError(
        'Zerocard',
        `Failed to create payout: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Fail a payout and release funds
   * Called when payout fails at any stage
   * CRITICAL: Releases funds if they were locked
   */
  async failPayout(payoutId: string, reason: string, providerError?: string): Promise<void> {
    const payout = await this.db.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundError('Payout', payoutId);
    }

    // Transition to FAILED state
    await this.stateMachine.transitionToFailed({
      payoutId,
      reason,
      providerError,
    });

    // Release funds if they were locked
    if (payout.lockEntryId) {
      await this.ledgerService.releaseFunds({
        lockEntryId: payout.lockEntryId,
        description: `Payout failed: ${reason}`,
        metadata: {
          payoutId,
          reason,
        },
      });
    }
  }

  /**
   * Handle provider webhook - reconcile final state
   * Called when provider sends webhook confirming payout status
   */
  async handleProviderWebhook(
    providerPayoutId: string,
    status: 'completed' | 'failed',
    error?: string,
  ): Promise<void> {
    const payout = await this.db.payout.findFirst({
      where: { providerPayoutId },
    });

    if (!payout) {
      throw new NotFoundError('Payout', `with provider ID ${providerPayoutId}`);
    }

    if (status === 'completed') {
      // Transition to COMPLETED and settle funds
      await this.stateMachine.transitionToCompleted({
        payoutId: payout.id,
        providerStatus: 'completed',
      });

      // Settle funds in ledger (lock is finalized)
      if (payout.lockEntryId) {
        await this.ledgerService.settleFunds({
          lockEntryId: payout.lockEntryId,
          description: 'Payout completed by provider',
          metadata: {
            payoutId: payout.id,
            providerPayoutId,
          },
        });
      }

      // Dispatch webhook to merchant
      if (this.webhookService) {
        const wallet = await this.db.wallet.findUnique({ where: { id: payout.walletId } });
        if (wallet) {
          await this.webhookService.createAndDispatch({
            merchantId: wallet.merchantId,
            event: 'payout.completed',
            payload: {
              id: payout.id,
              wallet_id: payout.walletId,
              amount: payout.amount,
              currency: payout.currency,
              status: 'completed',
              completed_at: new Date().toISOString(),
            },
          });
        }
      }
    } else if (status === 'failed') {
      // Transition to FAILED and release funds
      await this.failPayout(payout.id, 'Provider reported failure', error);

      // Dispatch webhook to merchant
      if (this.webhookService) {
        const wallet = await this.db.wallet.findUnique({ where: { id: payout.walletId } });
        if (wallet) {
          await this.webhookService.createAndDispatch({
            merchantId: wallet.merchantId,
            event: 'payout.failed',
            payload: {
              id: payout.id,
              wallet_id: payout.walletId,
              amount: payout.amount,
              currency: payout.currency,
              status: 'failed',
              failure_reason: error ?? 'Provider reported failure',
            },
          });
        }
      }
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
      status: payout.status as PayoutStatus,
      idempotencyKey: payout.idempotencyKey,
      lockEntryId: payout.lockEntryId,
      providerPayoutId: payout.providerPayoutId,
      createdAt: payout.createdAt,
    };
  }

  /**
   * Retry a failed payout
   * Only works if payout is in FAILED state and has lockEntryId
   */
  async retryPayout(payoutId: string): Promise<PayoutResult> {
    const payout = await this.db.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundError('Payout', payoutId);
    }

    if (payout.status !== 'FAILED') {
      throw new ValidationError(`Cannot retry payout in ${payout.status} state`);
    }

    // Increment retry count
    await this.db.payout.update({
      where: { id: payoutId },
      data: {
        retryCount: payout.retryCount + 1,
        lastRetryAt: new Date(),
      },
    });

    // Re-lock funds if needed
    if (!payout.lockEntryId) {
      const lockEntry = await this.ledgerService.lockFunds({
        walletId: payout.walletId,
        currency: payout.currency as Currency,
        amount: payout.amount,
        idempotencyKey: `${payout.idempotencyKey}-retry-${payout.retryCount}`,
        description: `Retry payout to ${payout.recipientName}`,
        metadata: {
          payoutId: payout.id,
          retryCount: payout.retryCount + 1,
        },
      });

      await this.stateMachine.transitionToFundsLocked({
        payoutId,
        lockEntryId: lockEntry.id,
      });
    }

    // Send to provider again
    const providerPayoutId = await this.sendToProvider(payout.id, {
      amount: payout.amount,
      currency: payout.currency as Currency,
      recipientAccount: payout.recipientAccount,
      recipientName: payout.recipientName,
      recipientBankCode: payout.recipientBankCode ?? undefined,
    });

    await this.stateMachine.transitionToSentToProvider({
      payoutId,
      providerPayoutId,
    });

    // Get merchant ID from wallet
    const wallet = await this.db.wallet.findUnique({
      where: { id: payout.walletId },
      select: { merchantId: true },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet', payout.walletId);
    }

    return this.getPayout(wallet.merchantId, payoutId) as Promise<PayoutResult>;
  }
}

// Fastify plugin to inject payout service
export async function payoutServicePlugin(fastify: FastifyInstance): Promise<void> {
  const payoutService = new PayoutService(
    fastify.db,
    fastify.ledgerService,
    fastify.idempotencyService,
    fastify.webhookService,
  );
  fastify.decorate('payoutService', payoutService);
}

declare module 'fastify' {
  interface FastifyInstance {
    payoutService: PayoutService;
  }
}

