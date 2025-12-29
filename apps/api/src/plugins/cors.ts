// CORS plugin configuration

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config/index.js';

export async function corsPlugin(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(cors, {
    origin: config.nodeEnv === 'production'
      ? false // Restrict in production - configure allowed origins
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

