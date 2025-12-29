// Transaction domain
// Handles inbound stablecoin payment tracking
// CRITICAL: Transactions are records of blockchain events, ledger is the source of truth

import { PrismaClient, TransactionStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { Currency } from '../../types/index.js';

export interface CreateTransactionParams {
  walletId: string;
  amount: string; // Decimal string
  currency: Currency;
  txHash: string; // Blockchain transaction hash
  fromAddress?: string;
  toAddress?: string;
  blockNumber?: bigint;
  metadata?: Record<string, unknown>;
}

export interface TransactionResult {
  id: string;
  walletId: string;
  amount: string;
  currency: Currency;
  txHash: string | null;
  status: TransactionStatus;
  createdAt: Date;
}

export class Transaction {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a new transaction record for an inbound payment
   * This records the blockchain event, but does NOT credit the ledger
   * Ledger credit happens separately via PaymentProcessingService
   */
  async createTransaction(params: CreateTransactionParams): Promise<TransactionResult> {
    // Check if transaction with same hash already exists (prevent duplicates)
    if (params.txHash) {
      const existing = await this.db.transaction.findUnique({
        where: { txHash: params.txHash },
      });

      if (existing) {
        throw new ValidationError(`Transaction with hash ${params.txHash} already exists`);
      }
    }

    // Verify wallet exists
    const wallet = await this.db.wallet.findUnique({
      where: { id: params.walletId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet', params.walletId);
    }

    // Create transaction record
    const transaction = await this.db.transaction.create({
      data: {
        walletId: params.walletId,
        amount: params.amount,
        currency: params.currency,
        txHash: params.txHash,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        blockNumber: params.blockNumber,
        status: TransactionStatus.PENDING,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return {
      id: transaction.id,
      walletId: transaction.walletId,
      amount: transaction.amount,
      currency: transaction.currency as Currency,
      txHash: transaction.txHash,
      status: transaction.status,
      createdAt: transaction.createdAt,
    };
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    metadata?: Record<string, unknown>,
  ): Promise<TransactionResult> {
    const transaction = await this.db.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction', transactionId);
    }

    const updated = await this.db.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        metadata: metadata
          ? { ...(transaction.metadata as Record<string, unknown>), ...metadata }
          : undefined,
      },
    });

    return {
      id: updated.id,
      walletId: updated.walletId,
      amount: updated.amount,
      currency: updated.currency as Currency,
      txHash: updated.txHash,
      status: updated.status,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Get transaction by hash
   */
  async getByHash(txHash: string): Promise<TransactionResult | null> {
    const transaction = await this.db.transaction.findUnique({
      where: { txHash },
    });

    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      walletId: transaction.walletId,
      amount: transaction.amount,
      currency: transaction.currency as Currency,
      txHash: transaction.txHash,
      status: transaction.status,
      createdAt: transaction.createdAt,
    };
  }

  /**
   * Get transaction by ID
   */
  async getById(transactionId: string): Promise<TransactionResult | null> {
    const transaction = await this.db.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      walletId: transaction.walletId,
      amount: transaction.amount,
      currency: transaction.currency as Currency,
      txHash: transaction.txHash,
      status: transaction.status,
      createdAt: transaction.createdAt,
    };
  }
}

