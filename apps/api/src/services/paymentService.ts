// Payment processing service
// Orchestrates inbound payment flow: webhook → transaction → ledger credit
// CRITICAL: Ledger is updated atomically, transaction status tracks blockchain events

import type { FastifyInstance } from 'fastify';
import { Transaction } from '../domain/transactions/index.js';
import { LedgerService } from './ledger-service.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { Currency } from '../types/index.js';
import { TransactionStatus } from '@prisma/client';

export interface ProcessPaymentParams {
  walletId: string;
  amount: string; // Decimal string
  currency: Currency;
  txHash: string; // Blockchain transaction hash
  fromAddress?: string;
  toAddress?: string;
  blockNumber?: bigint;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  transactionId: string;
  walletId: string;
  amount: string;
  currency: Currency;
  status: 'pending' | 'completed' | 'failed';
}

export class PaymentService {
  private transaction: Transaction;

  constructor(
    private readonly db: FastifyInstance['db'],
    private readonly ledgerService: LedgerService,
  ) {
    this.transaction = new Transaction(db);
  }

  /**
   * Process inbound payment
   * Flow:
   * 1. Create transaction record (if not exists)
   * 2. Credit ledger (atomic operation)
   * 3. Update transaction status to CONFIRMED
   * 
   * This is idempotent - if transaction already exists, it's skipped
   */
  async processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
    // Step 1: Check if transaction already exists (idempotency)
    let transaction = await this.transaction.getByHash(params.txHash);
    
    if (transaction) {
      // Transaction already processed
      if (transaction.status === TransactionStatus.CONFIRMED) {
        return {
          transactionId: transaction.id,
          walletId: transaction.walletId,
          amount: transaction.amount,
          currency: transaction.currency,
          status: 'completed',
        };
      }
      // If pending or failed, we'll retry the ledger credit
    } else {
      // Step 2: Create transaction record
      const transactionResult = await this.transaction.createTransaction({
        walletId: params.walletId,
        amount: params.amount,
        currency: params.currency,
        txHash: params.txHash,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        blockNumber: params.blockNumber,
        metadata: params.metadata,
      });
      transaction = transactionResult;
    }

    try {
      // Step 3: Credit ledger (atomic operation)
      // This is the source of truth - if this succeeds, funds are available
      await this.ledgerService.credit({
        walletId: params.walletId,
        currency: params.currency,
        amount: params.amount,
        transactionId: transaction.id,
        description: `Inbound payment ${params.txHash.slice(0, 8)}...`,
        metadata: {
          txHash: params.txHash,
          fromAddress: params.fromAddress,
          toAddress: params.toAddress,
          blockNumber: params.blockNumber?.toString(),
          ...params.metadata,
        },
      });

      // Step 4: Update transaction status to CONFIRMED
      await this.transaction.updateStatus(transaction.id, TransactionStatus.CONFIRMED, {
        ledgerCredited: true,
        creditedAt: new Date().toISOString(),
      });

      return {
        transactionId: transaction.id,
        walletId: transaction.walletId,
        amount: transaction.amount,
        currency: transaction.currency,
        status: 'completed',
      };
    } catch (error) {
      // If ledger credit fails, mark transaction as failed
      await this.transaction.updateStatus(transaction.id, TransactionStatus.FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Get payment by transaction hash
   */
  async getPaymentByHash(txHash: string): Promise<PaymentResult | null> {
    const transaction = await this.transaction.getByHash(txHash);
    
    if (!transaction) {
      return null;
    }

    return {
      transactionId: transaction.id,
      walletId: transaction.walletId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status === TransactionStatus.CONFIRMED ? 'completed' : 
              transaction.status === TransactionStatus.FAILED ? 'failed' : 'pending',
    };
  }
}

// Fastify plugin to inject payment service
export async function paymentServicePlugin(fastify: FastifyInstance): Promise<void> {
  const paymentService = new PaymentService(fastify.db, fastify.ledgerService);
  fastify.decorate('paymentService', paymentService);
}

declare module 'fastify' {
  interface FastifyInstance {
    paymentService: PaymentService;
  }
}

