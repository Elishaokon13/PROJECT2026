# Payout Domain - State Machine

Payout orchestration implemented as a state machine with explicit states and atomic ledger operations.

## State Machine

### States

1. **CREATED** - Payout created, funds not yet locked
2. **FUNDS_LOCKED** - Funds locked in ledger, ready for provider call
3. **SENT_TO_PROVIDER** - Sent to off-ramp provider (Zerocard)
4. **COMPLETED** - Successfully completed, funds settled
5. **FAILED** - Failed, funds released

### Valid Transitions

```
CREATED → FUNDS_LOCKED → SENT_TO_PROVIDER → COMPLETED
   ↓           ↓                ↓
 FAILED      FAILED          FAILED
```

**Terminal States:** `COMPLETED`, `FAILED`

## Flow

### Create Payout

```
1. Check idempotency (returns stored response if duplicate)
   ↓
2. Store idempotency key (if new request)
   ↓
3. Create payout record (status: CREATED)
   ↓
4. Lock funds via ledger (atomic)
   ↓
5. Transition to FUNDS_LOCKED
   ↓
6. Call off-ramp adapter (retry-safe)
   ↓
7. Transition to SENT_TO_PROVIDER
   ↓
8. Complete idempotency with response
```

### Provider Webhook (Reconciliation)

```
Provider sends webhook:
  - status: 'completed' → Transition to COMPLETED, settle funds
  - status: 'failed' → Transition to FAILED, release funds
```

### Failure Handling

```
Any state (except terminal) → FAILED:
  - Transition to FAILED state
  - Release funds if locked (via ledger.releaseFunds())
  - Record failure reason
```

## Critical Rules

### 1. Funds Must Be Locked Before Provider Call

**CRITICAL:** External provider calls must NOT happen without locked funds.

```typescript
// ✅ CORRECT: Lock funds first
const lockEntry = await ledgerService.lockFunds({...});
await stateMachine.transitionToFundsLocked({...});
await sendToProvider(...); // Safe to call provider

// ❌ WRONG: Provider call without locked funds
await sendToProvider(...); // NEVER do this
```

### 2. Ledger Updates Must Be Atomic

All ledger operations use database transactions:

```typescript
// Lock funds (atomic)
await ledgerService.lockFunds({...});

// Release funds (atomic)
await ledgerService.releaseFunds({ lockEntryId });

// Settle funds (atomic)
await ledgerService.settleFunds({ lockEntryId });
```

### 3. State Transitions Are Validated

The state machine enforces valid transitions:

```typescript
// ✅ Valid: CREATED → FUNDS_LOCKED
await stateMachine.transitionToFundsLocked({...});

// ❌ Invalid: CREATED → SENT_TO_PROVIDER (skips FUNDS_LOCKED)
await stateMachine.transitionToSentToProvider({...}); // Throws error
```

### 4. Failed Payouts Release Funds

When a payout fails, funds are automatically released:

```typescript
await payoutService.failPayout(payoutId, reason);
// Automatically:
// 1. Transitions to FAILED state
// 2. Releases funds if locked (via ledger.releaseFunds())
```

## API

### `createPayout(params)`

Creates a payout and orchestrates the full flow:

```typescript
const payout = await payoutService.createPayout({
  merchantId: 'merchant-id',
  idempotencyKey: 'key-123',
  walletId: 'wallet-id',
  amount: '100.00',
  currency: 'USDC',
  recipientAccount: 'account-123',
  recipientName: 'John Doe',
});
// Returns payout in SENT_TO_PROVIDER state
```

### `handleProviderWebhook(providerPayoutId, status, error?)`

Handles provider webhooks for state reconciliation:

```typescript
// Provider confirms completion
await payoutService.handleProviderWebhook(
  'provider-payout-123',
  'completed',
);

// Provider reports failure
await payoutService.handleProviderWebhook(
  'provider-payout-123',
  'failed',
  'Insufficient funds',
);
```

### `failPayout(payoutId, reason, providerError?)`

Fails a payout and releases funds:

```typescript
await payoutService.failPayout(
  'payout-id',
  'Provider timeout',
  'Request timed out after 30s',
);
```

### `retryPayout(payoutId)`

Retries a failed payout:

```typescript
const payout = await payoutService.retryPayout('payout-id');
// Re-locks funds and sends to provider again
```

## State Machine Implementation

### `PayoutStateMachine`

Enforces valid state transitions:

```typescript
// Transition: CREATED → FUNDS_LOCKED
await stateMachine.transitionToFundsLocked({
  payoutId: 'payout-id',
  lockEntryId: 'lock-entry-id',
});

// Transition: FUNDS_LOCKED → SENT_TO_PROVIDER
await stateMachine.transitionToSentToProvider({
  payoutId: 'payout-id',
  providerPayoutId: 'provider-payout-123',
});

// Transition: SENT_TO_PROVIDER → COMPLETED
await stateMachine.transitionToCompleted({
  payoutId: 'payout-id',
  providerStatus: 'completed',
});

// Transition: Any → FAILED
await stateMachine.transitionToFailed({
  payoutId: 'payout-id',
  reason: 'Provider error',
  providerError: 'Insufficient funds',
});
```

## Guardrails

- ✅ External provider calls only happen after funds are locked
- ✅ Ledger updates are atomic (database transactions)
- ✅ State transitions are validated
- ✅ Failed payouts automatically release funds
- ✅ Provider webhooks reconcile final state
- ✅ Retry logic for provider calls (TODO: implement exponential backoff)
- ✅ State history tracked for auditability

## Database Schema

```prisma
model Payout {
  id              String       @id @default(uuid())
  status          PayoutStatus @default(CREATED)
  lockEntryId     String?
  providerPayoutId String?
  stateHistory    Json?
  retryCount      Int          @default(0)
  ...
}

enum PayoutStatus {
  CREATED
  FUNDS_LOCKED
  SENT_TO_PROVIDER
  COMPLETED
  FAILED
}
```

