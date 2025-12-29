// KYC provider adapter
// Abstracts identity verification operations
//
// GUARDRAIL: Adapters isolate vendors - no domain logic here.
// - Abstract provider-specific details
// - Handle provider errors and retries
// - Return domain-friendly types
// - Cannot call DB directly (receive data, return results, domain handles persistence)

export { IdentityAdapterImpl } from './identity-adapter.js';
export type {
  IdentityAdapter,
  SubmitVerificationParams,
  VerificationStatusResult,
  WebhookResult,
} from './types.js';
