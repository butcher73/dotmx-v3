-- Migration: Add webhook_logs table
-- Stores raw webhook payloads before processing for debugging and replay

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL DEFAULT 'alchemy',
  webhook_id VARCHAR(100),
  event_type VARCHAR(50),
  network VARCHAR(50),
  payload JSONB NOT NULL,
  processing_result JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);

-- Status values: received, processed, rejected, error, reprocessed
