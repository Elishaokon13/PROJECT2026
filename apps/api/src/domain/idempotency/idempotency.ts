// Idempotency domain implementation
// Handles persistent idempotency key tracking and validation
// CRITICAL: Idempotency is enforced at domain/service level, not just middleware

import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { IdempotencyKeyError, ValidationError } from '../../errors/index.js';
import type {
  IdempotencyResult,
  StoreIdempotencyParams,
  CheckIdempotencyParams,
  CompleteIdempotencyParams,
} from './types.js';

export class IdempotencyService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Compute SHA-256 hash of request body for payload validation
   */
  private hashRequestBody(body: unknown): string {
    const bodyString = JSON.stringify(body, Object.keys(body as Record<string, unknown>).sort());
    return createHash('sha256').update(bodyString).digest('hex');
  }

  /**
   * Check if idempotency key exists and validate request payload
   * Returns stored response if duplicate request with same payload
   * Throws error if same key with different payload
   */
  async checkIdempotency<T = unknown>(
    params: CheckIdempotencyParams,
  ): Promise<IdempotencyResult<T>> {
    const requestHash = this.hashRequestBody(params.requestBody);

    // Find existing idempotency key (scoped per merchant)
    const existing = await this.db.idempotencyKey.findUnique({
      where: {
        merchantId_key: {
          merchantId: params.merchantId,
          key: params.key,
        },
      },
    });

    // No existing key - this is a new request
    if (!existing) {
      return { isDuplicate: false };
    }

    // Same key exists - validate payload hash
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyKeyError(
        `Idempotency key ${params.key} already used with different request payload`,
      );
    }

    // Validate method and path match
    if (existing.requestMethod !== params.requestMethod || existing.requestPath !== params.requestPath) {
      throw new IdempotencyKeyError(
        `Idempotency key ${params.key} already used with different endpoint`,
      );
    }

    // Request is in progress
    if (existing.status === 'PENDING') {
      throw new IdempotencyKeyError(
        `Request with idempotency key ${params.key} is already in progress`,
      );
    }

    // Request completed - return stored response
    if (existing.status === 'COMPLETED') {
      return {
        isDuplicate: true,
        response: {
          statusCode: existing.statusCode,
          body: existing.responseBody as T,
          headers: existing.responseHeaders as Record<string, string> | undefined,
        },
      };
    }

    // Request failed - allow retry
    return { isDuplicate: false };
  }

  /**
   * Store idempotency key for a new request
   * Creates record in PENDING status
   */
  async storeIdempotency(params: StoreIdempotencyParams): Promise<void> {
    const requestHash = this.hashRequestBody(params.requestBody);

    try {
      await this.db.idempotencyKey.create({
        data: {
          merchantId: params.merchantId,
          key: params.key,
          requestHash,
          requestMethod: params.requestMethod,
          requestPath: params.requestPath,
          status: 'PENDING',
          // Response fields will be set when request completes
          statusCode: 0,
          responseBody: {},
        },
      });
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Key already exists - this is a race condition
        // Re-check to get the existing record
        const existing = await this.db.idempotencyKey.findUnique({
          where: {
            merchantId_key: {
              merchantId: params.merchantId,
              key: params.key,
            },
          },
        });

        if (existing) {
          // Validate payload matches
          if (existing.requestHash !== requestHash) {
            throw new IdempotencyKeyError(
              `Idempotency key ${params.key} already used with different request payload`,
            );
          }

          // If already completed, this is a duplicate
          if (existing.status === 'COMPLETED') {
            throw new IdempotencyKeyError(
              `Request with idempotency key ${params.key} already completed`,
            );
          }

          // If pending, request is in progress
          if (existing.status === 'PENDING') {
            throw new IdempotencyKeyError(
              `Request with idempotency key ${params.key} is already in progress`,
            );
          }
        }
      }
      throw error;
    }
  }

  /**
   * Mark idempotency key as completed with response
   * Called after request successfully completes
   */
  async completeIdempotency(params: CompleteIdempotencyParams): Promise<void> {
    await this.db.idempotencyKey.update({
      where: {
        merchantId_key: {
          merchantId: params.merchantId,
          key: params.key,
        },
      },
      data: {
        status: 'COMPLETED',
        statusCode: params.statusCode,
        responseBody: JSON.parse(JSON.stringify(params.responseBody)),
        responseHeaders: params.responseHeaders ? JSON.parse(JSON.stringify(params.responseHeaders)) : undefined,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Mark idempotency key as failed
   * Called when request fails (allows retry with same key)
   */
  async failIdempotency(merchantId: string, key: string): Promise<void> {
    await this.db.idempotencyKey.update({
      where: {
        merchantId_key: {
          merchantId,
          key,
        },
      },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });
  }

  /**
   * Get idempotency key record (for debugging/admin)
   */
  async getIdempotencyKey(merchantId: string, key: string) {
    return this.db.idempotencyKey.findUnique({
      where: {
        merchantId_key: {
          merchantId,
          key,
        },
      },
    });
  }
}

