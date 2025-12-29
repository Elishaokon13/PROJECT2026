// Fastify plugins registration
// Centralized plugin loading

import type { FastifyInstance } from 'fastify';
import { dbPlugin } from './db.js';
import { authPlugin } from './auth.js';
import { corsPlugin } from './cors.js';
import { rateLimitPlugin } from './rate-limit.js';
import { ledgerServicePlugin } from '../services/ledger-service.js';

export async function registerPlugins(fastify: FastifyInstance): Promise<void> {
  // Register plugins in order
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);
  await fastify.register(ledgerServicePlugin);
}
