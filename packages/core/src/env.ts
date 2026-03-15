import { z } from 'zod';

const envSchema = z.object({
  // Required for all services
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ADMIN_UID: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),
  
  // Optional / service-specific
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  INTERNAL_API_URL: z.string().url().optional()
});

const apiEnvSchema = envSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

const botEnvSchema = envSchema.extend({
  INTERNAL_API_URL: z.string().url()
});

export type EnvConfig = z.infer<typeof envSchema>;
export type ApiEnvConfig = z.infer<typeof apiEnvSchema>;
export type BotEnvConfig = z.infer<typeof botEnvSchema>;

/**
 * Validates environment variables for all services
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
  
  return result.data;
}

/**
 * Validates environment variables for API service
 */
export function validateApiEnv(): ApiEnvConfig {
  const result = apiEnvSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
  
  return result.data;
}

/**
 * Validates environment variables for Bot service
 */
export function validateBotEnv(): BotEnvConfig {
  const result = botEnvSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
  
  return result.data;
}

/**
 * Generates a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}

/**
 * Generates a new JWT secret (for setup)
 */
export function generateJwtSecret(): string {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}