# MailGuard OSS Security Policy

## Overview

MailGuard OSS is designed with security as a primary concern. This document outlines our security practices and how to report vulnerabilities.

## Security Features

### Data Encryption

**App Passwords**
- All sender email app passwords are encrypted using AES-256-GCM
- Each encryption uses a fresh random IV (Initialization Vector)
- Authentication tags are stored and verified on decryption
- Encryption keys are never logged or exposed

**OTP Codes**
- OTP codes are hashed using bcrypt with a cost factor of 10
- OTP codes are NEVER stored in plaintext
- OTP codes are NEVER logged anywhere
- Verification uses constant-time comparison to prevent timing attacks

**API Keys**
- Only SHA-256 hashes of API keys are stored in the database
- Full API keys are shown ONCE at generation time
- API keys are prefixed for easy identification (`mg_live_` or `mg_test_`)

### Access Control

**Telegram Bot**
- Only the configured admin Telegram user ID can interact with the bot
- Non-admin messages receive no response (silent rejection)
- All administrative actions require explicit user interaction

**API Authentication**
- All API requests require Bearer token authentication
- API keys are cached with 60-second TTL for performance
- Invalid or expired keys receive 401 responses

### Rate Limiting

Rate limits are enforced to prevent abuse:

| Resource | Limit | Window |
|----------|-------|--------|
| OTPs per email | 10 | 1 hour |
| Requests per IP | 5 | 1 minute |
| Emails per project | 200 | 1 hour |
| API calls per key | 60 | 1 minute |

When rate limits are exceeded:
- HTTP 429 status code is returned
- `retry_after` field indicates wait time
- Rate limit headers are included in responses

### Secure Random Generation

MailGuard NEVER uses `Math.random()` for security-sensitive operations:

- **OTP codes**: Generated using `crypto.randomInt()`
- **API keys**: Generated using `crypto.randomBytes()`
- **IVs**: Generated using `crypto.randomBytes()`
- **JWT signatures**: Created using Node.js crypto module

### Input Validation

All API inputs are validated using Zod schemas:

- Email addresses validated for format
- OTP codes validated for numeric format and length
- String lengths enforced to prevent buffer attacks
- SQL injection prevented by using Supabase client

## Reporting Security Vulnerabilities

If you discover a security vulnerability in MailGuard OSS, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email your findings to security@mailguard.io
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We commit to:
- Acknowledging your report within 48 hours
- Providing an estimated timeline for a fix
- Notifying you when the fix is released
- Crediting you in our security advisories (if desired)

## Security Best Practices for Deployment

### Environment Variables

1. **Never commit `.env` files** to version control
2. Use strong, unique values for:
   - `JWT_SECRET` (256-bit minimum)
   - `ENCRYPTION_KEY` (exactly 64 hex characters)
3. Rotate secrets periodically
4. Use Railway/Heroku secrets management

### Database Security

1. Use Supabase Row Level Security (RLS) - enabled by default in schema
2. Never expose the service role key to client applications
3. Create read-only database users for analytics if needed

### Network Security

1. Always use HTTPS for API endpoints
2. Configure CORS appropriately for your application
3. Consider using a CDN for DDoS protection

### Monitoring

1. Monitor failed authentication attempts
2. Set up alerts for unusual traffic patterns
3. Review logs regularly for suspicious activity

## Security Checklist

Before deploying MailGuard OSS to production:

- [ ] All environment variables are properly set
- [ ] `JWT_SECRET` is at least 32 characters
- [ ] `ENCRYPTION_KEY` is exactly 64 hex characters
- [ ] Telegram admin UID is correctly configured
- [ ] Supabase service role key is not exposed
- [ ] Redis URL uses TLS (rediss://) in production
- [ ] Rate limiting is enabled and tested
- [ ] HTTPS is enabled for all endpoints
- [ ] Error messages do not expose sensitive information

## Security Updates

Security updates are released as patch versions. We recommend:

1. Subscribing to GitHub releases for notifications
2. Updating promptly when security patches are released
3. Testing updates in a staging environment first

## Contact

For security concerns: security@mailguard.io

For general questions: support@mailguard.io

GitHub Issues: https://github.com/mailguard/mailguard-oss/issues