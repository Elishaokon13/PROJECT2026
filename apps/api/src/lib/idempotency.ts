// Idempotency middleware for money-moving endpoints
// Validates idempotency key format and attaches to request
// NOTE: Actual idempotency checking happens at domain/service level
// This middleware only validates format and extracts the key

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { IdempotentRequest, AuthenticatedRequest } from '../types/index.js';

const idempotencyKeySchema = z.string().min(1).max(255);

export async function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

  if (!idempotencyKey) {
    reply.status(400).send({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required for this endpoint',
      },
    });
    return;
  }

  // Validate format
  const validation = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!validation.success) {
    reply.status(400).send({
      error: {
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key must be a non-empty string (max 255 characters)',
      },
    });
    return;
  }

  // Attach to request for use in route handlers and domain services
  // Actual idempotency checking happens at domain/service level
  (request as IdempotentRequest).idempotencyKey = idempotencyKey;
}

