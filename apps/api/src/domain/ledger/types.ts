// Ledger domain types
// Strong typing for all ledger operations

import type { MoneyAmount, Currency } from '../../types/index.js';

// Ledger entry types (must match Prisma schema enums)
export type EntryType = 'CREDIT' | 'DEBIT' | 'LOCK' | 'RELEASE' | 'SETTLE';
export type EntryStatus = 'PENDING' | 'SETTLED' | 'CANCELLED';

// Ledger operation parameters
export interface CreditParams {
  walletId: string;
  currency: Currency;
  amount: MoneyAmount;
  transactionId?: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitParams {
  walletId: string;
  currency: Currency;
  amount: MoneyAmount;
  transactionId?: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface LockFundsParams {
  walletId: string;
  currency: Currency;
  amount: MoneyAmount;
  idempotencyKey: string; // Required for lock operations
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseFundsParams {
  lockEntryId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SettleFundsParams {
  lockEntryId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Balance result
export interface Balance {
  walletId: string;
  currency: Currency;
  available: MoneyAmount; // Available for use
  locked: MoneyAmount; // Locked for pending operations
  total: MoneyAmount; // available + locked
}

// Ledger entry result
export interface LedgerEntryResult {
  id: string;
  walletId: string;
  currency: Currency;
  entryType: EntryType;
  amount: MoneyAmount;
  status: EntryStatus;
  transactionId: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

