// Public ID utility
// Converts internal UUIDs to Stripe-style prefixed IDs for public API
// CRITICAL: This is the ONLY place where ID prefixing happens

export type ResourceType = 'user' | 'wallet' | 'payout' | 'transaction' | 'webhook' | 'verification';

const PREFIXES: Record<ResourceType, string> = {
  user: 'user_',
  wallet: 'wallet_',
  payout: 'payout_',
  transaction: 'txn_',
  webhook: 'evt_',
  verification: 'ver_',
};

/**
 * Convert internal UUID to public prefixed ID
 */
export function toPublicId(resourceType: ResourceType, internalId: string): string {
  if (!internalId) {
    return internalId;
  }
  // If already prefixed, return as-is (idempotent)
  if (internalId.startsWith(PREFIXES[resourceType])) {
    return internalId;
  }
  return `${PREFIXES[resourceType]}${internalId}`;
}

/**
 * Convert public prefixed ID to internal UUID
 * Strips prefix if present
 */
export function fromPublicId(resourceType: ResourceType, publicId: string): string {
  if (!publicId) {
    return publicId;
  }
  const prefix = PREFIXES[resourceType];
  if (publicId.startsWith(prefix)) {
    return publicId.slice(prefix.length);
  }
  // If no prefix, assume it's already an internal ID
  return publicId;
}

