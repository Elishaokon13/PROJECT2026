# Openly Public API Contract (v1)

**Status:** FROZEN - This is the public API merchants will rely on.

## Base URL
```
https://api.openly.com/api/v1
```

## Authentication
All endpoints require API key authentication:
```
Authorization: Bearer <api_key>
```

## Response Envelope

### Success Response
```json
{
  "data": { ... }
}
```

### Paginated Response
```json
{
  "data": [ ... ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100,
    "has_more": true
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... } // Optional, for validation errors
  }
}
```

## Error Codes

### Client Errors (4xx)
- `UNAUTHORIZED` (401) - Missing or invalid API key
- `FORBIDDEN` (403) - API key lacks permission
- `NOT_FOUND` (404) - Resource not found
- `VALIDATION_ERROR` (400) - Request validation failed
- `INSUFFICIENT_FUNDS` (400) - Insufficient balance for operation
- `IDEMPOTENCY_KEY_CONFLICT` (409) - Idempotency key conflict

### Server Errors (5xx)
- `INTERNAL_ERROR` (500) - Internal server error
- `PROVIDER_ERROR` (502) - External provider error
- `WEBHOOK_PROCESSING_ERROR` (500) - Webhook processing failed

## Resources

### Users

#### Create User
```http
POST /api/v1/users
```

**Request:**
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+1234567890",
    "metadata": {},
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Get User
```http
GET /api/v1/users/:userId
```

**Response (200):**
```json
{
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+1234567890",
    "metadata": {},
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### List Users
```http
GET /api/v1/users?limit=20&offset=0
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "user_abc123",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100,
    "has_more": true
  }
}
```

### Identity Verification

#### Submit Verification
```http
POST /api/v1/identity/verify
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "user_data": {
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+1234567890",
    "date_of_birth": "1990-01-01",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "country": "US",
      "postal_code": "10001"
    },
    "document_type": "passport",
    "document_number": "ABC123456"
  }
}
```

**Response (201):**
```json
{
  "data": {
    "verification_id": "ver_xyz789",
    "provider_id": "provider_123",
    "status": "pending"
  }
}
```

#### Get Verification Status
```http
GET /api/v1/identity/verify/:userId
```

**Response (200):**
```json
{
  "data": {
    "id": "ver_xyz789",
    "user_id": "user_abc123",
    "status": "verified",
    "verified_at": "2024-01-01T00:00:00Z"
  }
}
```

### Wallets

#### Create Wallet
```http
POST /api/v1/wallets
```

**Request:**
```json
{
  "user_id": "user_abc123",
  "currency": "USDC"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "wallet_def456",
    "user_id": "user_abc123",
    "currency": "USDC",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `VALIDATION_ERROR` (400) - User identity not verified

#### Get Wallet
```http
GET /api/v1/wallets/:walletId
```

**Response (200):**
```json
{
  "data": {
    "id": "wallet_def456",
    "user_id": "user_abc123",
    "currency": "USDC",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Get Balance
```http
GET /api/v1/wallets/:walletId/balance
```

**Response (200):**
```json
{
  "data": {
    "wallet_id": "wallet_def456",
    "currency": "USDC",
    "available": "100.50",
    "locked": "50.00",
    "total": "150.50"
  }
}
```

### Payouts

#### Create Payout
```http
POST /api/v1/payouts
Headers:
  Idempotency-Key: <unique-key>
```

**Request:**
```json
{
  "wallet_id": "wallet_def456",
  "amount": "100.00",
  "currency": "USDC",
  "recipient_account": "1234567890",
  "recipient_name": "John Doe",
  "recipient_bank_code": "044",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "data": {
    "id": "payout_ghi789",
    "wallet_id": "wallet_def456",
    "amount": "100.00",
    "currency": "USDC",
    "status": "pending",
    "recipient_account": "1234567890",
    "recipient_name": "John Doe",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Status Values:**
- `pending` - Payout created, processing
- `processing` - Sent to provider
- `completed` - Successfully completed
- `failed` - Failed

**Errors:**
- `INSUFFICIENT_FUNDS` (400) - Insufficient balance
- `IDEMPOTENCY_KEY_CONFLICT` (409) - Key already used with different payload

#### Get Payout
```http
GET /api/v1/payouts/:payoutId
```

**Response (200):**
```json
{
  "data": {
    "id": "payout_ghi789",
    "wallet_id": "wallet_def456",
    "amount": "100.00",
    "currency": "USDC",
    "status": "completed",
    "recipient_account": "1234567890",
    "recipient_name": "John Doe",
    "created_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-01T01:00:00Z"
  }
}
```

### Webhooks (Outbound)

#### List Webhook Events
```http
GET /api/v1/webhooks?limit=20&offset=0
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "evt_jkl012",
      "event": "payout.completed",
      "status": "delivered",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100,
    "has_more": true
  }
}
```

#### Get Webhook Event
```http
GET /api/v1/webhooks/:webhookId
```

**Response (200):**
```json
{
  "data": {
    "id": "evt_jkl012",
    "event": "payout.completed",
    "payload": {
      "id": "payout_ghi789",
      "status": "completed"
    },
    "status": "delivered",
    "created_at": "2024-01-01T00:00:00Z",
    "delivered_at": "2024-01-01T00:00:01Z"
  }
}
```

## Webhook Events (Merchant Receives)

Merchants receive webhooks at their configured endpoint.

### Event: `payout.completed`
```json
{
  "id": "evt_jkl012",
  "event": "payout.completed",
  "data": {
    "id": "payout_ghi789",
    "wallet_id": "wallet_def456",
    "amount": "100.00",
    "currency": "USDC",
    "status": "completed",
    "completed_at": "2024-01-01T01:00:00Z"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Event: `payout.failed`
```json
{
  "id": "evt_jkl013",
  "event": "payout.failed",
  "data": {
    "id": "payout_ghi789",
    "wallet_id": "wallet_def456",
    "amount": "100.00",
    "currency": "USDC",
    "status": "failed",
    "failure_reason": "Insufficient funds"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Event: `payment.received`
```json
{
  "id": "evt_jkl014",
  "event": "payment.received",
  "data": {
    "wallet_id": "wallet_def456",
    "amount": "50.00",
    "currency": "USDC",
    "transaction_hash": "0x..."
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Design Principles

1. **No Internal Concepts**: Public API never exposes:
   - Ledger entries
   - Lock entries
   - Provider IDs
   - Internal state machine states
   - Idempotency keys (except in errors)

2. **Stripe/Paystack Style**:
   - Resource IDs prefixed (`user_`, `wallet_`, `payout_`)
   - Snake_case for JSON fields
   - Consistent status values
   - Clear error messages

3. **Idempotency**:
   - Required for money-moving endpoints
   - Automatic key generation in SDK
   - Manual key support for advanced users

4. **Pagination**:
   - Cursor-based (future) or offset-based (MVP)
   - Consistent `has_more` field

