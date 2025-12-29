# Identity Domain

Identity verification (KYC) domain logic. Enforces verified identity before wallet creation.

## Architecture

### Identity Verification Flow

```
1. User submits verification request
   ↓
2. Create IdentityVerification record (status: PENDING)
   ↓
3. Submit to KYC provider via adapter
   ↓
4. Provider processes verification (async)
   ↓
5. Provider sends webhook with result
   ↓
6. Update verification status:
   - VERIFIED → User can create wallets
   - REJECTED → User cannot create wallets
```

### Wallet Creation Gating

**CRITICAL:** Wallet creation requires verified identity.

```typescript
// WalletService.createWallet() checks:
const isVerified = await identityService.isUserVerified(userId);
if (!isVerified) {
  throw new ValidationError('User must have verified identity');
}
```

## API

### `isUserVerified(userId)`

Checks if user has verified identity status.

```typescript
const isVerified = await identityService.isUserVerified('user-id');
// Returns: true if status === 'VERIFIED', false otherwise
```

### `getVerification(userId)`

Gets identity verification record for a user.

```typescript
const verification = await identityService.getVerification('user-id');
// Returns: IdentityVerification | null
```

### `createVerification(params)`

Creates identity verification record (status: PENDING).

```typescript
const verification = await identityService.createVerification({
  userId: 'user-id',
  provider: 'kyc-provider',
});
```

### `verifyUser(userId, providerId, metadata?)`

Marks user as verified (called by adapter after successful verification).

```typescript
await identityService.verifyUser('user-id', 'provider-verification-123');
```

### `rejectUser(userId, reason?)`

Marks user as rejected (called by adapter after failed verification).

```typescript
await identityService.rejectUser('user-id', 'Document verification failed');
```

## Identity Adapter

Abstracts KYC provider operations:

```typescript
interface IdentityAdapter {
  submitVerification(params): Promise<string>; // Returns provider ID
  checkStatus(providerId): Promise<VerificationStatusResult>;
  handleWebhook(payload): Promise<WebhookResult>;
}
```

**Guardrails:**
- Adapters isolate vendor-specific details
- Adapters cannot call DB directly
- Domain handles persistence

## Verification Status

- **PENDING** - Verification submitted, awaiting provider response
- **VERIFIED** - Identity verified, user can create wallets
- **REJECTED** - Identity verification failed, user cannot create wallets
- **EXPIRED** - Verification expired, user must re-verify

## Database Schema

```prisma
model IdentityVerification {
  id         String   @id @default(uuid())
  userId     String   @unique
  status     VerificationStatus @default(PENDING)
  provider   String?
  providerId String?
  verifiedAt DateTime?
  metadata   Json?
}

enum VerificationStatus {
  PENDING
  VERIFIED
  REJECTED
  EXPIRED
}
```

## Routes

### `POST /api/v1/identity/verify`

Submit identity verification request.

```json
{
  "userId": "user-uuid",
  "userData": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "dateOfBirth": "1990-01-01",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "country": "US",
      "postalCode": "10001"
    }
  }
}
```

### `GET /api/v1/identity/verify/:userId`

Get verification status for a user.

## Guardrails

- ✅ Wallet creation requires verified identity
- ✅ Identity status is stored and auditable
- ✅ Identity adapter abstracts provider details
- ✅ Provider webhooks update verification status
- ✅ Verification status cannot be bypassed

