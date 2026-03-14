import { z } from 'zod';

/**
 * Validation schema for OTP send request
 */
export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.string().max(50).optional().default('verification')
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

/**
 * Validation schema for OTP verify request
 */
export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().regex(/^\d{4,8}$/, 'OTP code must be 4-8 digits')
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Response schemas (for documentation)
 */
export const sendOtpResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['sent', 'queued']),
  expires_in: z.number().int().positive(),
  masked_email: z.string()
});

export const verifyOtpResponseSchema = z.object({
  verified: z.boolean(),
  token: z.string().optional(),
  expires_at: z.string().optional(),
  error: z.string().optional(),
  attempts_remaining: z.number().int().optional()
});

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  retry_after: z.number().optional(),
  attempts_remaining: z.number().optional()
});

export const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  services: z.object({
    database: z.object({
      status: z.string(),
      latency_ms: z.number().optional()
    }),
    redis: z.object({
      status: z.string(),
      latency_ms: z.number().optional()
    }),
    queue: z.object({
      status: z.string(),
      depth: z.number().optional()
    })
  }),
  senders: z.array(z.object({
    id: z.string(),
    email: z.string(),
    provider: z.string(),
    status: z.string()
  })).optional()
});