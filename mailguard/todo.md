# MailGuard OSS Build Tasks

## Phase 1: Project Setup & Core Packages
- [x] Create root folder structure
- [x] Create root package.json with workspaces
- [x] Create packages/core (shared utilities)
  - [x] crypto.ts - AES-256-GCM encryption
  - [x] otp.ts - OTP generation and bcrypt hashing
  - [x] apiKey.ts - API key generation and hashing
  - [x] rateLimit.ts - Redis sliding window rate limiting
  - [x] db.ts - Supabase client
  - [x] types.ts - Shared TypeScript types
  - [x] jwt.ts - JWT signing and verification
  - [x] logger.ts - Pino structured logging
  - [x] redis.ts - Redis client and helpers
  - [x] env.ts - Environment validation
  - [x] index.ts - Exports
- [x] Create packages/smtp (email provider detection)
  - [x] detector.ts - Provider auto-detection
  - [x] sender.ts - Nodemailer wrapper
  - [x] templates.ts - Email template rendering
  - [x] index.ts - Exports

## Phase 2: Database Schema
- [x] Create supabase/schema.sql with all tables

## Phase 3: API Server (apps/api)
- [x] Create Fastify server with routes
- [x] Middleware - API key authentication
- [x] POST /api/v1/otp/send
- [x] POST /api/v1/otp/verify
- [x] GET /health
- [x] Zod validation schemas
- [x] Error handling

## Phase 4: Worker Service (apps/worker)
- [x] BullMQ worker setup
- [x] send-email job processor
- [x] Retry logic with exponential backoff
- [x] Cleanup cron job
- [x] Telegram notifications on failure

## Phase 5: Telegram Bot (apps/bot)
- [x] Bot setup with grammY
- [x] Admin middleware
- [x] /start command
- [x] /addemail wizard
- [x] /newproject wizard
- [x] /setotp command
- [x] /genkey command
- [x] /senders command
- [x] /projects command
- [x] /logs command
- [x] Notification handlers

## Phase 6: SDKs
- [x] JavaScript SDK (packages/sdk-js)
- [x] Python SDK (packages/sdk-python)
- [x] PHP SDK (packages/sdk-php)
- [x] Go SDK (packages/sdk-go)

## Phase 7: Deployment & Documentation
- [x] Dockerfile for each service
- [x] railway.toml
- [x] docker-compose.yml
- [x] .env.example
- [x] README.md
- [x] SECURITY.md

## All Tasks Complete! ✅