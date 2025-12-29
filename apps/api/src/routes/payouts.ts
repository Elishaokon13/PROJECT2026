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
      // TODO: Call PayoutService.create()
      // Flow:
      // 1. Validate request
      // 2. Check idempotency key (already done by middleware)
      // 3. PayoutService.create() which:
      //    - Creates PayoutIntent
      //    - Calls Ledger.lockFunds() (atomic)
      //    - Calls OfframpAdapter.createTransfer()
      //    - Returns payout with status 'pending'
      // const payout = await fastify.payoutService.create({
      //   merchantId: request.merchant.id,
      //   idempotencyKey: request.idempotencyKey,
      //   ...request.body,
      // });

      return reply.status(201).send({
        data: {
          id: 'payout-placeholder-id',
          walletId: request.body.walletId,
          amount: request.body.amount,
          currency: request.body.currency,
          status: 'pending',
          idempotencyKey: request.idempotencyKey,
          createdAt: new Date().toISOString(),
        },
      } satisfies ApiResponse<unknown>);
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
    async (request, reply) => {
      // TODO: Call PayoutService.getById()
      return reply.send({
        data: {
          id: request.params.payoutId,
          walletId: 'wallet-id',
          amount: '100.00',
          currency: 'USDC',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      } satisfies ApiResponse<unknown>);
    },
  );
}

