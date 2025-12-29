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
  fastify.post<{
    Params: { provider: 'coinbase' | 'zerocard' };
    Body: unknown;
  }>(
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
      // For now, we'll process the webhook without signature verification (MVP)

      if (request.params.provider === 'zerocard') {
        // Handle Zerocard payout webhook
        const body = request.body as {
          payoutId?: string;
          status?: 'completed' | 'failed';
          error?: string;
        };

        if (body.payoutId && body.status) {
          try {
            await fastify.payoutService.handleProviderWebhook(
              body.payoutId,
              body.status,
              body.error,
            );
            return reply.status(200).send({ received: true, processed: true });
          } catch (error) {
            fastify.log.error({ err: error, body }, 'Failed to process Zerocard webhook');
            return reply.status(500).send({
              error: {
                code: 'WEBHOOK_PROCESSING_ERROR',
                message: 'Failed to process webhook',
              },
            });
          }
        }
      } else if (request.params.provider === 'coinbase') {
        // TODO: Handle Coinbase CDP payment webhook
        // - Payment received → credit ledger
        // - Update transaction status
        return reply.status(200).send({ received: true });
      }

      return reply.status(200).send({ received: true });
    },
  );
}

