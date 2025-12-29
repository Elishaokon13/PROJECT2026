# Openly Architecture

## Why This Structure Works

### 1. domain/ is Sacred

All money logic lives here:
- Ledger invariants
- Balance checks
- Payout state machines

**Nothing in routes/ is allowed to move money directly.**

### 2. routes/ are Thin

Routes:
- Validate input (Zod schemas)
- Call domain/service layer
- Return response

This prevents "fat controllers" — the #1 Node infra failure.

### 3. adapters/ Isolate Vendors

Coinbase CDP, Zerocard, KYC providers never leak into domain logic.

This gives you:
- Provider swap flexibility
- Easier testing
- Cleaner mental model

**Adapters cannot call DB directly** - They receive data, return results, domain handles persistence.

### 4. SDK is First-Class Citizen

SDK lives beside the API, not as an afterthought.

This enforces:
- API discipline
- DX empathy
- Type reuse

**SDK cannot contain business logic** - It's a thin wrapper around API calls.

## Key Domain Modules (What Each Owns)

### domain/ledger
- LedgerEntry
- BalanceSnapshot
- Lock/unlock funds
- Idempotency enforcement

**This is the most important folder in the repo.**

### domain/payouts
- PayoutIntent
- PayoutStateMachine
- Retry logic
- Provider reconciliation

### domain/wallets
- Wallet lifecycle
- Wallet ↔ user binding
- Deposit address abstraction

### domain/identity
- KYC status
- Identity → wallet gating

## Example: How a Payout Should Flow (Correctly)

```
API Route (validate input, extract idempotency key)
   ↓
PayoutService (orchestration)
   ↓
Ledger.lockFunds(amount, userId, idempotencyKey) [ATOMIC]
   ↓
OfframpAdapter.createTransfer(payoutData) [EXTERNAL CALL]
   ↓
WebhookHandler (provider callback)
   ↓
Ledger.settle(idempotencyKey) OR Ledger.release(idempotencyKey)
```

**No shortcuts. No hacks.**

## TypeScript Setup (Non-Negotiable)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

This prevents 80% of fintech bugs.

## Guardrails

### Enforced Rules

1. **No route may mutate balances directly** - All money logic goes through `domain/ledger/`
2. **Ledger must be updated before external calls** - Never call adapters before ledger operations
3. **All money endpoints require idempotency keys** - Every payout, transfer, withdrawal must be idempotent
4. **Adapters cannot call DB directly** - They receive data, return results, domain handles persistence
5. **SDK cannot contain business logic** - It's a thin wrapper around API calls

### Code Review Checklist

- [ ] No direct balance mutations in routes
- [ ] Ledger updated before external calls
- [ ] Idempotency keys on all money endpoints
- [ ] Adapters don't call DB
- [ ] SDK has no business logic
- [ ] No `any` types
- [ ] All optional properties handled correctly

