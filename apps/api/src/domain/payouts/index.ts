// Payout domain
// State machine for payout orchestration

export { PayoutStateMachine } from './state-machine.js';
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
