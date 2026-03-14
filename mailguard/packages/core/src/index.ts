// Encryption and security
export { encrypt, decrypt, generateRandomHex } from './crypto.js';

// OTP generation and verification
export { generateOtp, hashOtp, verifyOtp, isValidOtpFormat } from './otp.js';

// API key management
export {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  isTestKey,
  getKeyPrefix,
  maskEmail
} from './apiKey.js';

// Rate limiting
export {
  checkRateLimit,
  checkRateLimitFixed,
  resetRateLimit,
  getRateLimitStatus,
  RateLimitKeys,
  type RateLimitResult
} from './rateLimit.js';

// Database
export {
  supabase,
  getSupabase,
  db,
  type SenderEmail,
  type Project,
  type ApiKey,
  type OtpRecord,
  type EmailLog,
  type BotSession
} from './db.js';

// Redis
export {
  getRedis,
  closeRedis,
  checkRedisHealth,
  cacheApiKey,
  getCachedApiKey,
  invalidateCachedApiKey
} from './redis.js';

// JWT
export { signJwt, verifyJwt, decodeJwt } from './jwt.js';

// Logging
export { createLogger, type Logger } from './logger.js';

// Environment validation
export {
  validateEnv,
  validateApiEnv,
  validateBotEnv,
  generateEncryptionKey,
  generateJwtSecret,
  type EnvConfig,
  type ApiEnvConfig,
  type BotEnvConfig
} from './env.js';

// Types
export type {
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  HealthResponse,
  SendEmailJob,
  SendEmailJobData,
  BotSessionData,
  SmtpFailureNotification,
  RateLimitHitNotification,
  DailySummaryNotification,
  Notification,
  ApiErrorCode,
  ApiError,
  PaginatedResult,
  ProjectStats,
  SenderStats
} from './types.js';