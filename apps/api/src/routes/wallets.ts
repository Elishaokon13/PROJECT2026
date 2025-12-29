// Wallet routes - thin layer, delegates to domain/services

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const createWalletSchema = z.object({
  userId: z.string().uuid(),
  currency: z.enum(['USDC', 'USDT']).default('USDC'),
});

const getWalletParamsSchema = z.object({
  walletId: z.string().uuid(),
});

const getBalanceParamsSchema = z.object({
  walletId: z.string().uuid(),
});

export async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  // Create wallet
  fastify.post<{ Body: z.infer<typeof createWalletSchema> }>(
    '/wallets',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: createWalletSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // TODO: Call WalletService.create()
      // const wallet = await fastify.walletService.create({
      //   merchantId: request.merchant.id,
      //   userId: request.body.userId,
      //   currency: request.body.currency,
      // });

      return reply.status(201).send({
        data: {
          id: 'wallet-placeholder-id',
          userId: request.body.userId,
          currency: request.body.currency,
          address: '0x0000000000000000000000000000000000000000',
          createdAt: new Date().toISOString(),
        },
      } satisfies ApiResponse<unknown>);
    },
  );

  // Get wallet
  fastify.get<{ Params: z.infer<typeof getWalletParamsSchema> }>(
    '/wallets/:walletId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: getWalletParamsSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // TODO: Call WalletService.getById()
      return reply.send({
        data: {
          id: request.params.walletId,
          userId: 'user-id',
          currency: 'USDC',
          address: '0x0000000000000000000000000000000000000000',
          createdAt: new Date().toISOString(),
        },
      } satisfies ApiResponse<unknown>);
    },
  );

  // Get balance
  fastify.get<{ Params: z.infer<typeof getBalanceParamsSchema> }>(
    '/wallets/:walletId/balance',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: getBalanceParamsSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // TODO: Call Ledger.getBalance() - NOT WalletService directly
      // Balance comes from ledger, not wallet provider
      // const balance = await fastify.ledgerService.getBalance(request.params.walletId);

      return reply.send({
        data: {
          walletId: request.params.walletId,
          currency: 'USDC',
          available: '0.00',
          locked: '0.00',
          total: '0.00',
        },
      } satisfies ApiResponse<unknown>);
    },
  );
}

