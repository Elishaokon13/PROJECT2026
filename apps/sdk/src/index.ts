// Openly SDK - Primary interface for merchants
// The SDK is the product - API is the implementation

export { Openly, OpenlyError } from './client.js';
export type { OpenlyConfig } from './client.js';
export { WebhookVerifier } from './webhooks.js';
export type { WebhookConfig } from './webhooks.js';

// Export all public API types
export type {
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
  WebhookPayload,
  PayoutCompletedEvent,
  PayoutFailedEvent,
  PaymentReceivedEvent,
  ApiResponse,
  PaginatedResponse,
  ApiError,
} from './types/api.js';
