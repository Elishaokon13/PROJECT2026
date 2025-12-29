// API routes (thin layer, delegates to domain/services)
//
// GUARDRAIL: Routes are thin - no business logic here.
// Routes should ONLY:
// 1. Validate input (Zod schemas)
// 2. Call domain/service layer
// 3. Return response
//
// NO direct balance mutations - all money logic goes through domain/ledger
// NO business logic - delegate to services

import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { userRoutes } from './users.js';
import { walletRoutes } from './wallets.js';
import { payoutRoutes } from './payouts.js';
import { webhookRoutes } from './webhooks.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check (no auth)
  await fastify.register(healthRoutes);

  // API v1 routes (all require auth except health)
  await fastify.register(
    async (fastify) => {
      await fastify.register(userRoutes, { prefix: '/v1' });
      await fastify.register(walletRoutes, { prefix: '/v1' });
      await fastify.register(payoutRoutes, { prefix: '/v1' });
      await fastify.register(webhookRoutes, { prefix: '/v1' });
    },
    { prefix: '/api' },
  );
}
