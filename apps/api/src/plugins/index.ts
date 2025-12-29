// Fastify plugins registration
// Centralized plugin loading

import type { FastifyInstance } from 'fastify';
import { dbPlugin } from './db.js';
import { authPlugin } from './auth.js';
import { corsPlugin } from './cors.js';
import { rateLimitPlugin } from './rateLimit.js';
import { ledgerServicePlugin } from '../services/ledgerService.js';
import { idempotencyServicePlugin } from '../services/idempotencyService.js';
import { payoutServicePlugin } from '../services/payoutService.js';
import { identityServicePlugin } from '../services/identityService.js';
import { userServicePlugin } from '../services/userService.js';
import { walletServicePlugin } from '../services/walletService.js';
import { paymentServicePlugin } from '../services/paymentService.js';

export async function registerPlugins(fastify: FastifyInstance): Promise<void> {
  // Register plugins in order
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);
  await fastify.register(ledgerServicePlugin);
  await fastify.register(idempotencyServicePlugin);
  await fastify.register(identityServicePlugin);
  await fastify.register(userServicePlugin);
  await fastify.register(walletServicePlugin);
  await fastify.register(payoutServicePlugin);
  await fastify.register(paymentServicePlugin);
}
