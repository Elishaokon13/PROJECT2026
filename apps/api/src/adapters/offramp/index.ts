// Zerocard off-ramp adapter
// Abstracts payout provider operations
//
// GUARDRAIL: Adapters isolate vendors - no domain logic here.
// - Abstract provider-specific details
// - Handle provider errors and retries
// - Return domain-friendly types
// - Cannot call DB directly (receive data, return results)

