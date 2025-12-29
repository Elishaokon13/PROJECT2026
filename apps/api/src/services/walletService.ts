// Wallet service - orchestrates wallet creation
// CRITICAL: Enforces identity verification before wallet creation

import type { FastifyInstance } from 'fastify';
import { ValidationError, NotFoundError, ProviderError } from '../errors/index.js';
import type { Currency } from '../types/index.js';
import { CoinbaseWalletAdapter } from '../adapters/wallet/index.js';

export interface CreateWalletParams {
  merchantId: string;
  userId: string;
  currency: Currency;
}

export interface WalletResult {
  id: string;
  userId: string;
  currency: Currency;
  address: string;
  providerWalletId: string | null;
  createdAt: Date;
}

export class WalletService {
  private walletAdapter: CoinbaseWalletAdapter;

  constructor(
    private readonly db: FastifyInstance['db'],
    private readonly identityService: FastifyInstance['identityService'],
  ) {
    this.walletAdapter = new CoinbaseWalletAdapter();
  }

  /**
   * Create wallet for a user
   * CRITICAL: Requires verified identity
   */
  async createWallet(params: CreateWalletParams): Promise<WalletResult> {
    // Step 1: Verify user exists and belongs to merchant
    const user = await this.db.user.findFirst({
      where: {
        id: params.userId,
        merchantId: params.merchantId,
      },
    });

    if (!user) {
      throw new NotFoundError('User', params.userId);
    }

    // Step 2: CRITICAL - Check identity verification status
    const isVerified = await this.identityService.isUserVerified(params.userId);
    if (!isVerified) {
      throw new ValidationError(
        'User must have verified identity before wallet creation. Please complete identity verification first.',
      );
    }

    // Step 3: Check if wallet already exists for this user/currency
    const existing = await this.db.wallet.findFirst({
      where: {
        userId: params.userId,
        currency: params.currency,
        active: true,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        userId: existing.userId,
        currency: existing.currency as Currency,
        address: existing.address,
        providerWalletId: existing.providerWalletId,
        createdAt: existing.createdAt,
      };
    }

    // Step 4: Create wallet via provider adapter
    let providerWalletId: string;
    let address: string;

    try {
      const providerResult = await this.walletAdapter.createWallet({
        currency: params.currency,
      });
      providerWalletId = providerResult.providerWalletId;
      address = providerResult.address;
    } catch (error) {
      throw new ProviderError(
        'Coinbase CDP',
        `Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }

    // Step 5: Create wallet record in database
    const wallet = await this.db.wallet.create({
      data: {
        merchantId: params.merchantId,
        userId: params.userId,
        currency: params.currency,
        address,
        providerWalletId,
        active: true,
      },
    });

    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency as Currency,
      address: wallet.address,
      providerWalletId: wallet.providerWalletId,
      createdAt: wallet.createdAt,
    };
  }

  /**
   * Get wallet by ID
   */
  async getWallet(merchantId: string, walletId: string): Promise<WalletResult | null> {
    const wallet = await this.db.wallet.findFirst({
      where: {
        id: walletId,
        merchantId,
        active: true,
      },
    });

    if (!wallet) {
      return null;
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency as Currency,
      address: wallet.address,
      providerWalletId: wallet.providerWalletId,
      createdAt: wallet.createdAt,
    };
  }

  /**
   * List wallets for a user
   */
  async listWallets(merchantId: string, userId: string): Promise<WalletResult[]> {
    const wallets = await this.db.wallet.findMany({
      where: {
        userId,
        merchant: {
          id: merchantId,
        },
        active: true,
      },
    });

    return wallets.map((wallet) => ({
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency as Currency,
      address: wallet.address,
      providerWalletId: wallet.providerWalletId,
      createdAt: wallet.createdAt,
    }));
  }
}

// Fastify plugin to inject wallet service
export async function walletServicePlugin(fastify: FastifyInstance): Promise<void> {
  const walletService = new WalletService(
    fastify.db,
    fastify.identityService,
  );
  fastify.decorate('walletService', walletService);
}

declare module 'fastify' {
  interface FastifyInstance {
    walletService: WalletService;
  }
}

