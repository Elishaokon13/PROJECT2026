// Identity adapter types
// Abstracts KYC provider-specific details

export interface IdentityAdapter {
  /**
   * Submit verification request to provider
   * Returns provider verification ID
   */
  submitVerification(params: SubmitVerificationParams): Promise<string>;

  /**
   * Check verification status with provider
   * Returns current status and provider data
   */
  checkStatus(providerId: string): Promise<VerificationStatusResult>;

  /**
   * Handle provider webhook
   * Processes webhook from KYC provider
   */
  handleWebhook(payload: unknown): Promise<WebhookResult>;
}

export interface SubmitVerificationParams {
  userId: string;
  userData: {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    address?: {
      street: string;
      city: string;
      country: string;
      postalCode?: string;
    };
    documentType?: string;
    documentNumber?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface VerificationStatusResult {
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  providerId: string;
  providerData?: Record<string, unknown>;
  error?: string;
}

export interface WebhookResult {
  providerId: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  userId?: string; // If provider includes user identifier
  metadata?: Record<string, unknown>;
}

