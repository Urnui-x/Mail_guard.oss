// API Request/Response types
export interface SendOtpRequest {
  email: string;
  purpose?: string;
}

export interface SendOtpResponse {
  id: string;
  status: 'sent' | 'queued';
  expires_in: number;
  masked_email: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  token?: string;
  expires_at?: string;
  error?: string;
  attempts_remaining?: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: { status: string; latency_ms?: number };
    redis: { status: string; latency_ms?: number };
    queue: { status: string; depth?: number };
  };
  senders?: Array<{
    id: string;
    email: string;
    provider: string;
    status: string;
  }>;
}

// Job types
export interface SendEmailJob {
  name: 'send-email';
  data: SendEmailJobData;
}

export interface SendEmailJobData {
  senderEmailId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  format: 'text' | 'html';
  emailLogId: string;
  projectId: string;
  otpRecordId?: string;
}

// Telegram Bot types
export interface BotSessionData {
  step?: string;
  email?: string;
  displayName?: string;
  appPassword?: string;
  provider?: string;
  smtpHost?: string;
  smtpPort?: number;
  dailyLimit?: number;
  senderId?: string;
  
  // Project creation
  projectName?: string;
  projectSlug?: string;
  otpLength?: number;
  otpExpiry?: number;
  maxAttempts?: number;
  
  // OTP template
  otpSubject?: string;
  otpBody?: string;
  otpFormat?: 'text' | 'html';
  editingSlug?: string;
  
  // Key generation
  keyLabel?: string;
  isTestKey?: boolean;
}

// Notification types
export interface SmtpFailureNotification {
  type: 'smtp_failure';
  senderEmail: string;
  error: string;
  projectName: string;
  attempts: number;
}

export interface RateLimitHitNotification {
  type: 'rate_limit_hit';
  tier: string;
  projectName: string;
  key: string;
  limit: number;
}

export interface DailySummaryNotification {
  type: 'daily_summary';
  sentCount: number;
  failedCount: number;
  queueDepth: number;
  date: string;
}

export type Notification = 
  | SmtpFailureNotification 
  | RateLimitHitNotification 
  | DailySummaryNotification;

// Environment validation schema types
export interface EnvConfig {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_UID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  NODE_ENV?: string;
  PORT?: number;
  INTERNAL_API_URL?: string;
}

// Error types
export type ApiErrorCode = 
  | 'unauthorized'
  | 'invalid_api_key'
  | 'rate_limit_exceeded'
  | 'otp_expired'
  | 'invalid_code'
  | 'account_locked'
  | 'sender_not_configured'
  | 'email_send_failed'
  | 'validation_error'
  | 'internal_error';

export interface ApiError {
  error: ApiErrorCode;
  message?: string;
  retry_after?: number;
  attempts_remaining?: number;
}

// Pagination
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Stats
export interface ProjectStats {
  otps_sent_today: number;
  otps_verified_today: number;
  failed_emails_today: number;
  active_otps: number;
}

export interface SenderStats {
  emails_sent_today: number;
  last_used: string | null;
  status: 'active' | 'inactive' | 'error';
}