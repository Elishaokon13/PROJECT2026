// Identity verification transformer
// Converts internal identity verification models to public API format
// CRITICAL: Only transforms, never modifies domain models

import type { IdentityVerification as PrismaIdentityVerification } from '@prisma/client';
import { toPublicId } from '../lib/public-ids.js';
import { normalizeVerificationStatus } from '../lib/status-normalizer.js';
import type { IdentityVerification } from '../../sdk/src/types/api.js';

export function transformIdentityVerification(
  verification: PrismaIdentityVerification,
): IdentityVerification {
  return {
    id: toPublicId('verification', verification.id),
    user_id: toPublicId('user', verification.userId),
    status: normalizeVerificationStatus(verification.status),
    verified_at: verification.verifiedAt?.toISOString() ?? null,
  };
}

