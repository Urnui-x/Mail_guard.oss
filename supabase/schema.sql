-- MailGuard OSS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sender email accounts (developer's Gmail/Outlook/etc)
CREATE TABLE IF NOT EXISTS sender_emails (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address    VARCHAR(255) NOT NULL UNIQUE,
  display_name     VARCHAR(100),
  provider         VARCHAR(50) NOT NULL,  -- gmail | outlook | zoho | yahoo | other
  smtp_host        VARCHAR(255) NOT NULL, -- auto-resolved, never entered by developer
  smtp_port        SMALLINT NOT NULL,     -- auto-resolved, never entered by developer
  app_password_enc TEXT NOT NULL,         -- AES-256-GCM encrypted
  daily_limit      INTEGER NOT NULL,      -- auto-set: 500 gmail, 300 outlook, 200 zoho, 500 yahoo
  is_verified      BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true,
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Projects — one per developer app
CREATE TABLE IF NOT EXISTS projects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(100) NOT NULL,
  slug               VARCHAR(100) NOT NULL UNIQUE,
  sender_email_id    UUID REFERENCES sender_emails(id) ON DELETE SET NULL,
  otp_length         SMALLINT DEFAULT 6,
  otp_expiry_seconds INTEGER DEFAULT 600,
  otp_max_attempts   SMALLINT DEFAULT 5,
  otp_subject_tmpl   TEXT,
  otp_body_tmpl      TEXT,
  otp_format         VARCHAR(10) DEFAULT 'text', -- text | html
  rate_limit_per_hour INTEGER DEFAULT 10,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- API keys — generated via bot, used by developer apps
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  key_hash    VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 of full key, never store plaintext
  key_prefix  VARCHAR(12) NOT NULL,         -- first 8 chars for display
  label       VARCHAR(100),
  is_sandbox  BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- OTP records — one row per OTP sent
CREATE TABLE IF NOT EXISTS otp_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  otp_hash        VARCHAR(255) NOT NULL, -- bcrypt hash, NEVER store plaintext
  purpose         VARCHAR(50) DEFAULT 'verification',
  attempts_count  SMALLINT DEFAULT 0,
  is_verified     BOOLEAN DEFAULT false,
  is_invalidated  BOOLEAN DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL,
  verified_at     TIMESTAMPTZ,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for OTP lookup queries
CREATE INDEX IF NOT EXISTS idx_otp_lookup
  ON otp_records(recipient_email, project_id, is_verified, is_invalidated, expires_at);

-- Index for project-based OTP queries
CREATE INDEX IF NOT EXISTS idx_otp_project
  ON otp_records(project_id, created_at);

-- Email logs — every email dispatched
CREATE TABLE IF NOT EXISTS email_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  sender_email_id  UUID REFERENCES sender_emails(id) ON DELETE SET NULL,
  type             VARCHAR(20) NOT NULL, -- otp | transactional | template
  recipient_email  VARCHAR(255) NOT NULL,
  subject          VARCHAR(500),
  status           VARCHAR(20) DEFAULT 'queued', -- queued | sent | delivered | bounced | failed
  smtp_message_id  VARCHAR(255),
  error_message    TEXT,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_email_logs_project
  ON email_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_status
  ON email_logs(status, created_at);

-- Bot session storage for grammY multi-step conversations
CREATE TABLE IF NOT EXISTS bot_sessions (
  key        VARCHAR(255) PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Function to increment OTP attempts atomically
CREATE OR REPLACE FUNCTION increment_otp_attempts(otp_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE otp_records
  SET attempts_count = attempts_count + 1
  WHERE id = otp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily email counts for a sender
CREATE OR REPLACE FUNCTION get_sender_daily_count(sender_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM email_logs
  WHERE sender_email_id = sender_id
    AND created_at >= CURRENT_DATE;
  
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otp_records
  WHERE expires_at < now()
    AND is_verified = false
    AND is_invalidated = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) policies
-- These are optional but recommended for production

-- Enable RLS on all tables
ALTER TABLE sender_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
CREATE POLICY "Service role has full access on sender_emails"
  ON sender_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access on projects"
  ON projects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access on api_keys"
  ON api_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access on otp_records"
  ON otp_records FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access on email_logs"
  ON email_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access on bot_sessions"
  ON bot_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);