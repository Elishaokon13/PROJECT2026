// Database plugin - injects Prisma client into Fastify instance
// TODO: Replace with actual Prisma client once schema is defined

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

// Placeholder Prisma client type
// This will be replaced with actual Prisma client import
export interface PrismaClient {
  // Will be generated from schema.prisma
  // For now, this is a placeholder
}

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

export async function dbPlugin(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // TODO: Initialize Prisma client from @openly/db package
  // const { PrismaClient } = await import('@openly/db');
  // const prisma = new PrismaClient();

  // Placeholder for now
  const prisma = {} as PrismaClient;

  // Decorate Fastify instance with Prisma client
  fastify.decorate('db', prisma);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    // await prisma.$disconnect();
  });
}

