// Payout domain types

import type { Currency, MoneyAmount } from '../../types/index.js';

export type PayoutStatus = 'CREATED' | 'FUNDS_LOCKED' | 'SENT_TO_PROVIDER' | 'COMPLETED' | 'FAILED';

export interface PayoutIntent {
  id: string;
  walletId: string;
  amount: MoneyAmount;
  currency: Currency;
  recipientAccount: string;
  recipientName: string;
  recipientBankCode?: string;
  status: PayoutStatus;
  idempotencyKey: string;
  lockEntryId: string | null;
  providerPayoutId: string | null;
  providerStatus: string | null;
  providerError: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StateTransition {
  from: PayoutStatus;
  to: PayoutStatus;
  timestamp: Date;
  reason?: string;
}

export interface CreatePayoutIntentParams {
  walletId: string;
  amount: MoneyAmount;
  currency: Currency;
  recipientAccount: string;
  recipientName: string;
  recipientBankCode?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionToFundsLockedParams {
  payoutId: string;
  lockEntryId: string;
}

export interface TransitionToSentToProviderParams {
  payoutId: string;
  providerPayoutId: string;
}

export interface TransitionToCompletedParams {
  payoutId: string;
  providerStatus?: string;
}

export interface TransitionToFailedParams {
  payoutId: string;
  reason: string;
  providerError?: string;
}

