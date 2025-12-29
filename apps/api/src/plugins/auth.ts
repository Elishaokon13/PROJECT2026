// Authentication plugin - API key validation
// Validates API keys from Authorization header

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

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

  // Look up merchant by API key in database
  const merchant = await (request.server as FastifyInstance).db.merchant.findUnique({
    where: { apiKey },
  });

  if (!merchant) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (!merchant.active) {
    throw new ForbiddenError('Merchant account is inactive');
  }

  // Attach merchant to request
  (request as AuthenticatedRequest).merchant = {
    id: merchant.id,
    apiKey: merchant.apiKey,
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

