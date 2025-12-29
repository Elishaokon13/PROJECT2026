// Status normalizer
// Converts internal status values to public API status values
// CRITICAL: This is the ONLY place where status normalization happens

import { PayoutStatus, VerificationStatus } from '@prisma/client';

/**
 * Normalize payout status for public API
 * Internal: CREATED, FUNDS_LOCKED, SENT_TO_PROVIDER, COMPLETED, FAILED, CANCELLED
 * Public: pending, processing, completed, failed
 */
export function normalizePayoutStatus(status: PayoutStatus): 'pending' | 'processing' | 'completed' | 'failed' {
  switch (status) {
    case PayoutStatus.CREATED:
    case PayoutStatus.FUNDS_LOCKED:
      return 'pending';
    case PayoutStatus.SENT_TO_PROVIDER:
      return 'processing';
    case PayoutStatus.COMPLETED:
      return 'completed';
    case PayoutStatus.FAILED:
    case PayoutStatus.CANCELLED:
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Normalize verification status for public API
 * Internal: PENDING, VERIFIED, REJECTED, EXPIRED
 * Public: pending, verified, rejected, expired
 */
export function normalizeVerificationStatus(
  status: VerificationStatus,
): 'pending' | 'verified' | 'rejected' | 'expired' {
  switch (status) {
    case VerificationStatus.PENDING:
      return 'pending';
    case VerificationStatus.VERIFIED:
      return 'verified';
    case VerificationStatus.REJECTED:
      return 'rejected';
    case VerificationStatus.EXPIRED:
      return 'expired';
    default:
      return 'pending';
  }
}

