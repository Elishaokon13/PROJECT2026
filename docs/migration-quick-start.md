# Quick Migration Guide

## Current Status
- ✅ Migration SQL file created: `prisma/migrations/20251229030235_new_migration/migration.sql`
- ❌ Local connection blocked (IP whitelisting required)
- ✅ Alternative: Use Supabase SQL Editor (no whitelist needed)

## Option 1: Use Supabase SQL Editor (Recommended - No IP Whitelist)

### Step 1: Open SQL Editor
Go to: https://supabase.com/dashboard/project/jrpzynhrdaqlnfbkuwbw/sql/new

### Step 2: Copy Migration SQL
```bash
cd apps/api
cat prisma/migrations/20251229030235_new_migration/migration.sql
```

Copy the entire output.

### Step 3: Paste and Run
1. Paste the SQL into the Supabase SQL Editor
2. Click **Run** (or press Cmd/Ctrl + Enter)
3. Wait for "Success" message

### Step 4: Mark Migration as Applied
```bash
cd apps/api
npx prisma migrate resolve --applied 20251229030235_new_migration
```

### Step 5: Generate Prisma Client
```bash
npm run db:generate
```

### Step 6: Verify
```bash
npm run db:studio
```
This opens Prisma Studio where you can see all your tables.

---

## Option 2: Whitelist IP and Use Prisma CLI

### Step 1: Whitelist Your IP
1. Go to: https://supabase.com/dashboard/project/jrpzynhrdaqlnfbkuwbw/settings/database
2. Scroll to **Connection Pooling** section
3. Under **Allowed IPs**, click **Add IP Address**
4. Enter: `0.0.0.0/0` (allows all IPs - ⚠️ dev only!)
   - Or your specific IP: `87.249.138.136`
5. Click **Save**

### Step 2: Run Migration
```bash
cd apps/api
npx prisma migrate deploy
```

### Step 3: Generate Prisma Client
```bash
npm run db:generate
```

### Step 4: Verify
```bash
npm run db:studio
```

---

## What the Migration Creates

The migration will create:
- **7 Enums**: EntryType, EntryStatus, VerificationStatus, TransactionStatus, PayoutStatus, WebhookStatus, IdempotencyStatus
- **9 Tables**: Merchant, User, Wallet, Transaction, Payout, LedgerEntry, IdentityVerification, WebhookEvent, IdempotencyKey
- **Indexes and Foreign Keys**: All relationships and constraints

---

## Troubleshooting

### "Can't reach database server"
- **Solution**: Whitelist your IP (Option 2) or use SQL Editor (Option 1)

### "Migration already applied"
- **Solution**: Run `npx prisma migrate resolve --applied 20251229030235_new_migration`

### "Table already exists"
- **Solution**: The migration was partially applied. Check Supabase Table Editor to see what exists.

### Connection String Issues
- Make sure password is URL-encoded (`#` → `%23`)
- Use port `5432` for pooled connection
- Use port `6543` for direct connection (migrations)

---

## Next Steps After Migration

1. ✅ Verify tables exist: `npm run db:studio`
2. ✅ Run tests: `npm test`
3. ✅ Start API: `npm run dev`
4. ✅ Create a test merchant via API

