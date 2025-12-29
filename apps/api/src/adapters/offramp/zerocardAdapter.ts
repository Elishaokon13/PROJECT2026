// Zerocard Off-Ramp Adapter
// Implements OfframpAdapter interface for Zerocard
// CRITICAL: This adapter isolates Zerocard-specific logic from domain

import type {
  OfframpAdapter,
  CreatePayoutParams,
  CreatePayoutResult,
  PayoutStatusResult,
  OfframpWebhookResult,
} from './types.js';
import { config } from '../../config/index.js';
import { createHmac } from 'crypto';

export class ZerocardOfframpAdapter implements OfframpAdapter {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = config.zerocardApiKey;
    this.apiSecret = config.zerocardApiSecret;
    this.baseUrl = config.zerocardBaseUrl;
  }

  /**
   * Create payout via Zerocard API
   * Documentation: https://docs.zerocard.com/
   */
  async createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult> {
    // TODO: Implement actual Zerocard API call
    // For MVP, return mock data
    // In production, this would:
    // 1. Call Zerocard POST /v1/payouts
    // 2. Handle authentication (API key + signature)
    // 3. Handle errors and retries
    // 4. Return provider payout ID

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Zerocard API credentials not configured');
    }

    // Mock implementation for MVP
    // Replace with actual API call:
    /*
    const response = await fetch(`${this.baseUrl}/v1/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Signature': this.generateSignature('POST', '/v1/payouts', body),
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        recipient_account: params.recipientAccount,
        recipient_name: params.recipientName,
        recipient_bank_code: params.recipientBankCode,
        metadata: params.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Zerocard API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      providerPayoutId: data.id,
      status: data.status,
      estimatedCompletionTime: data.estimated_completion_time
        ? new Date(data.estimated_completion_time)
        : undefined,
    };
    */

    // Mock response for MVP
    const mockPayoutId = `zerocard_payout_${Date.now()}`;

    return {
      providerPayoutId: mockPayoutId,
      status: 'pending',
      estimatedCompletionTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  /**
   * Get payout status from Zerocard
   */
  async getPayoutStatus(providerPayoutId: string): Promise<PayoutStatusResult> {
    // TODO: Implement actual Zerocard API call
    // GET /v1/payouts/{payoutId}

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Zerocard API credentials not configured');
    }

    // Mock implementation
    return {
      providerPayoutId,
      status: 'pending',
    };
  }

  /**
   * Verify webhook signature from Zerocard
   * Zerocard uses HMAC-SHA256 with API secret
   */
  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Parse Zerocard webhook payload
   */
  parseWebhook(payload: unknown): OfframpWebhookResult {
    // TODO: Parse actual Zerocard webhook format
    // Expected structure:
    // {
    //   event: 'payout.completed' | 'payout.failed' | 'payout.processing',
    //   payout_id: string,
    //   status: string,
    //   failure_reason?: string,
    //   completed_at?: string
    // }

    const webhook = payload as {
      event?: string;
      payout_id?: string;
      payoutId?: string;
      status?: string;
      failure_reason?: string;
      failureReason?: string;
      completed_at?: string;
      completedAt?: string;
    };

    return {
      event: (webhook.event as OfframpWebhookResult['event']) ?? 'payout.processing',
      providerPayoutId: webhook.payout_id ?? webhook.payoutId ?? '',
      status: (webhook.status as OfframpWebhookResult['status']) ?? 'pending',
      failureReason: webhook.failure_reason ?? webhook.failureReason,
      completedAt: webhook.completed_at || webhook.completedAt
        ? new Date(webhook.completed_at ?? webhook.completedAt ?? '')
        : undefined,
    };
  }

  /**
   * Generate API signature for Zerocard requests
   */
  private generateSignature(method: string, path: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}${method}${path}${body}`;
    return createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }
}

