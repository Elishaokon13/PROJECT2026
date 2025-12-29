// Shared TypeScript types for Openly API

import type { FastifyRequest } from 'fastify';

// Request context with authenticated merchant
export interface AuthenticatedRequest extends FastifyRequest {
  merchant: {
    id: string;
    apiKey: string;
  };
}

// Request with idempotency key (for money-moving endpoints)
export interface IdempotentRequest extends AuthenticatedRequest {
  idempotencyKey: string;
}

// Pagination
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// Money types (using strings to avoid floating point issues)
export type MoneyAmount = string; // Decimal string, e.g. "100.50"
export type Currency = 'USDC' | 'USDT' | 'NGN';

// Common response wrapper
export interface ApiResponse<T> {
  data: T;
}

// Error response (matches error handler)
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
