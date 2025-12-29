// Identity domain
// Handles identity verification and KYC status
// CRITICAL: Wallet creation requires verified identity

export { IdentityService } from './identity.js';
export type {
  VerificationStatus,
  IdentityVerification,
  CreateVerificationParams,
  SubmitVerificationParams,
  UpdateVerificationStatusParams,
} from './types.js';
