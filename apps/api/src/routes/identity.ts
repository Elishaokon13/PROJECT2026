// Identity verification routes

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const submitVerificationSchema = z.object({
  userId: z.string().uuid(),
  userData: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phoneNumber: z.string().optional(),
    dateOfBirth: z.string().optional(),
    address: z
      .object({
        street: z.string(),
        city: z.string(),
        country: z.string(),
        postalCode: z.string().optional(),
      })
      .optional(),
    documentType: z.string().optional(),
    documentNumber: z.string().optional(),
  }),
});

const getVerificationParamsSchema = z.object({
  userId: z.string().uuid(),
});

export async function identityRoutes(fastify: FastifyInstance): Promise<void> {
  // Submit identity verification
  fastify.post<{ Body: z.infer<typeof submitVerificationSchema> }>(
    '/identity/verify',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: submitVerificationSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // Verify user belongs to merchant
      const user = await fastify.db.user.findFirst({
        where: {
          id: request.body.userId,
          merchantId: request.merchant.id,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `User with id ${request.body.userId} not found`,
          },
        });
      }

      const result = await fastify.identityService.submitVerification(
        request.body.userId,
        request.body.userData,
      );

      return reply.status(201).send({
        data: result,
      } satisfies ApiResponse<typeof result>);
    },
  );

  // Get verification status
  fastify.get<{ Params: z.infer<typeof getVerificationParamsSchema> }>(
    '/identity/verify/:userId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: getVerificationParamsSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      // Verify user belongs to merchant
      const user = await fastify.db.user.findFirst({
        where: {
          id: request.params.userId,
          merchantId: request.merchant.id,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `User with id ${request.params.userId} not found`,
          },
        });
      }

      const verification = await fastify.identityService.getVerification(request.params.userId);

      if (!verification) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Identity verification for user ${request.params.userId} not found`,
          },
        });
      }

      return reply.send({
        data: verification,
      } satisfies ApiResponse<typeof verification>);
    },
  );
}

