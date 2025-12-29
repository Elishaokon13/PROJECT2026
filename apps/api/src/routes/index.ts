// API routes (thin layer, delegates to domain/services)
//
// GUARDRAIL: Routes are thin - no business logic here.
// Routes should ONLY:
// 1. Validate input (Zod schemas)
// 2. Call domain/service layer
// 3. Return response
//
// NO direct balance mutations - all money logic goes through domain/ledger
// NO business logic - delegate to services

