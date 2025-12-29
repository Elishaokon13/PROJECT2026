// Idempotency middleware for money-moving endpoints
// Ensures requests with the same idempotency key are handled safely

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { IdempotencyKeyError } from '../errors/index.js';
import type { IdempotentRequest } from '../types/index.js';

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

  // TODO: Check if idempotency key was already used
  // This should query the database for existing requests with this key
  // const existingRequest = await request.server.db.idempotencyKey.findUnique({
  //   where: { key: idempotencyKey },
  // });
  // if (existingRequest) {
  //   if (existingRequest.status === 'completed') {
  //     // Return the original response
  //     return reply.status(existingRequest.statusCode).send(existingRequest.response);
  //   }
  //   throw new IdempotencyKeyError('Request with this idempotency key is already in progress');
  // }

  // Attach to request for use in route handlers
  (request as IdempotentRequest).idempotencyKey = idempotencyKey;
}

