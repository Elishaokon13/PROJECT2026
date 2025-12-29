// Rate limiting plugin

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config/index.js';

export async function rateLimitPlugin(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(rateLimit, {
    max: 100, // Maximum number of requests
    timeWindow: '1 minute', // Per time window
    // In production, use Redis for distributed rate limiting
    // redis: redisClient,
    skipOnError: false,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });
}

