// Wallet routes - thin layer, delegates to domain/services

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { transformWallet } from '../transformers/wallet-transformer.js';
import { fromPublicId, toPublicId } from '../lib/public-ids.js';

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
      // Convert public user ID to internal ID
      const internalUserId = fromPublicId('user', request.body.userId);
      
      // Call WalletService.create() - enforces identity verification
      // Will throw ValidationError if user is not verified
      const wallet = await fastify.walletService.createWallet({
        merchantId: request.merchant.id,
        userId: internalUserId,
        currency: request.body.currency,
      });

      // Get full wallet from DB to transform
      const fullWallet = await fastify.db.wallet.findUnique({
        where: { id: wallet.id },
      });

      if (!fullWallet) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Wallet created but not found',
          },
        });
      }

      return reply.status(201).send({
        data: transformWallet(fullWallet),
      });
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
      // Convert public ID to internal ID
      const internalWalletId = fromPublicId('wallet', request.params.walletId);
      const wallet = await fastify.walletService.getWallet(
        request.merchant.id,
        internalWalletId,
      );

      if (!wallet) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Wallet with id ${request.params.walletId} not found`,
          },
        });
      }

      // Get full wallet from DB to transform
      const fullWallet = await fastify.db.wallet.findUnique({
        where: { id: wallet.id },
      });

      if (!fullWallet) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Wallet with id ${request.params.walletId} not found`,
          },
        });
      }

      return reply.send({
        data: transformWallet(fullWallet),
      });
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
      // Convert public ID to internal ID
      const internalWalletId = fromPublicId('wallet', request.params.walletId);
      
      // Verify wallet exists and belongs to merchant
      const wallet = await fastify.walletService.getWallet(
        request.merchant.id,
        internalWalletId,
      );

      if (!wallet) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Wallet with id ${request.params.walletId} not found`,
          },
        });
      }

      // Get balance from ledger
      const balance = await fastify.ledgerService.getBalance(internalWalletId, wallet.currency);

      return reply.send({
        data: {
          wallet_id: toPublicId('wallet', internalWalletId),
          currency: balance.currency as 'USDC' | 'USDT',
          available: balance.available.toString(),
          locked: balance.locked.toString(),
          total: balance.total.toString(),
        },
      });
    },
  );
}

