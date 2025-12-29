// Identity verification routes

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { fromPublicId } from '../lib/publicIds.js';
import { transformIdentityVerification } from '../transformers/identityTransformer.js';

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
      // Convert public user ID to internal ID
      const internalUserId = fromPublicId('user', request.body.userId);
      
      // Verify user belongs to merchant
      const user = await fastify.db.user.findFirst({
        where: {
          id: internalUserId,
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
        internalUserId,
        request.body.userData,
      );

      // Get full verification from DB to transform
      const verification = await fastify.db.identityVerification.findUnique({
        where: { userId: internalUserId },
      });

      if (!verification) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Verification submitted but not found',
          },
        });
      }

      return reply.status(201).send({
        data: {
          verification_id: result.verificationId,
          provider_id: result.providerId,
          status: 'pending',
        },
      });
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
      // Convert public user ID to internal ID
      const internalUserId = fromPublicId('user', request.params.userId);
      
      // Verify user belongs to merchant
      const user = await fastify.db.user.findFirst({
        where: {
          id: internalUserId,
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

      const verification = await fastify.identityService.getVerification(internalUserId);

      if (!verification) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Identity verification for user ${request.params.userId} not found`,
          },
        });
      }

      // Get full verification from DB to transform
      const fullVerification = await fastify.db.identityVerification.findUnique({
        where: { userId: internalUserId },
      });

      if (!fullVerification) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Identity verification for user ${request.params.userId} not found`,
          },
        });
      }

      return reply.send({
        data: transformIdentityVerification(fullVerification),
      });
    },
  );
}

