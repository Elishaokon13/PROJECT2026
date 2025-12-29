# Ledger Domain

The ledger is the **source of truth** for all balances in the Openly system. All money movements must go through this module.

## Architecture

### Double-Entry Ledger

Every transaction creates ledger entries that maintain balance integrity:
- **CREDIT**: Increases available balance (inbound payments)
- **DEBIT**: Decreases available balance (outbound payments, withdrawals)
- **LOCK**: Moves funds from available to locked (pending operations)
- **RELEASE**: Moves funds from locked back to available (cancelled operations)
- **SETTLE**: Finalizes a lock (operation completed)

### Balance Computation

Balances are **computed on-demand** from settled ledger entries, not stored. This ensures:
- Single source of truth
- No balance drift
- Full audit trail

Balance calculation:
```typescript
available = sum(CREDITS) - sum(DEBITS) - sum(LOCKED) + sum(RELEASED)
locked = sum(LOCKED) - sum(RELEASED) - sum(SETTLED)
total = available + locked
```

### Invariants

1. **No negative balances**: Available and locked balances cannot go negative
2. **Atomic operations**: All ledger operations use database transactions
3. **Idempotency**: Operations with idempotency keys are safe to retry
4. **Balance checks**: Debit and lock operations verify sufficient funds before execution

## API

### `credit(params)`
Adds funds to a wallet. Credits are immediately settled.

```typescript
await ledger.credit({
  walletId: 'wallet-id',
  currency: 'USDC',
  amount: '100.50',
  idempotencyKey: 'optional-key',
  description: 'Payment received',
});
```

### `debit(params)`
Removes funds from a wallet. Enforces balance check - throws `InsufficientFundsError` if insufficient.

```typescript
await ledger.debit({
  walletId: 'wallet-id',
  currency: 'USDC',
  amount: '50.00',
  idempotencyKey: 'optional-key',
});
```

### `lockFunds(params)`
Locks funds for a pending operation (e.g., payout). Requires idempotency key.

```typescript
const lockEntry = await ledger.lockFunds({
  walletId: 'wallet-id',
  currency: 'USDC',
  amount: '100.00',
  idempotencyKey: 'payout-123', // Required
  metadata: { payoutId: 'payout-123' },
});
```

### `releaseFunds(params)`
Releases locked funds (operation cancelled/failed).

```typescript
await ledger.releaseFunds({
  lockEntryId: lockEntry.id,
  description: 'Payout cancelled',
});
```

### `settleFunds(params)`
Settles locked funds (operation completed).

```typescript
await ledger.settleFunds({
  lockEntryId: lockEntry.id,
  description: 'Payout completed',
});
```

### `getBalance(walletId, currency)`
Gets current balance for a wallet and currency.

```typescript
const balance = await ledger.getBalance('wallet-id', 'USDC');
// Returns: { available: '100.00', locked: '50.00', total: '150.00' }
```

## Usage in Routes

Routes should use the `ledgerService` injected into Fastify:

```typescript
// In route handler
const balance = await fastify.ledgerService.getBalance(walletId, currency);
```

## Guardrails

- ✅ All balance mutations go through ledger
- ✅ Routes cannot mutate balances directly
- ✅ Adapters cannot mutate balances directly
- ✅ All operations are atomic (database transactions)
- ✅ Balance invariants are enforced
- ✅ Idempotency is supported

