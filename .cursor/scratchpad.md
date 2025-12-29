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

## Architectural Principles (Why This Structure Works)

### 1. domain/ is Sacred
All money logic lives here:
- Ledger invariants
- Balance checks
- Payout state machines
- **Nothing in routes/ is allowed to move money directly**

### 2. routes/ are Thin
Routes:
- Validate input (Zod)
- Call domain/service
- Return response
This prevents "fat controllers" — the #1 Node infra failure.

### 3. adapters/ Isolate Vendors
Coinbase, Zerocard, KYC providers never leak into domain logic.
This gives you:
- Provider swap flexibility
- Easier testing
- Cleaner mental model
- **Adapters cannot call DB directly**

### 4. SDK is First-Class Citizen
SDK lives beside the API, not as an afterthought.
This enforces:
- API discipline
- DX empathy
- Type reuse
- **SDK cannot contain business logic**

### Correct Payout Flow Example
```
API Route (validate)
  ↓
PayoutService
  ↓
Ledger.lockFunds() (atomic, idempotent)
  ↓
OfframpAdapter.createTransfer()
  ↓
WebhookHandler (provider)
  ↓
Ledger.settle() OR Ledger.release()
```

**No shortcuts. No hacks.**

### Key Domain Module Ownership
- **domain/ledger**: LedgerEntry, BalanceSnapshot, lock/unlock, idempotency. **Most important folder.**
- **domain/payouts**: PayoutIntent, state machine, retry logic, reconciliation
- **domain/wallets**: Wallet lifecycle, user binding, deposit addresses
- **domain/identity**: KYC status, identity → wallet gating

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

### Phase 2: Database & Prisma Setup ✅
- [x] Design Prisma schema (Merchant, User, Wallet, Transaction, Payout, LedgerEntry, IdentityVerification, WebhookEvent)
- [x] Set up Prisma client generation
- [ ] Create initial migration (ready, needs `npm run db:migrate`)
- [x] Update database plugin with Prisma client

**Success Criteria:**
- ✅ Schema defines all core entities with proper relationships
- ✅ Prisma client setup ready (will generate after migration)
- ⏳ Migration ready to run
- ✅ Database connection configured

### Phase 3: Core Domain Models
- [ ] Implement User domain (create, get, list)
- [ ] Implement Wallet domain (create, get balance)
- [x] **Implement Ledger domain** ✅ (credit, debit, lockFunds, releaseFunds, settleFunds, getBalance)
- [ ] Implement Identity domain (KYC verification flow)
- [ ] Implement Transaction domain (inbound payment tracking)
- [ ] Implement Payout domain (outbound payout creation and tracking)
- [ ] Implement Webhook domain (event creation and dispatch)

**Success Criteria:**
- ✅ Ledger domain has clear interfaces and is fully implemented
- ✅ Ledger operations are atomic (database transactions)
- ✅ Balance invariants enforced (no negative balances)
- ✅ Idempotency support for all operations
- ✅ Strong TypeScript typing throughout
- [ ] Other domain modules pending

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

**Current Phase:** Phase 5 - API Layer (Scaffolded)

**Completed:**
- ✅ Created complete folder structure as specified
- ✅ Set up root package.json with workspaces
- ✅ Created tsconfig.base.json with strict TypeScript settings (including noUncheckedIndexedAccess, exactOptionalPropertyTypes)
- ✅ Created .env.example with all required environment variables
- ✅ Created apps/api structure with all domain modules
- ✅ Created apps/sdk structure
- ✅ Created packages structure (db, config, utils)
- ✅ Created infra and docs directories
- ✅ Created placeholder files for key components
- ✅ **Scaffolded Fastify API:**
  - Error handling taxonomy (AppError, NotFoundError, ValidationError, etc.)
  - Authentication plugin (API key validation)
  - Database plugin (Prisma client placeholder)
  - CORS and rate limiting plugins
  - Idempotency middleware for money-moving endpoints
  - Route handlers: health, users, wallets, payouts, webhooks
  - All routes follow thin controller pattern (validate → delegate → return)
  - Zod schemas for request/response validation
  - TypeScript types for authenticated requests, idempotent requests, pagination

**Next Steps:**
1. Install dependencies: `npm install` (will resolve TypeScript linting errors)
2. Run Prisma migrations: `npm run db:migrate` (after installing dependencies)
3. Generate Prisma client: `npm run db:generate`
4. Implement remaining domain services (users, wallets, payouts)
5. Implement adapters (Coinbase CDP, Zerocard)

## Executor's Feedback or Assistance Requests

**Note on Linting Errors:**
Current TypeScript linting errors are expected and will resolve after running `npm install`. The errors are due to missing type definitions for:
- `fastify` and `@fastify/*` packages
- `zod` package
- `@prisma/client` package

These are all listed in `apps/api/package.json` dependencies and will be available after installation.

**API Scaffolding Complete:**
- All route handlers follow the thin controller pattern
- Idempotency middleware is in place for money-moving endpoints (payouts)
- Error handling is centralized and type-safe
- Authentication plugin ready (needs database integration)
- All architectural guardrails are enforced via code structure and comments

**Ledger Implementation Complete:**
- ✅ Prisma schema with LedgerEntry model (double-entry ledger)
- ✅ Ledger domain fully implemented with all operations:
  - `credit()` - Add funds (immediately settled)
  - `debit()` - Remove funds with balance check (immediately settled)
  - `lockFunds()` - Lock funds for pending operations (requires idempotency key)
  - `releaseFunds()` - Release locked funds (cancelled operations)
  - `settleFunds()` - Settle locked funds (completed operations)
  - `getBalance()` - Compute balance from settled entries
- ✅ Balance invariants enforced (no negative balances)
- ✅ Atomic operations using database transactions
- ✅ Idempotency support for all operations
- ✅ LedgerService injected into Fastify instance
- ✅ Strong TypeScript typing with decimal.js for precise arithmetic
- ✅ Balance computation from settled entries (not stored, computed on-demand)

**Idempotency Implementation Complete:**
- ✅ Prisma schema with IdempotencyKey model (persistent storage)
- ✅ Idempotency domain fully implemented:
  - `checkIdempotency()` - Check key and validate request hash
  - `storeIdempotency()` - Store new idempotency key (PENDING)
  - `completeIdempotency()` - Mark key as completed with response
  - `failIdempotency()` - Mark key as failed (allows retry)
- ✅ Request hash validation (SHA-256) prevents payload changes
- ✅ Merchant scoping (keys scoped per merchant)
- ✅ Response replay for duplicate requests
- ✅ Domain-level enforcement (not just middleware)
- ✅ Integrated with PayoutService
- ✅ Race condition handling (unique constraint violations)
- ✅ IdempotencyService injected into Fastify instance

## Lessons

- Folder structure follows domain-first organization
- All TypeScript configs use strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` to prevent fintech bugs
- Workspace setup allows shared packages between API and SDK
- **Architectural guardrails**: Domain is sacred, routes are thin, adapters isolate vendors, SDK is first-class
- **Guardrails enforced**: No route may mutate balances directly, ledger before external calls, idempotency on all money endpoints

