// Public API types - matches API contract exactly
// These types are the source of truth for SDK

// Base types
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// User types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateUserParams {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  metadata?: Record<string, unknown>;
}

// Identity types
export interface IdentityVerification {
  id: string;
  user_id: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  verified_at: string | null;
}

export interface SubmitVerificationParams {
  user_id: string;
  user_data: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    date_of_birth?: string;
    address?: {
      street: string;
      city: string;
      country: string;
      postal_code?: string;
    };
    document_type?: string;
    document_number?: string;
  };
}

// Wallet types
export interface Wallet {
  id: string;
  user_id: string;
  currency: 'USDC' | 'USDT';
  address: string;
  created_at: string;
}

export interface CreateWalletParams {
  user_id: string;
  currency?: 'USDC' | 'USDT';
}

export interface Balance {
  wallet_id: string;
  currency: 'USDC' | 'USDT';
  available: string;
  locked: string;
  total: string;
}

// Payout types
export interface Payout {
  id: string;
  wallet_id: string;
  amount: string;
  currency: 'USDC' | 'USDT';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  recipient_account: string;
  recipient_name: string;
  recipient_bank_code?: string;
  created_at: string;
  completed_at?: string;
  failure_reason?: string;
}

export interface CreatePayoutParams {
  wallet_id: string;
  amount: string;
  currency: 'USDC' | 'USDT';
  recipient_account: string;
  recipient_name: string;
  recipient_bank_code?: string;
  metadata?: Record<string, unknown>;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  event: string;
  data: unknown;
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
  delivered_at?: string;
}

// Webhook payload types (what merchants receive)
export interface PayoutCompletedEvent {
  id: string;
  event: 'payout.completed';
  data: {
    id: string;
    wallet_id: string;
    amount: string;
    currency: 'USDC' | 'USDT';
    status: 'completed';
    completed_at: string;
  };
  created_at: string;
}

export interface PayoutFailedEvent {
  id: string;
  event: 'payout.failed';
  data: {
    id: string;
    wallet_id: string;
    amount: string;
    currency: 'USDC' | 'USDT';
    status: 'failed';
    failure_reason: string;
  };
  created_at: string;
}

export interface PaymentReceivedEvent {
  id: string;
  event: 'payment.received';
  data: {
    wallet_id: string;
    amount: string;
    currency: 'USDC' | 'USDT';
    transaction_hash: string;
  };
  created_at: string;
}

export type WebhookPayload = PayoutCompletedEvent | PayoutFailedEvent | PaymentReceivedEvent;

