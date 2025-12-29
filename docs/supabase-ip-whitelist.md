# Supabase IP Whitelisting Guide

## Issue: "Can't reach database server"

If you're getting this error when running migrations, your IP address needs to be whitelisted in Supabase.

## Solution: Whitelist Your IP Address

### Step 1: Find Your IP Address

Run this command to get your public IP:
```bash
curl ifconfig.me
# or
curl ipinfo.io/ip
```

### Step 2: Whitelist IP in Supabase

1. Go to your Supabase project dashboard:
   ```
   https://supabase.com/dashboard/project/jrpzynhrdaqlnfbkuwbw/settings/database
   ```

2. Scroll down to **Connection Pooling** section

3. Under **Allowed IPs**, click **Add IP Address**

4. Enter your IP address (from Step 1)

5. Click **Save**

### Step 3: For Development (Allow All IPs - Temporary)

If you're in development and your IP changes frequently:

1. Go to **Settings** → **Database** → **Connection Pooling**
2. Under **Allowed IPs**, you can temporarily add:
   - `0.0.0.0/0` (allows all IPs - ⚠️ only for development!)

**⚠️ Security Warning:** Allowing all IPs (`0.0.0.0/0`) should **NEVER** be used in production. Only use this for local development.

### Step 4: Retry Migration

After whitelisting your IP:

```bash
cd apps/api
npm run db:migrate
```

## Alternative: Use Supabase Connection String from Dashboard

Supabase provides pre-configured connection strings that may already have IP whitelisting configured:

1. Go to: https://supabase.com/dashboard/project/jrpzynhrdaqlnfbkuwbw/settings/database
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string
5. Update your `.env` file with this connection string

## Connection String Formats

### For Migrations (Direct Connection - Port 6543)
```
postgresql://postgres:[PASSWORD]@db.jrpzynhrdaqlnfbkuwbw.supabase.co:6543/postgres
```

### For Application (Pooled Connection - Port 5432)
```
postgresql://postgres:[PASSWORD]@db.jrpzynhrdaqlnfbkuwbw.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
```

**Note:** Replace `[PASSWORD]` with your actual password (URL-encoded if it contains special characters like `#` → `%23`)

## Troubleshooting

### Still Can't Connect?

1. **Check IP Whitelist**: Make sure your IP is added in Supabase dashboard
2. **Check Password**: Ensure password is URL-encoded (special characters like `#` become `%23`)
3. **Check Connection String**: Verify the connection string format is correct
4. **Try Direct Connection**: Use port 6543 for migrations
5. **Check Supabase Status**: Visit https://status.supabase.com

### Password with Special Characters

If your password contains special characters, they must be URL-encoded:
- `#` → `%23`
- `@` → `%40`
- `&` → `%26`
- `%` → `%25`
- etc.

You can use this to encode:
```bash
node -e "console.log(encodeURIComponent('YOUR_PASSWORD'))"
```

