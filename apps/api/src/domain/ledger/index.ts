// Ledger domain logic
// Internal ledger is the source of truth for balances
// All money movements must be recorded here
//
// CRITICAL: This is the most important folder in the repo.
// - All balance mutations MUST go through this module
// - Ledger operations must be atomic
// - Idempotency enforcement lives here
// - Routes/adapters cannot mutate balances directly
//
// Key operations:
// - credit(amount, userId, metadata)
// - debit(amount, userId, metadata)
// - lockFunds(amount, userId, idempotencyKey)
// - settle(idempotencyKey)
// - release(idempotencyKey)
// - getBalance(userId)

