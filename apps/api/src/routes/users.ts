// User routes - thin layer, delegates to domain/services
// Routes: validate input, call service, return response

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types/index.js';

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
      // TODO: Call UserService.create()
      // const user = await fastify.userService.create({
      //   merchantId: request.merchant.id,
      //   ...request.body,
      // });

      // Placeholder response
      const user = {
        id: 'user-placeholder-id',
        email: request.body.email,
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        createdAt: new Date().toISOString(),
      };

      return reply.status(201).send({ data: user } satisfies ApiResponse<typeof user>);
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
      // TODO: Call UserService.getById()
      // const user = await fastify.userService.getById(request.merchant.id, request.params.userId);

      return reply.send({
        data: {
          id: request.params.userId,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: new Date().toISOString(),
        },
      } satisfies ApiResponse<unknown>);
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
      // TODO: Call UserService.list()
      // const { data, total } = await fastify.userService.list(request.merchant.id, {
      //   limit: request.query.limit,
      //   offset: request.query.offset,
      // });

      return reply.send({
        data: [],
        pagination: {
          limit: request.query.limit,
          offset: request.query.offset,
          total: 0,
          hasMore: false,
        },
      } satisfies PaginatedResponse<unknown>);
    },
  );
}

