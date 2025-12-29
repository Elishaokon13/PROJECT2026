// Payout transformer
// Converts internal payout models to public API format
// CRITICAL: Removes internal fields (lockEntryId, providerPayoutId, idempotencyKey)

import type { Payout as PrismaPayout } from '@prisma/client';
import { toPublicId } from '../lib/public-ids.js';
import { normalizePayoutStatus } from '../lib/status-normalizer.js';
import type { Payout } from '../../sdk/src/types/api.js';

export function transformPayout(payout: PrismaPayout): Payout {
  return {
    id: toPublicId('payout', payout.id),
    wallet_id: toPublicId('wallet', payout.walletId),
    amount: payout.amount,
    currency: payout.currency as 'USDC' | 'USDT',
    status: normalizePayoutStatus(payout.status),
    recipient_account: payout.recipientAccount,
    recipient_name: payout.recipientName,
    recipient_bank_code: payout.recipientBankCode ?? undefined,
    created_at: payout.createdAt.toISOString(),
    completed_at: payout.status === 'COMPLETED' ? payout.updatedAt.toISOString() : undefined,
    failure_reason: payout.status === 'FAILED' ? payout.providerError ?? undefined : undefined,
  };
}

export function transformPayouts(payouts: PrismaPayout[]): Payout[] {
  return payouts.map(transformPayout);
}

