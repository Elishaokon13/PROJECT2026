// Identity domain implementation
// Handles identity verification and KYC status
// CRITICAL: Wallet creation requires verified identity

import type { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../errors/index.js';
import type {
  VerificationStatus,
  IdentityVerification,
  CreateVerificationParams,
  UpdateVerificationStatusParams,
} from './types.js';

export class IdentityService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Check if user has verified identity
   * CRITICAL: Used to gate wallet creation
   */
  async isUserVerified(userId: string): Promise<boolean> {
    const verification = await this.db.identityVerification.findUnique({
      where: { userId },
    });

    return verification?.status === 'VERIFIED';
  }

  /**
   * Get identity verification for a user
   */
  async getVerification(userId: string): Promise<IdentityVerification | null> {
    const verification = await this.db.identityVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      return null;
    }

    return this.mapVerification(verification);
  }

  /**
   * Create identity verification record
   * Called when user initiates KYC process
   */
  async createVerification(params: CreateVerificationParams): Promise<IdentityVerification> {
    // Check if user exists
    const user = await this.db.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new NotFoundError('User', params.userId);
    }

    // Check if verification already exists
    const existing = await this.db.identityVerification.findUnique({
      where: { userId: params.userId },
    });

    if (existing) {
      return this.mapVerification(existing);
    }

    // Create verification record
    const verification = await this.db.identityVerification.create({
      data: {
        userId: params.userId,
        status: 'PENDING',
        provider: params.provider ?? null,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return this.mapVerification(verification);
  }

  /**
   * Update verification status
   * Called by identity adapter after provider verification
   */
  async updateVerificationStatus(
    params: UpdateVerificationStatusParams,
  ): Promise<IdentityVerification> {
    const verification = await this.db.identityVerification.findUnique({
      where: { id: params.verificationId },
    });

    if (!verification) {
      throw new NotFoundError('IdentityVerification', params.verificationId);
    }

    const updated = await this.db.identityVerification.update({
      where: { id: params.verificationId },
      data: {
        status: params.status,
        providerId: params.providerId ?? undefined,
        verifiedAt: params.status === 'VERIFIED' ? new Date() : undefined,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return this.mapVerification(updated);
  }

  /**
   * Verify user identity (called by adapter after successful verification)
   */
  async verifyUser(userId: string, providerId: string, metadata?: Record<string, unknown>): Promise<IdentityVerification> {
    const verification = await this.db.identityVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      throw new NotFoundError('IdentityVerification', `for user ${userId}`);
    }

    return this.updateVerificationStatus({
      verificationId: verification.id,
      status: 'VERIFIED',
      providerId,
      metadata,
    });
  }

  /**
   * Reject user identity (called by adapter after failed verification)
   */
  async rejectUser(userId: string, reason?: string): Promise<IdentityVerification> {
    const verification = await this.db.identityVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      throw new NotFoundError('IdentityVerification', `for user ${userId}`);
    }

    return this.updateVerificationStatus({
      verificationId: verification.id,
      status: 'REJECTED',
      metadata: reason ? { rejectionReason: reason } : undefined,
    });
  }

  /**
   * Map Prisma verification to domain type
   */
  private mapVerification(verification: {
    id: string;
    userId: string;
    status: string;
    provider: string | null;
    providerId: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): IdentityVerification {
    return {
      id: verification.id,
      userId: verification.userId,
      status: verification.status as VerificationStatus,
      provider: verification.provider,
      providerId: verification.providerId,
      verifiedAt: verification.verifiedAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }
}

