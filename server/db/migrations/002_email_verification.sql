-- Migration 002: Email Verification System for SellPilot
-- Adds email verification status and dedicated verification token table

-- 1. Add email verification fields to users table (default TRUE for existing users to preserve access)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast lookup and security
CREATE INDEX IF NOT EXISTS idx_evt_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_evt_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
