# Apply Migration via Supabase SQL Editor

Since IP whitelisting isn't available, use the SQL Editor to apply the migration.

## Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/jrpzynhrdaqlnfbkuwbw/sql/new**

### Step 2: Get the Migration SQL

**Option A: Copy from file**
```bash
cd apps/api
cat prisma/migrations/20251229030235_new_migration/migration.sql | pbcopy
```
(This copies to clipboard on macOS)

**Option B: View and copy manually**
```bash
cd apps/api
cat prisma/migrations/20251229030235_new_migration/migration.sql
```
Then select all and copy.

### Step 3: Paste and Run in SQL Editor

1. Paste the entire SQL into the SQL Editor
2. Click **Run** button (or press `Cmd+Enter` / `Ctrl+Enter`)
3. Wait for "Success" message
4. You should see all tables created in the Table Editor

### Step 4: Mark Migration as Applied

After running the SQL, tell Prisma that the migration is applied:

```bash
cd apps/api
npx prisma migrate resolve --applied 20251229030235_new_migration
```

This tells Prisma that the migration has been applied, so it won't try to run it again.

### Step 5: Generate Prisma Client

```bash
npm run db:generate
```

This generates the Prisma Client with all your models.

### Step 6: Verify Everything Works

```bash
# Open Prisma Studio to see your tables
npm run db:studio
```

Or check in Supabase Dashboard → **Table Editor**

## What Gets Created

The migration creates:

- **7 Enums:**
  - EntryType (CREDIT, DEBIT, LOCK, RELEASE, SETTLE)
  - EntryStatus (PENDING, SETTLED, CANCELLED)
  - VerificationStatus (PENDING, VERIFIED, REJECTED, EXPIRED)
  - TransactionStatus (PENDING, CONFIRMED, FAILED)
  - PayoutStatus (CREATED, FUNDS_LOCKED, SENT_TO_PROVIDER, COMPLETED, FAILED)
  - WebhookStatus (PENDING, DELIVERED, FAILED)
  - IdempotencyStatus (PENDING, COMPLETED, FAILED)

- **9 Tables:**
  - Merchant
  - User
  - Wallet
  - Transaction
  - Payout
  - LedgerEntry
  - IdentityVerification
  - WebhookEvent
  - IdempotencyKey

- **All relationships, indexes, and constraints**

## Troubleshooting

### "relation already exists"
Some tables might already exist. You can:
1. Drop existing tables in SQL Editor: `DROP TABLE IF EXISTS "TableName" CASCADE;`
2. Or modify the migration SQL to use `CREATE TABLE IF NOT EXISTS`

### "type already exists"
Some enums might already exist. You can:
1. Drop existing types: `DROP TYPE IF EXISTS "TypeName" CASCADE;`
2. Or modify the migration SQL to use `CREATE TYPE IF NOT EXISTS`

### Migration marked as applied but tables don't exist
Run the SQL again in the SQL Editor.

## Alternative: Use Supabase Connection String from Dashboard

If Supabase provides a connection string in the dashboard that works without IP whitelisting:

1. Go to: **Settings → Database → Connection string**
2. Copy the **URI** connection string
3. Update `.env`:
   ```bash
   DATABASE_URL="[paste connection string here]"
   ```
4. Then try: `npx prisma migrate deploy`

But the SQL Editor approach is more reliable if IP whitelisting isn't available.

