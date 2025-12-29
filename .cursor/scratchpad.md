# Openly - API-First Payments Infrastructure

## Background and Motivation

Building **Openly**, an API-first payments infrastructure that allows businesses to:
1. Accept stablecoin payments (USDC/USDT)
2. Hold balances
3. Off-ramp to local fiat currencies (starting with NGN)

**Key Principles:**
- API/SDK-first: API is the product, SDK is thin wrapper
- Ledger-first: internal ledger is the source of truth
- No blockchain jargon exposed to API consumers
- Idempotent, retry-safe endpoints
- Clear service separation: API layer, domain logic, infrastructure adapters
- Observable, auditable, and reconciliable

**Tech Stack:**
- Backend: Node.js + TypeScript
- Framework: Fastify
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Wallets: Coinbase CDP (embedded custodial)
- Off-Ramp: Zerocard
- SDK: Node.js / TypeScript

## Key Challenges and Analysis

1. **Ledger Integrity**: Internal ledger must be the single source of truth. All money movements must be atomic and auditable.
2. **Idempotency**: All money-moving endpoints must be idempotent to handle retries safely.
3. **Provider Abstraction**: Wallet and off-ramp providers should be abstracted behind adapters for flexibility.
4. **Webhook Reliability**: Webhook delivery must be retry-safe and observable.
5. **KYC Integration**: Identity verification flow must be seamless but secure.

## High-level Task Breakdown

### Phase 1: Foundation Setup ✅
- [x] Create folder structure
- [x] Set up root package.json with workspaces
- [x] Configure TypeScript base config
- [x] Create .env.example with all required variables
- [x] Set up basic Fastify server structure
- [x] Create domain module placeholders

**Success Criteria:**
- All directories created
- Root and workspace package.json files in place
- TypeScript configuration ready
- Basic server.ts and app.ts files created
- All domain modules have placeholder files

### Phase 2: Database & Prisma Setup
- [ ] Design Prisma schema (Merchant, User, Wallet, Transaction, Payout, LedgerEntry, IdentityVerification, WebhookEvent)
- [ ] Set up Prisma client generation
- [ ] Create initial migration
- [ ] Set up shared @openly/db package

**Success Criteria:**
- Schema defines all core entities with proper relationships
- Prisma client generates successfully
- Migration runs without errors
- Database connection works

### Phase 3: Core Domain Models
- [ ] Implement User domain (create, get, list)
- [ ] Implement Wallet domain (create, get balance)
- [ ] Implement Ledger domain (credit, debit, balance queries)
- [ ] Implement Identity domain (KYC verification flow)
- [ ] Implement Transaction domain (inbound payment tracking)
- [ ] Implement Payout domain (outbound payout creation and tracking)
- [ ] Implement Webhook domain (event creation and dispatch)

**Success Criteria:**
- Each domain module has clear interfaces
- Domain logic is testable in isolation
- Types are strongly typed (no `any`)
- Ledger operations are atomic

### Phase 4: Adapters (External Providers)
- [ ] Coinbase CDP wallet adapter (create wallet, get balance, receive webhooks)
- [ ] Zerocard off-ramp adapter (initiate payout, check status)
- [ ] KYC provider adapter (submit verification, check status)
- [ ] Notification adapter (webhook delivery with retries)

**Success Criteria:**
- Adapters abstract provider-specific details
- Error handling is consistent
- Retry logic for transient failures
- Adapters are testable with mocks

### Phase 5: API Layer
- [ ] Authentication plugin (API key validation)
- [ ] Database plugin (Prisma client injection)
- [ ] CORS and rate limiting plugins
- [ ] Route handlers (users, wallets, payouts, webhooks)
- [ ] Request/response validation with Zod
- [ ] Idempotency middleware for money-moving endpoints

**Success Criteria:**
- All endpoints have request/response validation
- API key authentication works
- Idempotency keys are respected
- Error responses are consistent

### Phase 6: Services (Orchestration)
- [ ] Payment processing service (webhook → ledger update)
- [ ] Payout orchestration service (ledger debit → off-ramp → webhook)
- [ ] User onboarding service (create user → KYC → create wallet)
- [ ] Webhook dispatch service (retry logic, delivery tracking)

**Success Criteria:**
- Services coordinate domain logic correctly
- Transaction boundaries are clear
- Error handling is comprehensive
- Services are testable

### Phase 7: SDK
- [ ] SDK client class (API key, base URL)
- [ ] Resource classes (Users, Wallets, Payouts, Webhooks)
- [ ] Type definitions matching API
- [ ] Error handling
- [ ] Build and publish setup

**Success Criteria:**
- SDK is a thin wrapper around API
- Types match API exactly
- SDK can be imported and used
- Examples work

### Phase 8: Testing & Documentation
- [ ] Unit tests for domain logic (especially ledger)
- [ ] Integration tests for API endpoints
- [ ] SDK tests
- [ ] API documentation
- [ ] Webhook documentation
- [ ] Payout flow documentation

**Success Criteria:**
- Ledger correctness tests pass
- All critical paths have tests
- Documentation is clear and complete

## Project Status Board

- [x] Create folder structure
- [ ] Design Prisma schema
- [ ] Implement domain models
- [ ] Implement adapters
- [ ] Implement API layer
- [ ] Implement services
- [ ] Implement SDK
- [ ] Write tests
- [ ] Write documentation

## Current Status / Progress Tracking

**Current Phase:** Phase 1 - Foundation Setup

**Completed:**
- ✅ Created complete folder structure as specified
- ✅ Set up root package.json with workspaces
- ✅ Created tsconfig.base.json with strict TypeScript settings
- ✅ Created .env.example with all required environment variables
- ✅ Created apps/api structure with all domain modules
- ✅ Created apps/sdk structure
- ✅ Created packages structure (db, config, utils)
- ✅ Created infra and docs directories
- ✅ Created placeholder files for key components

**Next Steps:**
- Proceed to Phase 2: Database & Prisma Setup
- Design the Prisma schema with all core entities

## Executor's Feedback or Assistance Requests

None at this time.

## Lessons

- Folder structure follows domain-first organization
- All TypeScript configs use strict mode
- Workspace setup allows shared packages between API and SDK

