// Webhook verification and parsing utilities
// Helps merchants verify and parse webhook events

import type { WebhookPayload } from './types/api.js';
import { createHmac } from 'crypto';

export interface WebhookConfig {
  secret: string;
}

export class WebhookVerifier {
  constructor(private readonly secret: string) {}

  /**
   * Verify webhook signature
   * Merchants should verify webhook authenticity
   */
  verify(signature: string, payload: string): boolean {
    const expectedSignature = createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Parse webhook payload
   * Returns typed webhook event
   */
  parse(payload: string): WebhookPayload {
    return JSON.parse(payload) as WebhookPayload;
  }
}

