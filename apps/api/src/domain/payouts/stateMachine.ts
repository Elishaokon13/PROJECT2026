// Payout state machine
// Enforces valid state transitions and ensures ledger operations are atomic

import { PrismaClient, Prisma } from '@prisma/client';
import { ValidationError } from '../../errors/index.js';
import type {
  PayoutStatus,
  StateTransition,
  TransitionToFundsLockedParams,
  TransitionToSentToProviderParams,
  TransitionToCompletedParams,
  TransitionToFailedParams,
} from './types.js';

export class PayoutStateMachine {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Valid state transitions
   */
  private readonly validTransitions: Record<PayoutStatus, PayoutStatus[]> = {
    CREATED: ['FUNDS_LOCKED', 'FAILED'],
    FUNDS_LOCKED: ['SENT_TO_PROVIDER', 'FAILED'],
    SENT_TO_PROVIDER: ['COMPLETED', 'FAILED'],
    COMPLETED: [], // Terminal state
    FAILED: [], // Terminal state
  };

  /**
   * Check if transition is valid
   */
  private isValidTransition(from: PayoutStatus, to: PayoutStatus): boolean {
    return this.validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Record state transition in history
   */
  private recordTransition(
    history: StateTransition[] | null,
    from: PayoutStatus,
    to: PayoutStatus,
    reason?: string,
  ): StateTransition[] {
    const transitions = history ? (history as unknown as StateTransition[]) : [];
    transitions.push({
      from,
      to,
      timestamp: new Date(),
      reason,
    });
    return transitions;
  }

  /**
   * Transition: CREATED → FUNDS_LOCKED
   * Funds must be locked in ledger before this transition
   * CRITICAL: This transition requires lockEntryId to be set
   */
  async transitionToFundsLocked(
    params: TransitionToFundsLockedParams,
  ): Promise<void> {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const payout = await tx.payout.findUnique({
        where: { id: params.payoutId },
      });

      if (!payout) {
        throw new ValidationError(`Payout ${params.payoutId} not found`);
      }

      if (payout.status !== 'CREATED') {
        throw new ValidationError(
          `Cannot transition from ${payout.status} to FUNDS_LOCKED. Payout must be in CREATED state.`,
        );
      }

      // Verify lock entry exists
      const lockEntry = await tx.ledgerEntry.findUnique({
        where: { id: params.lockEntryId },
      });

      if (!lockEntry) {
        throw new ValidationError(`Lock entry ${params.lockEntryId} not found`);
      }

      if (lockEntry.entryType !== 'LOCK' || lockEntry.status !== 'PENDING') {
        throw new ValidationError(
          `Lock entry ${params.lockEntryId} is not a valid pending LOCK entry`,
        );
      }

      // Update payout state
      await tx.payout.update({
        where: { id: params.payoutId },
        data: {
          status: 'FUNDS_LOCKED',
          lockEntryId: params.lockEntryId,
          stateHistory: this.recordTransition(
            payout.stateHistory as StateTransition[] | null,
            'CREATED',
            'FUNDS_LOCKED',
            'Funds locked in ledger',
          ),
        },
      });
    });
  }

  /**
   * Transition: FUNDS_LOCKED → SENT_TO_PROVIDER
   * CRITICAL: External provider call must only happen after funds are locked
   * This transition records the provider payout ID
   */
  async transitionToSentToProvider(
    params: TransitionToSentToProviderParams,
  ): Promise<void> {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const payout = await tx.payout.findUnique({
        where: { id: params.payoutId },
      });

      if (!payout) {
        throw new ValidationError(`Payout ${params.payoutId} not found`);
      }

      if (payout.status !== 'FUNDS_LOCKED') {
        throw new ValidationError(
          `Cannot transition from ${payout.status} to SENT_TO_PROVIDER. Payout must be in FUNDS_LOCKED state.`,
        );
      }

      if (!payout.lockEntryId) {
        throw new ValidationError(
          `Payout ${params.payoutId} must have lockEntryId before sending to provider`,
        );
      }

      // Update payout state
      await tx.payout.update({
        where: { id: params.payoutId },
        data: {
          status: 'SENT_TO_PROVIDER',
          providerPayoutId: params.providerPayoutId,
          stateHistory: this.recordTransition(
            payout.stateHistory as StateTransition[] | null,
            'FUNDS_LOCKED',
            'SENT_TO_PROVIDER',
            `Sent to provider with ID: ${params.providerPayoutId}`,
          ),
        },
      });
    });
  }

  /**
   * Transition: SENT_TO_PROVIDER → COMPLETED
   * Called when provider webhook confirms completion
   * Settles funds in ledger (lock is finalized)
   */
  async transitionToCompleted(
    params: TransitionToCompletedParams,
  ): Promise<void> {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const payout = await tx.payout.findUnique({
        where: { id: params.payoutId },
      });

      if (!payout) {
        throw new ValidationError(`Payout ${params.payoutId} not found`);
      }

      if (payout.status !== 'SENT_TO_PROVIDER') {
        throw new ValidationError(
          `Cannot transition from ${payout.status} to COMPLETED. Payout must be in SENT_TO_PROVIDER state.`,
        );
      }

      if (!payout.lockEntryId) {
        throw new ValidationError(
          `Payout ${params.payoutId} must have lockEntryId before completing`,
        );
      }

      // Update payout state
      await tx.payout.update({
        where: { id: params.payoutId },
        data: {
          status: 'COMPLETED',
          providerStatus: params.providerStatus ?? 'completed',
          stateHistory: this.recordTransition(
            payout.stateHistory as StateTransition[] | null,
            'SENT_TO_PROVIDER',
            'COMPLETED',
            'Provider confirmed completion',
          ),
        },
      });
    });
  }

  /**
   * Transition: Any state → FAILED
   * Releases funds in ledger if funds were locked
   * Can be called from CREATED, FUNDS_LOCKED, or SENT_TO_PROVIDER
   */
  async transitionToFailed(
    params: TransitionToFailedParams,
  ): Promise<void> {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const payout = await tx.payout.findUnique({
        where: { id: params.payoutId },
      });

      if (!payout) {
        throw new ValidationError(`Payout ${params.payoutId} not found`);
      }

      if (payout.status === 'COMPLETED' || payout.status === 'FAILED') {
        throw new ValidationError(
          `Cannot transition from terminal state ${payout.status} to FAILED`,
        );
      }

      // Update payout state
      await tx.payout.update({
        where: { id: params.payoutId },
        data: {
          status: 'FAILED',
          providerError: params.providerError ?? undefined,
          stateHistory: this.recordTransition(
            payout.stateHistory as StateTransition[] | null,
            payout.status,
            'FAILED',
            params.reason,
          ),
        },
      });
    });
  }

  /**
   * Get current state
   */
  async getState(payoutId: string): Promise<PayoutStatus | null> {
    const payout = await this.db.payout.findUnique({
      where: { id: payoutId },
      select: { status: true },
    });

    return payout?.status ?? null;
  }

  /**
   * Check if payout can transition to a state
   */
  async canTransition(payoutId: string, to: PayoutStatus): Promise<boolean> {
    const currentState = await this.getState(payoutId);
    if (!currentState) {
      return false;
    }
    return this.isValidTransition(currentState, to);
  }
}

