/*
  # Remove version column from update_notifications

  1. Changes
    - Remove `version` column from `update_notifications` table
  
  2. Notes
    - This migration safely drops the version column as it's no longer needed
*/

-- Drop the version column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'update_notifications' AND column_name = 'version'
  ) THEN
    ALTER TABLE update_notifications DROP COLUMN version;
  END IF;
END $$;