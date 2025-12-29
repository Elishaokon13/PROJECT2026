// Payout domain
// State machine for payout orchestration

export { PayoutStateMachine } from './stateMachine.js';
export type {
  PayoutStatus,
  PayoutIntent,
  StateTransition,
  CreatePayoutIntentParams,
  TransitionToFundsLockedParams,
  TransitionToSentToProviderParams,
  TransitionToCompletedParams,
  TransitionToFailedParams,
} from './types.js';
