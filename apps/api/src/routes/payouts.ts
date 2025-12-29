// Payout routes - thin layer, delegates to domain/services
// CRITICAL: All payout endpoints require idempotency keys

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdempotentRequest, ApiResponse } from '../types/index.js';
import { idempotencyMiddleware } from '../lib/idempotency.js';

const createPayoutSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.string().regex(/^\d+\.?\d*$/, 'Amount must be a valid decimal string'),
  currency: z.enum(['USDC', 'USDT']),
  recipientAccount: z.string().min(1), // Bank account, mobile money, etc.
  recipientName: z.string().min(1),
  recipientBankCode: z.string().optional(), // For bank transfers
  metadata: z.record(z.unknown()).optional(),
});

const getPayoutParamsSchema = z.object({
  payoutId: z.string().uuid(),
});

export async function payoutRoutes(fastify: FastifyInstance): Promise<void> {
  // Create payout (MONEY-MOVING - requires idempotency key)
  fastify.post<{ Body: z.infer<typeof createPayoutSchema> }>(
    '/payouts',
    {
      preHandler: [fastify.authenticate, idempotencyMiddleware],
      schema: {
        headers: {
          type: 'object',
          properties: {
            'idempotency-key': { type: 'string' },
          },
          required: ['idempotency-key'],
        },
        body: createPayoutSchema,
      },
    },
    async (request: IdempotentRequest, reply) => {
      // Call PayoutService.create() - idempotency handled at domain level
      // The service will:
      // 1. Check idempotency (returns stored response if duplicate)
      // 2. Store idempotency key (if new request)
      // 3. Lock funds via ledger (atomic)
      // 4. Create payout record
      // 5. Complete idempotency with response
      const payout = await fastify.payoutService.createPayout({
        merchantId: request.merchant.id,
        idempotencyKey: request.idempotencyKey,
        walletId: request.body.walletId,
        amount: request.body.amount,
        currency: request.body.currency,
        recipientAccount: request.body.recipientAccount,
        recipientName: request.body.recipientName,
        recipientBankCode: request.body.recipientBankCode,
        metadata: request.body.metadata,
      });

      return reply.status(201).send({
        data: payout,
      } satisfies ApiResponse<typeof payout>);
    },
  );

  // Get payout
  fastify.get<{ Params: z.infer<typeof getPayoutParamsSchema> }>(
    '/payouts/:payoutId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: getPayoutParamsSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const payout = await fastify.payoutService.getPayout(
        request.merchant.id,
        request.params.payoutId,
      );

      if (!payout) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Payout with id ${request.params.payoutId} not found`,
          },
        });
      }

      return reply.send({
        data: payout,
      } satisfies ApiResponse<typeof payout>);
    },
  );
}

