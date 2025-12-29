// Webhook routes - for receiving webhooks from providers
// Also includes webhook delivery management endpoints

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const getWebhookParamsSchema = z.object({
  webhookId: z.string().uuid(),
});

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Get webhook event
  fastify.get<{ Params: z.infer<typeof getWebhookParamsSchema> }>(
    '/webhooks/:webhookId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: getWebhookParamsSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // TODO: Call WebhookService.getById()
      return reply.send({
        data: {
          id: request.params.webhookId,
          event: 'payout.completed',
          payload: {},
          status: 'delivered',
          createdAt: new Date().toISOString(),
        },
      } satisfies ApiResponse<unknown>);
    },
  );

  // List webhook events
  fastify.get(
    '/webhooks',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: AuthenticatedRequest, reply) => {
      // TODO: Call WebhookService.list()
      return reply.send({
        data: [],
        pagination: {
          limit: 20,
          offset: 0,
          total: 0,
          hasMore: false,
        },
      });
    },
  );

  // Provider webhook endpoint (no auth - uses signature verification)
  // This receives webhooks from Coinbase CDP, Zerocard, etc.
  fastify.post(
    '/webhooks/provider/:provider',
    {
      schema: {
        params: z.object({
          provider: z.enum(['coinbase', 'zerocard']),
        }),
      },
    },
    async (request, reply) => {
      // TODO: Verify webhook signature
      // TODO: Process webhook event
      // - Coinbase: payment received → update ledger
      // - Zerocard: payout status → update payout, settle/release ledger

      return reply.status(200).send({ received: true });
    },
  );
}

