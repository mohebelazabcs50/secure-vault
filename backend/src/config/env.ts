import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'Access token secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Refresh token secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('secure_vault_cookie_secret_fallback'),
  SERVER_PEPPER: z.string().min(32, 'Server pepper must be at least 32 characters for AES-256-GCM'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
