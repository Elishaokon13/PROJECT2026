# Idempotency Domain

Persistent idempotency handling for money-moving endpoints. Ensures safe retries and prevents duplicate operations.

## Architecture

### Key Features

1. **Persistent Storage**: Idempotency keys stored in PostgreSQL
2. **Request Hash Validation**: SHA-256 hash of request body prevents payload changes
3. **Merchant Scoping**: Keys are scoped per merchant (prevents cross-merchant conflicts)
4. **Response Replay**: Duplicate requests return stored response
5. **Domain-Level Enforcement**: Idempotency checked at service level, not just middleware

### Flow

```
1. Request arrives with Idempotency-Key header
   ↓
2. Middleware validates format and extracts key
   ↓
3. Service checks idempotency:
   - If duplicate with same payload → return stored response
   - If duplicate with different payload → throw error
   - If new request → store key and proceed
   ↓
4. Execute operation (e.g., lock funds, create payout)
   ↓
5. Store response and mark idempotency as COMPLETED
```

## API

### `checkIdempotency(params)`

Checks if idempotency key exists and validates request payload.

```typescript
const result = await idempotencyService.checkIdempotency({
  merchantId: 'merchant-id',
  key: 'idempotency-key',
  requestMethod: 'POST',
  requestPath: '/api/v1/payouts',
  requestBody: { ... },
});

if (result.isDuplicate) {
  // Return stored response
  return result.response.body;
}
```

**Behavior:**
- Returns `{ isDuplicate: false }` if key doesn't exist
- Returns stored response if key exists with same payload
- Throws `IdempotencyKeyError` if key exists with different payload
- Throws `IdempotencyKeyError` if request is in progress (PENDING)

### `storeIdempotency(params)`

Stores idempotency key for a new request (status: PENDING).

```typescript
await idempotencyService.storeIdempotency({
  merchantId: 'merchant-id',
  key: 'idempotency-key',
  requestMethod: 'POST',
  requestPath: '/api/v1/payouts',
  requestBody: { ... },
});
```

**Behavior:**
- Creates record with PENDING status
- Handles race conditions (unique constraint violations)
- Validates payload if key already exists

### `completeIdempotency(params)`

Marks idempotency key as completed with response.

```typescript
await idempotencyService.completeIdempotency({
  merchantId: 'merchant-id',
  key: 'idempotency-key',
  statusCode: 201,
  responseBody: { ... },
  responseHeaders: { ... }, // optional
});
```

### `failIdempotency(merchantId, key)`

Marks idempotency key as failed (allows retry).

```typescript
await idempotencyService.failIdempotency('merchant-id', 'idempotency-key');
```

## Request Hash Validation

The service computes a SHA-256 hash of the request body to detect payload changes:

```typescript
const requestHash = createHash('sha256')
  .update(JSON.stringify(requestBody, sortedKeys))
  .digest('hex');
```

**Rules:**
- Same key + same hash = duplicate request → return stored response
- Same key + different hash = error → reject request
- Same key + different method/path = error → reject request

## Merchant Scoping

Idempotency keys are scoped per merchant using a composite unique constraint:

```prisma
@@unique([merchantId, key])
```

This ensures:
- Different merchants can use the same key value
- Same merchant cannot reuse the same key with different payload
- No cross-merchant conflicts

## Integration with Payout Service

The payout service integrates idempotency at the domain level:

```typescript
// 1. Check idempotency
const check = await idempotencyService.checkIdempotency({...});
if (check.isDuplicate) {
  return check.response.body; // Return stored response
}

// 2. Store idempotency key
await idempotencyService.storeIdempotency({...});

try {
  // 3. Execute operation
  const payout = await createPayout(...);
  
  // 4. Complete idempotency
  await idempotencyService.completeIdempotency({
    statusCode: 201,
    responseBody: payout,
  });
  
  return payout;
} catch (error) {
  // 5. Mark as failed on error
  await idempotencyService.failIdempotency(merchantId, key);
  throw error;
}
```

## Guardrails

- ✅ Idempotency enforced at domain/service level
- ✅ Keys scoped per merchant
- ✅ Request hash validation prevents payload changes
- ✅ Stored responses replayed for duplicate requests
- ✅ Race conditions handled (unique constraint violations)
- ✅ Failed requests can be retried

## Database Schema

```prisma
model IdempotencyKey {
  id              String   @id @default(uuid())
  merchantId      String
  key             String
  requestHash     String   // SHA-256 hash of request body
  requestMethod   String
  requestPath     String
  statusCode      Int
  responseBody    Json
  status          IdempotencyStatus
  completedAt     DateTime?
  
  @@unique([merchantId, key])
}
```

