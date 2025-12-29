// User routes - thin layer, delegates to domain/services
// Routes: validate input, call service, return response

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types/index.js';
import { transformUser } from '../transformers/user-transformer.js';
import { fromPublicId } from '../lib/publicIds.js';

// Request/Response schemas
const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phoneNumber: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const getUserParamsSchema = z.object({
  userId: z.string().uuid(),
});

const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Create user
  fastify.post<{ Body: z.infer<typeof createUserSchema> }>(
    '/users',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: createUserSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // Call UserService.create()
      const user = await fastify.userService.createUser({
        merchantId: request.merchant.id,
        email: request.body.email,
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        phoneNumber: request.body.phoneNumber,
        metadata: request.body.metadata,
      });

      return reply.status(201).send({ data: transformUser(user) });
    },
  );

  // Get user
  fastify.get<{ Params: z.infer<typeof getUserParamsSchema> }>(
    '/users/:userId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: getUserParamsSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // Convert public ID to internal ID
      const internalUserId = fromPublicId('user', request.params.userId);
      const user = await fastify.userService.getUserById(
        request.merchant.id,
        internalUserId,
      );

      if (!user) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `User with id ${request.params.userId} not found`,
          },
        });
      }

      return reply.send({ data: transformUser(user) });
    },
  );

  // List users
  fastify.get<{ Querystring: z.infer<typeof listUsersQuerySchema> }>(
    '/users',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: listUsersQuerySchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const result = await fastify.userService.listUsers({
        merchantId: request.merchant.id,
        limit: request.query.limit,
        offset: request.query.offset,
      });

      return reply.send({
        data: result.data.map(transformUser),
        pagination: result.pagination,
      });
    },
  );
}

