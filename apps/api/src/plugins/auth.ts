// Authentication plugin - API key validation
// Validates API keys from Authorization header

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/index.js';

// Extend FastifyRequest to include merchant info
declare module 'fastify' {
  interface FastifyRequest {
    merchant?: {
      id: string;
      apiKey: string;
    };
  }
}

async function authenticate(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  // Extract API key from "Bearer <key>" or "ApiKey <key>"
  const match = authHeader.match(/^(?:Bearer|ApiKey)\s+(.+)$/i);
  if (!match) {
    throw new UnauthorizedError('Invalid Authorization header format. Use "Bearer <key>" or "ApiKey <key>"');
  }

  const apiKey = match[1];

  if (!apiKey) {
    throw new UnauthorizedError('Missing API key');
  }

  // TODO: Validate API key against database
  // For now, we'll do a simple check against config (MVP)
  // In production, this should query the database for the merchant
  // const merchant = await request.server.db.merchant.findUnique({
  //   where: { apiKey },
  // });
  // if (!merchant || !merchant.active) {
  //   throw new UnauthorizedError('Invalid or inactive API key');
  // }

  // Placeholder: For MVP, we'll use a simple validation
  // In production, replace with database lookup
  if (apiKey.length < 32) {
    throw new UnauthorizedError('Invalid API key');
  }

  // Attach merchant to request
  request.merchant = {
    id: 'merchant-placeholder-id', // TODO: Get from database
    apiKey,
  };
}

export async function authPlugin(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // Register preHandler hook for routes that need authentication
  // Routes can opt-in by using { preHandler: [fastify.authenticate] }
  fastify.decorate('authenticate', authenticate);
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

