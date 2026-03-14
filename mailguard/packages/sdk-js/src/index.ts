/**
 * MailGuard SDK for JavaScript/TypeScript
 * 
 * A lightweight SDK for interacting with MailGuard OSS API
 * Zero external dependencies - uses native fetch
 */

// Types
export interface MailGuardConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SendOtpOptions {
  email: string;
  purpose?: string;
}

export interface SendOtpResponse {
  id: string;
  status: 'sent' | 'queued';
  expires_in: number;
  masked_email: string;
}

export interface VerifyOtpOptions {
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
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  retry_after?: number;
  attempts_remaining?: number;
}

// Error classes
export class MailGuardError extends Error {
  public code: string;
  public retryAfter?: number;
  public attemptsRemaining?: number;

  constructor(response: ApiErrorResponse) {
    super(response.message || response.error);
    this.name = 'MailGuardError';
    this.code = response.error;
    this.retryAfter = response.retry_after;
    this.attemptsRemaining = response.attempts_remaining;
  }
}

export class RateLimitError extends MailGuardError {
  constructor(response: ApiErrorResponse) {
    super(response);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends MailGuardError {
  constructor(response: ApiErrorResponse) {
    super(response);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends MailGuardError {
  constructor(response: ApiErrorResponse) {
    super(response);
    this.name = 'AuthenticationError';
  }
}

// SDK class
export class MailGuard {
  private static instance: MailGuard | null = null;
  private apiKey: string;
  private baseUrl: string;

  private constructor(config: MailGuardConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.mailguard.io').replace(/\/$/, '');
  }

  /**
   * Initialize the SDK with configuration
   */
  public static init(config: MailGuardConfig): MailGuard {
    MailGuard.instance = new MailGuard(config);
    return MailGuard.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): MailGuard {
    if (!MailGuard.instance) {
      throw new Error('MailGuard SDK not initialized. Call MailGuard.init() first.');
    }
    return MailGuard.instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  public static reset(): void {
    MailGuard.instance = null;
  }

  /**
   * Make an API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiErrorResponse;
      
      if (response.status === 429) {
        throw new RateLimitError(error);
      }
      if (response.status === 401) {
        throw new AuthenticationError(error);
      }
      if (response.status === 400) {
        throw new ValidationError(error);
      }
      
      throw new MailGuardError(error);
    }

    return data as T;
  }

  /**
   * Send an OTP to an email address
   */
  public async sendOtp(options: SendOtpOptions): Promise<SendOtpResponse> {
    return this.request<SendOtpResponse>('POST', '/api/v1/otp/send', {
      email: options.email,
      purpose: options.purpose
    });
  }

  /**
   * Verify an OTP code
   */
  public async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResponse> {
    return this.request<VerifyOtpResponse>('POST', '/api/v1/otp/verify', {
      email: options.email,
      code: options.code
    });
  }

  /**
   * Check API health
   */
  public async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }
}

// Convenience methods
export const otp = {
  send: async (options: SendOtpOptions): Promise<SendOtpResponse> => {
    return MailGuard.getInstance().sendOtp(options);
  },
  verify: async (options: VerifyOtpOptions): Promise<VerifyOtpResponse> => {
    return MailGuard.getInstance().verifyOtp(options);
  }
};

export const health = async (): Promise<HealthResponse> => {
  return MailGuard.getInstance().health();
};

// Default export
export default MailGuard;