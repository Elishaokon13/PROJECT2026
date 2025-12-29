// Error taxonomy for Openly API
// All errors extend from base AppError for consistent handling

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Domain Errors
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', `${resource}${id ? ` with id ${id}` : ''} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

// Ledger Errors
export class InsufficientFundsError extends AppError {
  constructor(available: string, requested: string) {
    super(400, 'INSUFFICIENT_FUNDS', `Insufficient funds. Available: ${available}, Requested: ${requested}`);
  }
}

export class IdempotencyKeyError extends AppError {
  constructor(message: string) {
    super(409, 'IDEMPOTENCY_KEY_CONFLICT', message);
  }
}

// Provider Errors
export class ProviderError extends AppError {
  constructor(provider: string, message: string, details?: unknown) {
    super(502, 'PROVIDER_ERROR', `${provider}: ${message}`, details);
  }
}

// Webhook Errors
export class WebhookError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'WEBHOOK_ERROR', message, details);
  }
}

// Error handler for Fastify
export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  const app = request.server;

  // Log error
  app.log.error({
    err: error,
    url: request.url,
    method: request.method,
  });

  // Handle known AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.issues,
      },
    });
  }

  // Handle Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.validation,
      },
    });
  }

  // Unknown error
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: app.config.nodeEnv === 'production' ? 'Internal server error' : error.message,
    },
  });
}

// Type imports for error handler
import type { FastifyRequest, FastifyReply } from 'fastify';
