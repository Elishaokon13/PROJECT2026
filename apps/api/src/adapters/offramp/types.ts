// Off-ramp adapter types
// Abstracts off-ramp provider (Zerocard) from domain logic

export interface OfframpAdapter {
  /**
   * Initiate payout via off-ramp provider
   * Returns provider payout ID
   */
  createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult>;

  /**
   * Check payout status with provider
   */
  getPayoutStatus(providerPayoutId: string): Promise<PayoutStatusResult>;

  /**
   * Verify webhook signature from provider
   */
  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean;

  /**
   * Parse webhook payload from provider
   */
  parseWebhook(payload: unknown): OfframpWebhookResult;
}

export interface CreatePayoutParams {
  amount: string; // Decimal string
  currency: 'USDC' | 'USDT';
  recipientAccount: string; // Bank account, mobile money, etc.
  recipientName: string;
  recipientBankCode?: string; // For bank transfers
  metadata?: Record<string, unknown>;
}

export interface CreatePayoutResult {
  providerPayoutId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedCompletionTime?: Date;
}

export interface PayoutStatusResult {
  providerPayoutId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  failureReason?: string;
}

export interface OfframpWebhookResult {
  event: 'payout.completed' | 'payout.failed' | 'payout.processing';
  providerPayoutId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  failureReason?: string;
  completedAt?: Date;
}

