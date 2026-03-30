/*
  # Fix Auto-Sync Logs Schema

  1. Updates
    - Add missing columns to auto_sync_logs table
    - Ensure compatibility with edge function logging
    
  2. Changes
    - Add status column to track success/partial/error states
    - Add duration_ms column for millisecond precision
*/

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_sync_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE auto_sync_logs ADD COLUMN status text;
  END IF;
END $$;

-- Add duration_ms column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_sync_logs' AND column_name = 'duration_ms'
  ) THEN
    ALTER TABLE auto_sync_logs ADD COLUMN duration_ms integer;
  END IF;
END $$;
