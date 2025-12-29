// Idempotency service - wraps IdempotencyService for Fastify injection

import type { FastifyInstance } from 'fastify';
import { IdempotencyService } from '../domain/idempotency/index.js';
import type {
  IdempotencyResult,
  StoreIdempotencyParams,
  CheckIdempotencyParams,
  CompleteIdempotencyParams,
} from '../domain/idempotency/types.js';

export class IdempotencyServiceWrapper {
  private service: IdempotencyService;

  constructor(db: FastifyInstance['db']) {
    this.service = new IdempotencyService(db);
  }

  async checkIdempotency<T = unknown>(
    params: CheckIdempotencyParams,
  ): Promise<IdempotencyResult<T>> {
    return this.service.checkIdempotency<T>(params);
  }

  async storeIdempotency(params: StoreIdempotencyParams): Promise<void> {
    return this.service.storeIdempotency(params);
  }

  async completeIdempotency(params: CompleteIdempotencyParams): Promise<void> {
    return this.service.completeIdempotency(params);
  }

  async failIdempotency(merchantId: string, key: string): Promise<void> {
    return this.service.failIdempotency(merchantId, key);
  }

  async getIdempotencyKey(merchantId: string, key: string) {
    return this.service.getIdempotencyKey(merchantId, key);
  }
}

// Fastify plugin to inject idempotency service
export async function idempotencyServicePlugin(
  fastify: FastifyInstance,
): Promise<void> {
  const idempotencyService = new IdempotencyServiceWrapper(fastify.db);
  fastify.decorate('idempotencyService', idempotencyService);
}

declare module 'fastify' {
  interface FastifyInstance {
    idempotencyService: IdempotencyServiceWrapper;
  }
}

