import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  databaseUrl: z.string().url(),
  apiKeySecret: z.string().min(32),
  jwtSecret: z.string().min(32),
  coinbaseApiKey: z.string(),
  coinbaseApiSecret: z.string(),
  coinbaseBaseUrl: z.string().url().optional(),
  coinbaseCdpWalletSetId: z.string().optional(),
  zerocardApiKey: z.string(),
  zerocardApiSecret: z.string(),
  zerocardBaseUrl: z.string().url(),
  kycProviderApiKey: z.string().optional(),
  kycProviderBaseUrl: z.string().url().optional(),
  webhookSecret: z.string().min(32),
  webhookBaseUrl: z.string().url(),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  host: process.env.HOST,
  logLevel: process.env.LOG_LEVEL,
  databaseUrl: process.env.DATABASE_URL,
  apiKeySecret: process.env.API_KEY_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  coinbaseCdpApiKey: process.env.COINBASE_CDP_API_KEY,
  coinbaseCdpApiSecret: process.env.COINBASE_CDP_API_SECRET,
  coinbaseCdpWalletSetId: process.env.COINBASE_CDP_WALLET_SET_ID,
  zerocardApiKey: process.env.ZEROCARD_API_KEY,
  zerocardApiSecret: process.env.ZEROCARD_API_SECRET,
  zerocardBaseUrl: process.env.ZEROCARD_BASE_URL,
  kycProviderApiKey: process.env.KYC_PROVIDER_API_KEY,
  kycProviderBaseUrl: process.env.KYC_PROVIDER_BASE_URL,
  webhookSecret: process.env.WEBHOOK_SECRET,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
});

