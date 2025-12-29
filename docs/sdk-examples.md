# Openly SDK Examples

## Installation

```bash
npm install @openly/sdk
```

## Basic Usage

```typescript
import { Openly } from '@openly/sdk';

const openly = new Openly({
  apiKey: 'sk_live_...',
  baseUrl: 'https://api.openly.com', // Optional, defaults to production
});

// Create a user
const user = await openly.users.create({
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '+1234567890',
});

// Submit identity verification
await openly.identity.verify({
  user_id: user.id,
  user_data: {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    // ... KYC data
  },
});

// Wait for verification (poll or webhook)
const verification = await openly.identity.getStatus(user.id);
if (verification.status === 'verified') {
  // Create wallet (requires verified identity)
  const wallet = await openly.wallets.create({
    user_id: user.id,
    currency: 'USDC',
  });

  // Get balance
  const balance = await openly.wallets.getBalance(wallet.id);
  console.log(`Balance: ${balance.available} ${balance.currency}`);

  // Create payout (idempotency key auto-generated)
  const payout = await openly.payouts.create({
    wallet_id: wallet.id,
    amount: '100.00',
    currency: 'USDC',
    recipient_account: '1234567890',
    recipient_name: 'John Doe',
    recipient_bank_code: '044',
  });

  console.log(`Payout ${payout.id} created with status: ${payout.status}`);
}
```

## Idempotency

```typescript
// Automatic idempotency key generation (recommended)
const payout1 = await openly.payouts.create({ ... });

// Manual idempotency key (for advanced use cases)
const payout2 = await openly.payouts.create(
  { ... },
  'my-custom-idempotency-key-123'
);
```

## Error Handling

```typescript
import { Openly, OpenlyError } from '@openly/sdk';

try {
  const payout = await openly.payouts.create({ ... });
} catch (error) {
  if (error instanceof OpenlyError) {
    switch (error.code) {
      case 'INSUFFICIENT_FUNDS':
        console.error('Not enough balance');
        break;
      case 'VALIDATION_ERROR':
        console.error('Invalid request:', error.details);
        break;
      case 'IDEMPOTENCY_KEY_CONFLICT':
        console.error('Duplicate request');
        break;
      default:
        console.error('API error:', error.message);
    }
  } else {
    console.error('Network error:', error);
  }
}
```

## Webhook Handling

```typescript
import { WebhookVerifier } from '@openly/sdk';
import express from 'express';

const app = express();
const verifier = new WebhookVerifier({ secret: process.env.WEBHOOK_SECRET });

app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-openly-signature'] as string;
  const payload = req.body.toString();

  // Verify signature
  if (!verifier.verify(signature, payload)) {
    return res.status(401).send('Invalid signature');
  }

  // Parse webhook
  const event = verifier.parse(payload);

  // Handle event
  switch (event.event) {
    case 'payout.completed':
      console.log('Payout completed:', event.data.id);
      break;
    case 'payout.failed':
      console.log('Payout failed:', event.data.failure_reason);
      break;
    case 'payment.received':
      console.log('Payment received:', event.data.amount);
      break;
  }

  res.status(200).send({ received: true });
});
```

## Pagination

```typescript
// List users with pagination
let offset = 0;
const limit = 20;

while (true) {
  const response = await openly.users.list({ limit, offset });
  
  for (const user of response.data) {
    console.log(user.email);
  }

  if (!response.pagination.has_more) {
    break;
  }

  offset += limit;
}
```

