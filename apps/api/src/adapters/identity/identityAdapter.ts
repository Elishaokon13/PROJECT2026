// Identity adapter implementation
// Abstracts KYC provider operations
// GUARDRAIL: Adapters isolate vendors - no domain logic here

import type { IdentityAdapter, SubmitVerificationParams, VerificationStatusResult, WebhookResult } from './types.js';
import { config } from '../../config/index.js';

/**
 * Identity adapter for KYC providers
 * TODO: Implement actual provider integration (SmileID, Onfido, etc.)
 * For MVP, this is a placeholder that simulates verification
 */
export class IdentityAdapterImpl implements IdentityAdapter {
  async submitVerification(params: SubmitVerificationParams): Promise<string> {
    // TODO: Call actual KYC provider API
    // For MVP, return a mock provider ID
    // In production, this would:
    // 1. Call provider API (e.g., SmileID, Onfido)
    // 2. Submit user data for verification
    // 3. Return provider verification ID

    // Simulate async verification
    return `provider-verification-${params.userId}-${Date.now()}`;
  }

  async checkStatus(providerId: string): Promise<VerificationStatusResult> {
    // TODO: Call actual KYC provider API to check status
    // For MVP, return mock status
    // In production, this would:
    // 1. Call provider API with providerId
    // 2. Return current verification status
    // 3. Handle provider errors

    return {
      status: 'PENDING',
      providerId,
    };
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    // TODO: Verify webhook signature
    // TODO: Parse provider-specific webhook payload
    // For MVP, return mock result
    // In production, this would:
    // 1. Verify webhook signature
    // 2. Parse provider-specific payload format
    // 3. Extract verification status and user identifier
    // 4. Return standardized result

    const webhook = payload as {
      verificationId?: string;
      status?: string;
      userId?: string;
    };

    return {
      providerId: webhook.verificationId ?? 'unknown',
      status: (webhook.status as WebhookResult['status']) ?? 'PENDING',
      userId: webhook.userId,
    };
  }
}

