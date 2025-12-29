# Openly

API-first payments infrastructure for stablecoin payments.

## Overview

Openly enables businesses to:
- Accept stablecoin payments (USDC/USDT)
- Hold balances
- Off-ramp to local fiat currencies (starting with NGN)

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Fastify
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** Zod

## Project Structure

```
openly/
├── apps/
│   ├── api/          # Core API (the product)
│   └── sdk/          # Node.js SDK
├── packages/         # Shared packages
├── infra/           # Infrastructure configs
└── docs/            # Documentation
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:
```bash
npm run db:migrate
```

4. Start development server:
```bash
npm run dev
```

## Development

- `npm run dev` - Start API in development mode
- `npm run build` - Build all packages
- `npm run test` - Run tests
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client

## License

Private

