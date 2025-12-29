// Ledger-specific errors

import { AppError, InsufficientFundsError, IdempotencyKeyError } from '../../errors/index.js';

export class LedgerError extends AppError {
  constructor(message: string, details?: unknown) {
    super(500, 'LEDGER_ERROR', message, details);
  }
}

export class BalanceMismatchError extends LedgerError {
  constructor(expected: string, actual: string) {
    super(`Balance mismatch. Expected: ${expected}, Actual: ${actual}`);
  }
}

export class InvalidLedgerOperationError extends LedgerError {
  constructor(operation: string, reason: string) {
    super(`Invalid ledger operation: ${operation}. ${reason}`);
  }
}

export class LockNotFoundError extends LedgerError {
  constructor(idempotencyKey: string) {
    super(`Lock operation not found for idempotency key: ${idempotencyKey}`);
  }
}

export class LockAlreadySettledError extends LedgerError {
  constructor(idempotencyKey: string) {
    super(`Lock operation already settled for idempotency key: ${idempotencyKey}`);
  }
}

// Re-export common errors
export { InsufficientFundsError, IdempotencyKeyError };

