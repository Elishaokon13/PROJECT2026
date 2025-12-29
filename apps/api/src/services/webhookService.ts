// Webhook dispatch service
// Handles outbound webhook delivery to merchants
// CRITICAL: Ensures reliable delivery with retry logic

import type { FastifyInstance } from 'fastify';
import { WebhookStatus } from '@prisma/client';
import { config } from '../config/index.js';
import { createHmac } from 'crypto';

export interface CreateWebhookEventParams {
  merchantId: string;
  event: string;
  payload: unknown;
  url?: string; // Override merchant's default webhook URL
}

export interface WebhookEventResult {
  id: string;
  event: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  createdAt: Date;
}

export class WebhookService {
  constructor(private readonly db: FastifyInstance['db']) {}

  /**
   * Create and dispatch webhook event
   * Creates webhook record and attempts delivery
   */
  async createAndDispatch(params: CreateWebhookEventParams): Promise<WebhookEventResult> {
    // Get merchant's webhook URL (from merchant settings or use provided URL)
    const webhookUrl = params.url ?? await this.getMerchantWebhookUrl(params.merchantId);

    if (!webhookUrl) {
      throw new Error(`No webhook URL configured for merchant ${params.merchantId}`);
    }

    // Create webhook event record
    const webhookEvent = await this.db.webhookEvent.create({
      data: {
        merchantId: params.merchantId,
        event: params.event,
        payload: params.payload as unknown,
        status: WebhookStatus.PENDING,
        url: webhookUrl,
        attempts: 0,
      },
    });

    // Attempt delivery (async, don't await)
    this.deliverWebhook(webhookEvent.id).catch((error) => {
      // Log error but don't throw - webhook delivery is fire-and-forget
      console.error(`Failed to deliver webhook ${webhookEvent.id}:`, error);
    });

    return {
      id: webhookEvent.id,
      event: webhookEvent.event,
      status: 'pending',
      attempts: webhookEvent.attempts,
      createdAt: webhookEvent.createdAt,
    };
  }

  /**
   * Deliver webhook with retry logic
   * Uses exponential backoff for retries
   */
  private async deliverWebhook(webhookEventId: string): Promise<void> {
    const webhookEvent = await this.db.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!webhookEvent) {
      throw new Error(`Webhook event ${webhookEventId} not found`);
    }

    // Skip if already delivered or failed after max attempts
    if (webhookEvent.status === WebhookStatus.DELIVERED) {
      return;
    }

    if (webhookEvent.attempts >= 5) {
      // Max attempts reached, mark as failed
      await this.db.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: WebhookStatus.FAILED,
          errorMessage: 'Max delivery attempts reached',
        },
      });
      return;
    }

    try {
      // Generate signature
      const signature = this.generateSignature(webhookEvent.payload, config.webhookSecret);

      // Attempt delivery
      const response = await fetch(webhookEvent.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Openly-Signature': signature,
          'X-Openly-Event': webhookEvent.event,
        },
        body: JSON.stringify({
          id: webhookEvent.id,
          event: webhookEvent.event,
          data: webhookEvent.payload,
          created_at: webhookEvent.createdAt.toISOString(),
        }),
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        // Success - mark as delivered
        await this.db.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: WebhookStatus.DELIVERED,
            deliveredAt: new Date(),
            attempts: webhookEvent.attempts + 1,
            lastAttemptAt: new Date(),
          },
        });
      } else {
        // Non-2xx response - retry
        throw new Error(`Webhook delivery failed with status ${response.status}`);
      }
    } catch (error) {
      // Increment attempts and schedule retry
      const attempts = webhookEvent.attempts + 1;
      const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 30000); // Max 30 seconds

      await this.db.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          attempts,
          lastAttemptAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Schedule retry with exponential backoff
      setTimeout(() => {
        this.deliverWebhook(webhookEventId).catch((err) => {
          console.error(`Retry failed for webhook ${webhookEventId}:`, err);
        });
      }, backoffMs);
    }
  }

  /**
   * Get webhook event by ID
   */
  async getWebhookEvent(merchantId: string, webhookEventId: string): Promise<WebhookEventResult | null> {
    const webhookEvent = await this.db.webhookEvent.findFirst({
      where: {
        id: webhookEventId,
        merchantId,
      },
    });

    if (!webhookEvent) {
      return null;
    }

    return {
      id: webhookEvent.id,
      event: webhookEvent.event,
      status: webhookEvent.status === WebhookStatus.DELIVERED ? 'delivered' :
              webhookEvent.status === WebhookStatus.FAILED ? 'failed' : 'pending',
      attempts: webhookEvent.attempts,
      createdAt: webhookEvent.createdAt,
    };
  }

  /**
   * List webhook events for a merchant
   */
  async listWebhookEvents(
    merchantId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{
    data: WebhookEventResult[];
    total: number;
  }> {
    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [webhookEvents, total] = await Promise.all([
      this.db.webhookEvent.findMany({
        where: { merchantId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.webhookEvent.count({
        where: { merchantId },
      }),
    ]);

    return {
      data: webhookEvents.map((event) => ({
        id: event.id,
        event: event.event,
        status: event.status === WebhookStatus.DELIVERED ? 'delivered' :
                event.status === WebhookStatus.FAILED ? 'failed' : 'pending',
        attempts: event.attempts,
        createdAt: event.createdAt,
      })),
      total,
    };
  }

  /**
   * Get merchant's webhook URL
   * TODO: Store in Merchant model or separate webhook settings table
   */
  private async getMerchantWebhookUrl(merchantId: string): Promise<string | null> {
    // For MVP, use default webhook URL from config
    // In production, this would query Merchant.webhookUrl or WebhookSettings table
    return config.webhookBaseUrl;
  }

  /**
   * Generate webhook signature
   * Uses HMAC-SHA256 with webhook secret
   */
  private generateSignature(payload: unknown, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }
}

// Fastify plugin to inject webhook service
export async function webhookServicePlugin(fastify: FastifyInstance): Promise<void> {
  const webhookService = new WebhookService(fastify.db);
  fastify.decorate('webhookService', webhookService);
}

declare module 'fastify' {
  interface FastifyInstance {
    webhookService: WebhookService;
  }
}

