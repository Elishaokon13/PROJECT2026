// Payout routes - thin layer, delegates to domain/services
// CRITICAL: All payout endpoints require idempotency keys

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdempotentRequest, ApiResponse, AuthenticatedRequest } from '../types/index.js';
import { idempotencyMiddleware } from '../lib/idempotency.js';
import { transformPayout } from '../transformers/payoutTransformer.js';
import { fromPublicId } from '../lib/publicIds.js';

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
      // Convert public wallet ID to internal ID
      const internalWalletId = fromPublicId('wallet', request.body.walletId);
      
      const payout = await fastify.payoutService.createPayout({
        merchantId: request.merchant.id,
        idempotencyKey: request.idempotencyKey,
        walletId: internalWalletId,
        amount: request.body.amount,
        currency: request.body.currency,
        recipientAccount: request.body.recipientAccount,
        recipientName: request.body.recipientName,
        recipientBankCode: request.body.recipientBankCode,
        metadata: request.body.metadata,
      });

      // Get full payout from DB to transform
      const fullPayout = await fastify.db.payout.findUnique({
        where: { id: payout.id },
      });

      if (!fullPayout) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Payout created but not found',
          },
        });
      }

      return reply.status(201).send({
        data: transformPayout(fullPayout),
      });
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
      // Convert public ID to internal ID
      const internalPayoutId = fromPublicId('payout', request.params.payoutId);
      const payout = await fastify.payoutService.getPayout(
        request.merchant.id,
        internalPayoutId,
      );

      if (!payout) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Payout with id ${request.params.payoutId} not found`,
          },
        });
      }

      // Get full payout from DB to transform
      const fullPayout = await fastify.db.payout.findUnique({
        where: { id: payout.id },
      });

      if (!fullPayout) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Payout with id ${request.params.payoutId} not found`,
          },
        });
      }

      return reply.send({
        data: transformPayout(fullPayout),
      });
    },
  );
}

