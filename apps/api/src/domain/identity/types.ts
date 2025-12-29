// Identity domain types

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface IdentityVerification {
  id: string;
  userId: string;
  status: VerificationStatus;
  provider: string | null;
  providerId: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVerificationParams {
  userId: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitVerificationParams {
  userId: string;
  providerData: Record<string, unknown>; // Provider-specific verification data
}

export interface UpdateVerificationStatusParams {
  verificationId: string;
  status: VerificationStatus;
  providerId?: string;
  metadata?: Record<string, unknown>;
}

