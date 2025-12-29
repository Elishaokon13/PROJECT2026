// Wallet transformer
// Converts internal wallet models to public API format
// CRITICAL: Removes internal fields (providerWalletId)

import type { Wallet as PrismaWallet } from '@prisma/client';
import { toPublicId } from '../lib/public-ids.js';
import type { Wallet } from '../../sdk/src/types/api.js';

export function transformWallet(wallet: PrismaWallet): Wallet {
  return {
    id: toPublicId('wallet', wallet.id),
    user_id: toPublicId('user', wallet.userId),
    currency: wallet.currency as 'USDC' | 'USDT',
    address: wallet.address,
    created_at: wallet.createdAt.toISOString(),
  };
}

export function transformWallets(wallets: PrismaWallet[]): Wallet[] {
  return wallets.map(transformWallet);
}

