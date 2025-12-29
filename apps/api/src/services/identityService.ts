// Identity service - orchestrates identity verification
// Integrates identity domain and adapter

import type { FastifyInstance } from 'fastify';
import { IdentityService } from '../domain/identity/index.js';
import { IdentityAdapterImpl } from '../adapters/identity/index.js';
import type { SubmitVerificationParams } from '../adapters/identity/types.js';
import { ValidationError, NotFoundError } from '../errors/index.js';

export class IdentityServiceWrapper {
  private identityService: IdentityService;
  private identityAdapter: IdentityAdapterImpl;

  constructor(db: FastifyInstance['db']) {
    this.identityService = new IdentityService(db);
    this.identityAdapter = new IdentityAdapterImpl();
  }

  /**
   * Check if user has verified identity
   * CRITICAL: Used to gate wallet creation
   */
  async isUserVerified(userId: string): Promise<boolean> {
    return this.identityService.isUserVerified(userId);
  }

  /**
   * Get identity verification for a user
   */
  async getVerification(userId: string) {
    return this.identityService.getVerification(userId);
  }

  /**
   * Submit identity verification to provider
   * Creates verification record and submits to KYC provider
   */
  async submitVerification(
    userId: string,
    userData: SubmitVerificationParams['userData'],
  ): Promise<{ verificationId: string; providerId: string }> {
    // Create verification record
    const verification = await this.identityService.createVerification({
      userId,
      provider: 'kyc-provider', // TODO: Get from config
    });

    // Submit to provider
    const providerId = await this.identityAdapter.submitVerification({
      userId,
      userData,
    });

    // Update verification with provider ID
    await this.identityService.updateVerificationStatus({
      verificationId: verification.id,
      status: 'PENDING',
      providerId,
    });

    return {
      verificationId: verification.id,
      providerId,
    };
  }

  /**
   * Handle provider webhook
   * Processes webhook from KYC provider and updates verification status
   */
  async handleProviderWebhook(payload: unknown): Promise<void> {
    const result = await this.identityAdapter.handleWebhook(payload);

    // Find verification by provider ID
    const verification = await this.identityService.getVerification(
      result.userId ?? '', // TODO: Map provider ID to user ID
    );

    if (!verification) {
      throw new NotFoundError('IdentityVerification', `with provider ID ${result.providerId}`);
    }

    // Update verification status based on provider result
    if (result.status === 'VERIFIED') {
      await this.identityService.verifyUser(verification.userId, result.providerId, result.metadata);
    } else if (result.status === 'REJECTED') {
      await this.identityService.rejectUser(verification.userId, result.error);
    } else {
      // Update status (PENDING or EXPIRED)
      await this.identityService.updateVerificationStatus({
        verificationId: verification.id,
        status: result.status,
        providerId: result.providerId,
        metadata: result.metadata,
      });
    }
  }
}

// Fastify plugin to inject identity service
export async function identityServicePlugin(fastify: FastifyInstance): Promise<void> {
  const identityService = new IdentityServiceWrapper(fastify.db);
  fastify.decorate('identityService', identityService);
}

declare module 'fastify' {
  interface FastifyInstance {
    identityService: IdentityServiceWrapper;
  }
}

