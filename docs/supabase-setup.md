# Supabase Setup Guide

This guide will help you set up Supabase for the Openly API.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- A new Supabase project

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: `openly` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for project to be provisioned (~2 minutes)

## Step 2: Get Database Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Select **URI** tab
4. Copy the connection string (it will look like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password

## Step 3: Configure Environment Variables

1. Copy `.env.template` to `.env` (if not already done):
   ```bash
   cp .env.template .env
   ```

2. Update `.env` with your Supabase connection string:
   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
   ```

   **Important Notes:**
   - Replace `YOUR_PASSWORD` with your actual database password
   - Replace `xxxxx` with your project reference ID
   - The `?pgbouncer=true&connection_limit=1` parameters are recommended for Prisma with Supabase

## Step 4: Run Database Migrations

1. Navigate to the API directory:
   ```bash
   cd apps/api
   ```

2. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

   This will:
   - Create all tables (Merchant, User, Wallet, Transaction, Payout, LedgerEntry, etc.)
   - Set up indexes and constraints
   - Create the database schema

## Step 5: Verify Setup

1. Check that tables were created:
   ```bash
   npm run db:studio
   ```
   This opens Prisma Studio where you can view your database tables.

2. Or verify via Supabase Dashboard:
   - Go to **Table Editor** in your Supabase dashboard
   - You should see all the tables created by Prisma

## Step 6: Set Up Row Level Security (Optional but Recommended)

Supabase supports Row Level Security (RLS). For the Openly API, you may want to:

1. Enable RLS on sensitive tables (if using Supabase Auth)
2. Create policies for merchant-scoped data access

**Note:** Since Openly uses API key authentication (not Supabase Auth), RLS is optional. The API handles access control at the application level.

## Connection Pooling

Supabase provides connection pooling via PgBouncer. The connection string format above uses the pooled connection.

**For Prisma:**
- Use the pooled connection string (port 5432 with `pgbouncer=true`)
- Set `connection_limit=1` in the connection string
- This prevents connection pool exhaustion

**Alternative: Direct Connection**
If you need a direct connection (for migrations or admin tasks):
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:6543/postgres
```
Note: Port 6543 is the direct connection port (without pooling).

## Environment Variables for Supabase

Your `.env` file should include:

```bash
# Supabase Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"

# Other required variables...
API_KEY_SECRET="your-32-character-secret-key-here"
JWT_SECRET="your-32-character-jwt-secret-here"
WEBHOOK_SECRET="your-32-character-webhook-secret-here"
# ... etc
```

## Troubleshooting

### Connection Errors

**Error: "Connection refused"**
- Check that your IP is allowed in Supabase (Settings → Database → Connection Pooling → Allowed IPs)
- For development, you may need to allow all IPs temporarily

**Error: "Password authentication failed"**
- Verify your database password is correct
- Make sure you replaced `[YOUR-PASSWORD]` in the connection string

**Error: "Too many connections"**
- Use the pooled connection string (`pgbouncer=true`)
- Ensure `connection_limit=1` is set

### Migration Issues

**Error: "Schema already exists"**
- This is normal if tables already exist
- Use `prisma migrate reset` to start fresh (⚠️ deletes all data)

**Error: "Relation already exists"**
- Tables may have been created manually
- Check Supabase Table Editor for existing tables

## Next Steps

After setting up Supabase:

1. ✅ Run migrations: `cd apps/api && npm run db:migrate`
2. ✅ Verify tables: `npm run db:studio`
3. ✅ Run tests: `npm test`
4. ✅ Start API: `npm run dev`

## Supabase Features You Can Use

- **Database**: PostgreSQL (already configured)
- **Storage**: For file uploads (if needed later)
- **Realtime**: For webhook subscriptions (optional)
- **Edge Functions**: For serverless functions (optional)

For now, we're only using the PostgreSQL database.

