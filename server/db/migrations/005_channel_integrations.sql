-- ====================================================================
-- SellPilot Migration 005: Official WhatsApp Business Cloud API & Channel Architecture
-- Multi-tenant isolation for social commerce messaging channels
-- ====================================================================

-- 1. CHANNEL CONNECTIONS
CREATE TABLE IF NOT EXISTS channel_connections (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  external_account_id TEXT,
  external_phone_number_id TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  encrypted_access_token TEXT,
  access_token_iv TEXT,
  access_token_tag TEXT,
  webhook_verify_token TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_conn_biz_type ON channel_connections(business_id, channel_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_conn_phone_id ON channel_connections(external_phone_number_id) WHERE external_phone_number_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_conn_status ON channel_connections(status);

-- 2. CHANNEL MESSAGES
CREATE TABLE IF NOT EXISTS channel_messages (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel_connection_id TEXT REFERENCES channel_connections(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL DEFAULT 'whatsapp',
  external_conversation_id TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  customer_identifier TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_msg_biz ON channel_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_channel_msg_ext_id ON channel_messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_channel_msg_conv ON channel_messages(business_id, external_conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_msg_cust ON channel_messages(business_id, customer_identifier);
CREATE INDEX IF NOT EXISTS idx_channel_msg_created ON channel_messages(business_id, created_at DESC);

-- 3. WEBHOOK DEDUPLICATION EVENTS
CREATE TABLE IF NOT EXISTS channel_webhook_events (
  event_id TEXT PRIMARY KEY,
  channel_type TEXT NOT NULL DEFAULT 'whatsapp',
  business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON channel_webhook_events(processed_at);

-- 4. CONVERSATION HUMAN HANDOFFS
CREATE TABLE IF NOT EXISTS conversation_handoffs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL DEFAULT 'whatsapp',
  customer_identifier TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_human',
  reason TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  last_message_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_biz_cust ON conversation_handoffs(business_id, customer_identifier);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON conversation_handoffs(business_id, status);
CREATE INDEX IF NOT EXISTS idx_handoffs_created ON conversation_handoffs(business_id, created_at DESC);
