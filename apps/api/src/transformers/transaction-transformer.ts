// Transaction transformer
// Converts internal transaction models to public API format
// CRITICAL: Only exposes public fields, hides internal ledger details

import type { Transaction as PrismaTransaction } from '@prisma/client';
import { toPublicId } from '../lib/public-ids.js';
import type { Transaction } from '../../sdk/src/types/api.js';

// Note: Transaction type needs to be added to SDK types
// For now, defining a basic structure
export interface Transaction {
  id: string;
  wallet_id: string;
  amount: string;
  currency: 'USDC' | 'USDT';
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed';
  transaction_hash?: string;
  created_at: string;
  completed_at?: string;
}

export function transformTransaction(transaction: PrismaTransaction): Transaction {
  return {
    id: toPublicId('transaction', transaction.id),
    wallet_id: toPublicId('wallet', transaction.walletId),
    amount: transaction.amount,
    currency: transaction.currency as 'USDC' | 'USDT',
    type: 'credit', // Transactions are always credits (inbound payments)
    status: transaction.status === 'CONFIRMED' ? 'completed' : transaction.status === 'PENDING' ? 'pending' : 'failed',
    transaction_hash: transaction.txHash ?? undefined,
    created_at: transaction.createdAt.toISOString(),
    completed_at: transaction.status === 'CONFIRMED' ? transaction.updatedAt.toISOString() : undefined,
  };
}

export function transformTransactions(transactions: PrismaTransaction[]): Transaction[] {
  return transactions.map(transformTransaction);
}

