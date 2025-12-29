// Openly SDK Client
// Thin HTTP wrapper around Openly API
// CRITICAL: No business logic - just HTTP calls and type safety

import type {
  ApiResponse,
  PaginatedResponse,
  User,
  CreateUserParams,
  IdentityVerification,
  SubmitVerificationParams,
  Wallet,
  CreateWalletParams,
  Balance,
  Payout,
  CreatePayoutParams,
  WebhookEvent,
} from './types/api.js';

export interface OpenlyConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export class OpenlyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OpenlyError';
  }
}

export class Openly {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: OpenlyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.openly.com';
    this.timeout = config.timeout ?? 30000;
  }

  // Users resource
  readonly users = {
    create: async (params: CreateUserParams): Promise<User> => {
      const response = await this.request<User>('POST', '/api/v1/users', params);
      return response.data;
    },

    get: async (userId: string): Promise<User> => {
      const response = await this.request<User>('GET', `/api/v1/users/${userId}`);
      return response.data;
    },

    list: async (params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<User>> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.offset) query.set('offset', params.offset.toString());
      const url = `/api/v1/users${query.toString() ? `?${query.toString()}` : ''}`;
      return this.request<PaginatedResponse<User>>('GET', url);
    },
  };

  // Identity resource
  readonly identity = {
    verify: async (params: SubmitVerificationParams): Promise<{ verification_id: string; provider_id: string; status: string }> => {
      const response = await this.request<{ verification_id: string; provider_id: string; status: string }>(
        'POST',
        '/api/v1/identity/verify',
        params,
      );
      return response.data;
    },

    getStatus: async (userId: string): Promise<IdentityVerification> => {
      const response = await this.request<IdentityVerification>('GET', `/api/v1/identity/verify/${userId}`);
      return response.data;
    },
  };

  // Wallets resource
  readonly wallets = {
    create: async (params: CreateWalletParams): Promise<Wallet> => {
      const response = await this.request<Wallet>('POST', '/api/v1/wallets', params);
      return response.data;
    },

    get: async (walletId: string): Promise<Wallet> => {
      const response = await this.request<Wallet>('GET', `/api/v1/wallets/${walletId}`);
      return response.data;
    },

    getBalance: async (walletId: string): Promise<Balance> => {
      const response = await this.request<Balance>('GET', `/api/v1/wallets/${walletId}/balance`);
      return response.data;
    },
  };

  // Payouts resource
  readonly payouts = {
    create: async (params: CreatePayoutParams, idempotencyKey?: string): Promise<Payout> => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      } else {
        // Auto-generate idempotency key
        headers['Idempotency-Key'] = this.generateIdempotencyKey();
      }

      const response = await this.request<Payout>('POST', '/api/v1/payouts', params, headers);
      return response.data;
    },

    get: async (payoutId: string): Promise<Payout> => {
      const response = await this.request<Payout>('GET', `/api/v1/payouts/${payoutId}`);
      return response.data;
    },
  };

  // Webhooks resource
  readonly webhooks = {
    list: async (params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<WebhookEvent>> => {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.offset) query.set('offset', params.offset.toString());
      const url = `/api/v1/webhooks${query.toString() ? `?${query.toString()}` : ''}`;
      return this.request<PaginatedResponse<WebhookEvent>>('GET', url);
    },

    get: async (webhookId: string): Promise<WebhookEvent> => {
      const response = await this.request<WebhookEvent>('GET', `/api/v1/webhooks/${webhookId}`);
      return response.data;
    },
  };

  // Internal HTTP request method
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    additionalHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    const options: RequestInit = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        const error = data as { error: { code: string; message: string; details?: unknown } };
        throw new OpenlyError(
          error.error.code,
          error.error.message,
          response.status,
          error.error.details,
        );
      }

      return data as ApiResponse<T>;
    } catch (error) {
      if (error instanceof OpenlyError) {
        throw error;
      }
      throw new OpenlyError('NETWORK_ERROR', `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate idempotency key (UUID v4)
  private generateIdempotencyKey(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
