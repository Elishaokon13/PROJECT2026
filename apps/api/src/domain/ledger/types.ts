// Ledger domain types
// Types for ledger operations and balance queries

import type { LedgerEntryType, PayoutStatus } from '@prisma/client';

// Money amount (decimal string to avoid floating point issues)
export type MoneyAmount = string;

// Currency types
export type Currency = 'USDC' | 'USDT';

// Ledger operation result
export interface LedgerOperationResult {
  entryId: string;
  balanceAfter: MoneyAmount;
  available: MoneyAmount;
  locked: MoneyAmount;
  total: MoneyAmount;
}

// Credit operation input
export interface CreditInput {
  walletId: string;
  userId: string;
  merchantId: string;
  amount: MoneyAmount;
  currency: Currency;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Debit operation input
export interface DebitInput {
  walletId: string;
  userId: string;
  merchantId: string;
  amount: MoneyAmount;
  currency: Currency;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Lock funds input (for payouts)
export interface LockFundsInput {
  walletId: string;
  userId: string;
  merchantId: string;
  amount: MoneyAmount;
  currency: Currency;
  idempotencyKey: string; // Required for lock operations
  operationId: string; // Links lock to settle/release
  description?: string;
  metadata?: Record<string, unknown>;
}

// Settle operation (complete a locked operation)
export interface SettleInput {
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

// Release operation (cancel a locked operation)
export interface ReleaseInput {
  idempotencyKey: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// Balance query result
export interface BalanceResult {
  walletId: string;
  userId: string;
  currency: Currency;
  available: MoneyAmount;
  locked: MoneyAmount;
  total: MoneyAmount;
  lastUpdated: Date;
}

// Ledger entry for queries
export interface LedgerEntryResult {
  id: string;
  walletId: string;
  entryType: LedgerEntryType;
  amount: MoneyAmount;
  currency: Currency;
  balanceAfter: MoneyAmount;
  description: string | null;
  idempotencyKey: string | null;
  operationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

