// Payout domain logic
// Handles stablecoin → fiat off-ramp operations
//
// Key responsibilities:
// - PayoutIntent creation and validation
// - PayoutStateMachine (pending → processing → completed/failed)
// - Retry logic for failed payouts
// - Provider reconciliation
//
// Flow:
// 1. Create PayoutIntent (with idempotency key)
// 2. Lock funds via Ledger.lockFunds()
// 3. Call OfframpAdapter.createTransfer()
// 4. Handle webhook → Ledger.settle() or Ledger.release()

