// Ledger service - wraps Ledger class for Fastify injection
// This service can be injected into Fastify instance and used by routes

import type { FastifyInstance } from 'fastify';
import { Ledger } from '../domain/ledger/index.js';
import type {
  CreditParams,
  DebitParams,
  LockFundsParams,
  ReleaseFundsParams,
  SettleFundsParams,
  Balance,
  LedgerEntryResult,
} from '../domain/ledger/types.js';
import type { Currency } from '../types/index.js';

export class LedgerService {
  private ledger: Ledger;

  constructor(db: FastifyInstance['db']) {
    this.ledger = new Ledger(db);
  }

  async credit(params: CreditParams): Promise<LedgerEntryResult> {
    return this.ledger.credit(params);
  }

  async debit(params: DebitParams): Promise<LedgerEntryResult> {
    return this.ledger.debit(params);
  }

  async lockFunds(params: LockFundsParams): Promise<LedgerEntryResult> {
    return this.ledger.lockFunds(params);
  }

  async releaseFunds(params: ReleaseFundsParams): Promise<LedgerEntryResult> {
    return this.ledger.releaseFunds(params);
  }

  async settleFunds(params: SettleFundsParams): Promise<LedgerEntryResult> {
    return this.ledger.settleFunds(params);
  }

  async getBalance(walletId: string, currency: Currency): Promise<Balance> {
    return this.ledger.getBalance(walletId, currency);
  }
}

// Fastify plugin to inject ledger service
export async function ledgerServicePlugin(
  fastify: FastifyInstance,
): Promise<void> {
  const ledgerService = new LedgerService(fastify.db);
  fastify.decorate('ledgerService', ledgerService);
}

declare module 'fastify' {
  interface FastifyInstance {
    ledgerService: LedgerService;
  }
}

