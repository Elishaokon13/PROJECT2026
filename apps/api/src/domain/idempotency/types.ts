// Idempotency domain types

export type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyResult<T = unknown> {
  isDuplicate: boolean;
  response?: {
    statusCode: number;
    body: T;
    headers?: Record<string, string>;
  };
}

export interface StoreIdempotencyParams {
  merchantId: string;
  key: string;
  requestMethod: string;
  requestPath: string;
  requestBody: unknown;
}

export interface CheckIdempotencyParams {
  merchantId: string;
  key: string;
  requestMethod: string;
  requestPath: string;
  requestBody: unknown;
}

export interface CompleteIdempotencyParams {
  merchantId: string;
  key: string;
  statusCode: number;
  responseBody: unknown;
  responseHeaders?: Record<string, string>;
}

