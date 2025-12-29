// Fastify plugins registration
// Centralized plugin loading

import type { FastifyInstance } from 'fastify';
import { dbPlugin } from './db.js';
import { authPlugin } from './auth.js';
import { corsPlugin } from './cors.js';
import { rateLimitPlugin } from './rate-limit.js';
import { ledgerServicePlugin } from '../services/ledger-service.js';
import { idempotencyServicePlugin } from '../services/idempotency-service.js';
import { payoutServicePlugin } from '../services/payout-service.js';
import { identityServicePlugin } from '../services/identity-service.js';
import { walletServicePlugin } from '../services/wallet-service.js';

export async function registerPlugins(fastify: FastifyInstance): Promise<void> {
  // Register plugins in order
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);
  await fastify.register(ledgerServicePlugin);
  await fastify.register(idempotencyServicePlugin);
  await fastify.register(identityServicePlugin);
  await fastify.register(walletServicePlugin);
  await fastify.register(payoutServicePlugin);
}
