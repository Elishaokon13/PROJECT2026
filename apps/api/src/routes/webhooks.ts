// Webhook routes - for receiving webhooks from providers
// Also includes webhook delivery management endpoints

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { transformWebhook } from '../transformers/webhook-transformer.js';

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
          provider: z.enum(['coinbase', 'zerocard', 'kyc']),
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
        // Handle Coinbase CDP payment webhook
        // Expected payload structure (adjust based on actual Coinbase CDP webhook format):
        // {
        //   event: 'payment.received',
        //   walletId: 'coinbase-wallet-id',
        //   amount: '100.00',
        //   currency: 'USDC',
        //   txHash: '0x...',
        //   fromAddress: '0x...',
        //   toAddress: '0x...',
        //   blockNumber: 12345678
        // }
        const body = request.body as {
          event?: string;
          walletId?: string;
          amount?: string;
          currency?: string;
          txHash?: string;
          fromAddress?: string;
          toAddress?: string;
          blockNumber?: string | number;
        };

        if (body.event === 'payment.received' && body.txHash && body.amount && body.currency) {
          try {
            // Find wallet by provider wallet ID (Coinbase CDP wallet ID)
            const wallet = await fastify.db.wallet.findFirst({
              where: {
                providerWalletId: body.walletId,
              },
            });

            if (!wallet) {
              fastify.log.warn({ body }, 'Coinbase webhook: Wallet not found for provider wallet ID');
              return reply.status(200).send({ received: true, processed: false });
            }

            // Process payment (creates transaction, credits ledger)
            await fastify.paymentService.processPayment({
              walletId: wallet.id,
              amount: body.amount,
              currency: body.currency as Currency,
              txHash: body.txHash,
              fromAddress: body.fromAddress,
              toAddress: body.toAddress,
              blockNumber: body.blockNumber ? BigInt(body.blockNumber) : undefined,
              metadata: {
                provider: 'coinbase',
                providerWalletId: body.walletId,
              },
            });

            fastify.log.info({ txHash: body.txHash, walletId: wallet.id }, 'Coinbase payment processed');
            return reply.status(200).send({ received: true, processed: true });
          } catch (error) {
            fastify.log.error({ err: error, body }, 'Failed to process Coinbase payment webhook');
            // Return 200 to prevent Coinbase from retrying endlessly
            return reply.status(200).send({ received: true, processed: false });
          }
        }

        return reply.status(200).send({ received: true });
      } else if (request.params.provider === 'kyc') {
        // Handle KYC provider webhook (identity verification)
        try {
          await fastify.identityService.handleProviderWebhook(request.body);
          return reply.status(200).send({ received: true, processed: true });
        } catch (error) {
          fastify.log.error({ err: error, body: request.body }, 'Failed to process KYC webhook');
          return reply.status(500).send({
            error: {
              code: 'WEBHOOK_PROCESSING_ERROR',
              message: 'Failed to process webhook',
            },
          });
        }
      }

      return reply.status(200).send({ received: true });
    },
  );
}

