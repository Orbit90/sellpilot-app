-- Migration 004: Hash Session Tokens in Database (Phase 3 Step 4)
-- Eliminates plaintext session tokens from persistent storage.
-- Replaces raw token with cryptographically secure SHA-256 token_hash.

-- 1. Ensure token_hash column exists
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- 2. Indexes for fast session lookup and multi-tenant security
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_business_id ON sessions(business_id);
