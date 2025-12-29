// Ledger domain implementation
// CRITICAL: This is the source of truth for all balances
// All money movements MUST go through this module

import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  InsufficientFundsError,
  IdempotencyKeyError,
  ValidationError,
} from '../../errors/index.js';
import type {
  CreditParams,
  DebitParams,
  LockFundsParams,
  ReleaseFundsParams,
  SettleFundsParams,
  Balance,
  LedgerEntryResult,
  EntryType,
  EntryStatus,
} from './types.js';
import type { MoneyAmount, Currency } from '../../types/index.js';

export class Ledger {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Credit funds to a wallet
   * Creates a CREDIT entry that increases available balance
   */
  async credit(params: CreditParams): Promise<LedgerEntryResult> {
    // Validate amount
    this.validateAmount(params.amount);

    // Check idempotency if provided
    if (params.idempotencyKey) {
      const existing = await this.db.ledgerEntry.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return this.mapEntry(existing);
      }
    }

    // Create credit entry
    const entry = await this.db.ledgerEntry.create({
      data: {
        walletId: params.walletId,
        currency: params.currency,
        entryType: 'CREDIT',
        amount: params.amount,
        status: 'SETTLED', // Credits are immediately settled
        transactionId: params.transactionId ?? undefined,
        idempotencyKey: params.idempotencyKey ?? undefined,
        description: params.description ?? undefined,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return this.mapEntry(entry);
  }

  /**
   * Debit funds from a wallet
   * Creates a DEBIT entry that decreases available balance
   * Enforces balance invariant: cannot debit more than available
   */
  async debit(params: DebitParams): Promise<LedgerEntryResult> {
    // Validate amount
    this.validateAmount(params.amount);

    // Check idempotency if provided
    if (params.idempotencyKey) {
      const existing = await this.db.ledgerEntry.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return this.mapEntry(existing);
      }
    }

    // Check available balance (must be done in transaction to prevent race conditions)
    const balance = await this.getBalance(params.walletId, params.currency);
    const requestedAmount = new Decimal(params.amount);
    const availableAmount = new Decimal(balance.available);

    if (availableAmount.lessThan(requestedAmount)) {
      throw new InsufficientFundsError(balance.available, params.amount);
    }

    // Create debit entry
    const entry = await this.db.ledgerEntry.create({
      data: {
        walletId: params.walletId,
        currency: params.currency,
        entryType: 'DEBIT',
        amount: params.amount,
        status: 'SETTLED', // Debits are immediately settled
        transactionId: params.transactionId ?? undefined,
        idempotencyKey: params.idempotencyKey ?? undefined,
        description: params.description ?? undefined,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return this.mapEntry(entry);
  }

  /**
   * Lock funds for a pending operation (e.g., payout)
   * Creates a LOCK entry that moves funds from available to locked
   * Requires idempotency key to prevent duplicate locks
   */
  async lockFunds(params: LockFundsParams): Promise<LedgerEntryResult> {
    // Validate amount
    this.validateAmount(params.amount);

    // Check idempotency key (required for lock operations)
    const existing = await this.db.ledgerEntry.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existing) {
      // If already locked, return existing entry
      if (existing.entryType === 'LOCK' && existing.status === 'PENDING') {
        return this.mapEntry(existing);
      }
      // If already settled/released, this is an error
      throw new IdempotencyKeyError(
        `Idempotency key ${params.idempotencyKey} already used with different operation`,
      );
    }

    // Check available balance
    const balance = await this.getBalance(params.walletId, params.currency);
    const requestedAmount = new Decimal(params.amount);
    const availableAmount = new Decimal(balance.available);

    if (availableAmount.lessThan(requestedAmount)) {
      throw new InsufficientFundsError(balance.available, params.amount);
    }

    // Create lock entry (status: PENDING until settled or released)
    const entry = await this.db.ledgerEntry.create({
      data: {
        walletId: params.walletId,
        currency: params.currency,
        entryType: 'LOCK',
        amount: params.amount,
        status: 'PENDING', // Locked funds are pending until settled/released
        idempotencyKey: params.idempotencyKey,
        description: params.description ?? undefined,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return this.mapEntry(entry);
  }

  /**
   * Release locked funds (operation cancelled/failed)
   * Creates a RELEASE entry that moves funds from locked back to available
   * The original LOCK entry is marked as CANCELLED
   */
  async releaseFunds(params: ReleaseFundsParams): Promise<LedgerEntryResult> {
    // Find the lock entry
    const lockEntry = await this.db.ledgerEntry.findUnique({
      where: { id: params.lockEntryId },
    });

    if (!lockEntry) {
      throw new ValidationError(`Lock entry ${params.lockEntryId} not found`);
    }

    if (lockEntry.entryType !== 'LOCK') {
      throw new ValidationError(`Entry ${params.lockEntryId} is not a LOCK entry`);
    }

    if (lockEntry.status !== 'PENDING') {
      throw new ValidationError(
        `Lock entry ${params.lockEntryId} is already ${lockEntry.status.toLowerCase()}`,
      );
    }

    // Use transaction to ensure atomicity
    return await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create release entry
      const releaseEntry = await tx.ledgerEntry.create({
        data: {
          walletId: lockEntry.walletId,
          currency: lockEntry.currency,
          entryType: 'RELEASE',
          amount: lockEntry.amount,
          status: 'SETTLED', // Release is immediately settled
          relatedEntryId: lockEntry.id,
          description: params.description ?? undefined,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        },
      });

      // Mark lock entry as cancelled
      await tx.ledgerEntry.update({
        where: { id: lockEntry.id },
        data: { status: 'CANCELLED' },
      });

      return this.mapEntry(releaseEntry);
    });
  }

  /**
   * Settle locked funds (operation completed)
   * Creates a SETTLE entry that finalizes the lock
   * The original LOCK entry is marked as SETTLED
   * Funds remain locked (they were debited via the original operation)
   */
  async settleFunds(params: SettleFundsParams): Promise<LedgerEntryResult> {
    // Find the lock entry
    const lockEntry = await this.db.ledgerEntry.findUnique({
      where: { id: params.lockEntryId },
    });

    if (!lockEntry) {
      throw new ValidationError(`Lock entry ${params.lockEntryId} not found`);
    }

    if (lockEntry.entryType !== 'LOCK') {
      throw new ValidationError(`Entry ${params.lockEntryId} is not a LOCK entry`);
    }

    if (lockEntry.status !== 'PENDING') {
      throw new ValidationError(
        `Lock entry ${params.lockEntryId} is already ${lockEntry.status.toLowerCase()}`,
      );
    }

    // Use transaction to ensure atomicity
    return await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create settle entry
      const settleEntry = await tx.ledgerEntry.create({
        data: {
          walletId: lockEntry.walletId,
          currency: lockEntry.currency,
          entryType: 'SETTLE',
          amount: lockEntry.amount,
          status: 'SETTLED', // Settle is immediately settled
          relatedEntryId: lockEntry.id,
          description: params.description ?? undefined,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        },
      });

      // Mark lock entry as settled
      await tx.ledgerEntry.update({
        where: { id: lockEntry.id },
        data: { status: 'SETTLED' },
      });

      return this.mapEntry(settleEntry);
    });
  }

  /**
   * Get current balance for a wallet and currency
   * Computes balance from all SETTLED ledger entries
   * This is the source of truth - balances are computed, not stored
   */
  async getBalance(walletId: string, currency: Currency): Promise<Balance> {
    // Get all settled entries for this wallet/currency
    const entries = await this.db.ledgerEntry.findMany({
      where: {
        walletId,
        currency,
        status: 'SETTLED',
      },
    });

    // Compute balance
    let available = new Decimal(0);
    let locked = new Decimal(0);

    for (const entry of entries) {
      const amount = new Decimal(entry.amount);

      switch (entry.entryType) {
        case 'CREDIT':
          // Credits increase available balance
          available = available.plus(amount);
          break;

        case 'DEBIT':
          // Debits decrease available balance
          available = available.minus(amount);
          break;

        case 'LOCK':
          // Locks move funds from available to locked
          available = available.minus(amount);
          locked = locked.plus(amount);
          break;

        case 'RELEASE':
          // Releases move funds from locked back to available
          locked = locked.minus(amount);
          available = available.plus(amount);
          break;

        case 'SETTLE':
          // Settles finalize locks (funds remain locked/debited)
          // No balance change, just status update
          break;
      }
    }

    // Enforce invariant: balances cannot be negative
    if (available.lessThan(0)) {
      throw new Error(
        `Ledger invariant violation: negative available balance for wallet ${walletId}, currency ${currency}`,
      );
    }

    if (locked.lessThan(0)) {
      throw new Error(
        `Ledger invariant violation: negative locked balance for wallet ${walletId}, currency ${currency}`,
      );
    }

    const total = available.plus(locked);

    return {
      walletId,
      currency,
      available: available.toString(),
      locked: locked.toString(),
      total: total.toString(),
    };
  }

  /**
   * Validate amount is a positive decimal string
   */
  private validateAmount(amount: MoneyAmount): void {
    const decimal = new Decimal(amount);
    if (decimal.lessThanOrEqualTo(0)) {
      throw new ValidationError('Amount must be greater than zero');
    }
    if (decimal.decimalPlaces() > 18) {
      throw new ValidationError('Amount cannot have more than 18 decimal places');
    }
  }

  /**
   * Map Prisma entry to domain type
   */
  private mapEntry(entry: {
    id: string;
    walletId: string;
    currency: string;
    entryType: string;
    amount: string;
    status: string;
    transactionId: string | null;
    idempotencyKey: string | null;
    createdAt: Date;
  }): LedgerEntryResult {
    return {
      id: entry.id,
      walletId: entry.walletId,
      currency: entry.currency as Currency,
      entryType: entry.entryType as EntryType,
      amount: entry.amount,
      status: entry.status as EntryStatus,
      transactionId: entry.transactionId,
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt,
    };
  }
}

