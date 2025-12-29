// Wallet adapter types
// Abstracts wallet provider (Coinbase CDP) from domain logic

export interface WalletAdapter {
  /**
   * Create a new wallet via provider
   * Returns provider wallet ID and blockchain address
   */
  createWallet(params: CreateWalletParams): Promise<CreateWalletResult>;

  /**
   * Get wallet address from provider
   */
  getWalletAddress(providerWalletId: string): Promise<string>;

  /**
   * Get wallet balance from provider (for reconciliation)
   * Note: Internal ledger is source of truth, this is for verification
   */
  getWalletBalance(providerWalletId: string): Promise<string>;

  /**
   * Verify webhook signature from provider
   */
  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean;

  /**
   * Parse webhook payload from provider
   */
  parseWebhook(payload: unknown): WalletWebhookResult;
}

export interface CreateWalletParams {
  currency: 'USDC' | 'USDT';
  // Additional params can be added here (e.g., network, label)
}

export interface CreateWalletResult {
  providerWalletId: string;
  address: string; // Blockchain address
  network?: string; // e.g., 'ethereum', 'polygon'
}

export interface WalletWebhookResult {
  event: 'wallet.created' | 'payment.received' | 'payment.failed';
  providerWalletId: string;
  data: {
    walletId?: string;
    address?: string;
    amount?: string;
    currency?: string;
    txHash?: string;
    fromAddress?: string;
    toAddress?: string;
    blockNumber?: string;
    status?: 'pending' | 'confirmed' | 'failed';
  };
}

