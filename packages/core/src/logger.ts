import pino from 'pino';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LoggerOptions {
  name: string;
  level?: LogLevel;
}

/**
 * Creates a structured JSON logger using pino
 * In production, outputs JSON logs for easy parsing
 * In development, outputs pretty-printed logs
 */
export function createLogger(options: LoggerOptions) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return pino({
    name: options.name,
    level: options.level || (isProduction ? 'info' : 'debug'),
    transport: isProduction ? undefined : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    },
    serializers: {
      req: (req: { method?: string; url?: string; headers?: Record<string, string> }) => ({
        method: req.method,
        url: req.url,
        'user-agent': req.headers?.['user-agent']
      }),
      res: (res: { statusCode?: number }) => ({
        statusCode: res.statusCode
      }),
      err: pino.stdSerializers.err
    },
    // Redact sensitive fields
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["api-key"]',
        'password',
        'app_password',
        'app_password_enc',
        'otp',
        'otp_hash',
        'key_hash',
        'fullKey'
      ],
      censor: '[REDACTED]'
    }
  });
}

// Type for the logger instance
export type Logger = ReturnType<typeof createLogger>;