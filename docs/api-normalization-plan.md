# API Normalization Plan

## Current State Analysis

### Endpoints Review

**Users:**
- ✅ `POST /api/v1/users` - Good
- ✅ `GET /api/v1/users/:userId` - Good
- ✅ `GET /api/v1/users` - Good

**Identity:**
- ✅ `POST /api/v1/identity/verify` - Good
- ✅ `GET /api/v1/identity/verify/:userId` - Good

**Wallets:**
- ✅ `POST /api/v1/wallets` - Good
- ✅ `GET /api/v1/wallets/:walletId` - Good
- ✅ `GET /api/v1/wallets/:walletId/balance` - Good

**Payouts:**
- ✅ `POST /api/v1/payouts` - Good (requires idempotency key)
- ✅ `GET /api/v1/payouts/:payoutId` - Good

**Webhooks:**
- ✅ `GET /api/v1/webhooks/:webhookId` - Good
- ✅ `GET /api/v1/webhooks` - Good
- ⚠️ `POST /api/v1/webhooks/provider/:provider` - INTERNAL (not public API)

## Required Changes

### 1. Field Naming Normalization

**Current (camelCase):** → **Target (snake_case):**
- `firstName` → `first_name`
- `lastName` → `last_name`
- `phoneNumber` → `phone_number`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`
- `walletId` → `wallet_id`
- `userId` → `user_id`
- `recipientAccount` → `recipient_account`
- `recipientName` → `recipient_name`
- `recipientBankCode` → `recipient_bank_code`
- `lockEntryId` → **REMOVE** (internal)
- `providerPayoutId` → **REMOVE** (internal)
- `idempotencyKey` → **REMOVE** from responses (internal)

### 2. Resource ID Prefixes

Add Stripe-style prefixes:
- Users: `user_abc123`
- Wallets: `wallet_def456`
- Payouts: `payout_ghi789`
- Webhooks: `evt_jkl012`

### 3. Response Cleanup

**Remove from public responses:**
- `lockEntryId` (internal ledger concept)
- `providerPayoutId` (internal provider detail)
- `idempotencyKey` (internal, only in errors)
- Internal state machine states (expose only: pending, processing, completed, failed)

### 4. Status Values Normalization

**Payout Status:**
- Current: `CREATED`, `FUNDS_LOCKED`, `SENT_TO_PROVIDER`, `COMPLETED`, `FAILED`
- Public: `pending`, `processing`, `completed`, `failed`

**Identity Status:**
- Current: `PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED`
- Public: `pending`, `verified`, `rejected`, `expired`

### 5. Error Code Standardization

Ensure all errors use consistent codes:
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `INSUFFICIENT_FUNDS` (400)
- `IDEMPOTENCY_KEY_CONFLICT` (409)
- `INTERNAL_ERROR` (500)
- `PROVIDER_ERROR` (502)

## Implementation Tasks

1. Create API response transformers (internal → public)
2. Update route handlers to use transformers
3. Add ID prefixing logic
4. Update SDK types to match public API
5. Create migration guide for API changes

