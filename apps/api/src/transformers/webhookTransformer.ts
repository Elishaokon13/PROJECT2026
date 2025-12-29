// Webhook transformer
// Converts internal webhook models to public API format
// CRITICAL: Only exposes public fields

import type { WebhookEvent as PrismaWebhookEvent } from '@prisma/client';
import { toPublicId } from '../lib/publicIds.js';
import type { WebhookEvent } from '../../sdk/src/types/api.js';

export function transformWebhook(webhook: PrismaWebhookEvent): WebhookEvent {
  return {
    id: toPublicId('webhook', webhook.id),
    event: webhook.event,
    data: webhook.payload as unknown,
    status: webhook.status === 'DELIVERED' ? 'delivered' : webhook.status === 'FAILED' ? 'failed' : 'pending',
    created_at: webhook.createdAt.toISOString(),
    delivered_at: webhook.deliveredAt?.toISOString(),
  };
}

export function transformWebhooks(webhooks: PrismaWebhookEvent[]): WebhookEvent[] {
  return webhooks.map(transformWebhook);
}

