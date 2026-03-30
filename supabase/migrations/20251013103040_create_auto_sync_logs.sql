/*
  # Create Auto-Sync Logs and Settings Tables

  1. New Tables
    - `auto_sync_logs`
      - `id` (bigint, primary key)
      - `sync_type` (text) - 'stock' or 'packing'
      - `status` (text) - 'success', 'partial', 'error'
      - `items_updated` (int)
      - `errors` (int)
      - `message` (text)
      - `duration_ms` (int)
      - `created_at` (timestamptz)
    
    - `auto_sync_settings`
      - `id` (bigint, primary key)
      - `sync_type` (text) - 'stock' or 'packing'
      - `enabled` (boolean)
      - `interval_minutes` (int)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on tables
    - Add policies for authenticated access
*/

-- Create auto_sync_logs table
CREATE TABLE IF NOT EXISTS auto_sync_logs (
  id bigserial PRIMARY KEY,
  sync_type text NOT NULL CHECK (sync_type IN ('stock', 'packing')),
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  items_updated int DEFAULT 0,
  errors int DEFAULT 0,
  message text,
  duration_ms int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create auto_sync_settings table
CREATE TABLE IF NOT EXISTS auto_sync_settings (
  id bigserial PRIMARY KEY,
  sync_type text UNIQUE NOT NULL CHECK (sync_type IN ('stock', 'packing')),
  enabled boolean DEFAULT false,
  interval_minutes int DEFAULT 5,
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings if not exists
INSERT INTO auto_sync_settings (sync_type, enabled, interval_minutes)
VALUES 
  ('stock', true, 5),
  ('packing', true, 5)
ON CONFLICT (sync_type) DO NOTHING;

-- Enable RLS
ALTER TABLE auto_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_sync_settings ENABLE ROW LEVEL SECURITY;

-- Policies for auto_sync_logs (read for all authenticated users)
CREATE POLICY "Anyone can read sync logs"
  ON auto_sync_logs FOR SELECT
  TO authenticated
  USING (true);

-- Policies for auto_sync_settings (read for all, update for authenticated)
CREATE POLICY "Anyone can read sync settings"
  ON auto_sync_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update sync settings"
  ON auto_sync_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_auto_sync_logs_created_at ON auto_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_sync_logs_sync_type ON auto_sync_logs(sync_type);