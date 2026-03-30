/*
  # Create Update Notifications System

  1. New Tables
    - `update_notifications`
      - `id` (uuid, primary key) - Unique identifier for each notification
      - `title` (text) - Title of the update notification
      - `content` (text) - Content/description of the update
      - `version` (text) - Version number or identifier
      - `is_active` (boolean) - Whether this notification is currently active
      - `created_at` (timestamptz) - When the notification was created
      - `updated_at` (timestamptz) - When the notification was last updated
    
  2. Security
    - Enable RLS on `update_notifications` table
    - Add policy for anyone to read active notifications
    - Note: Only database administrators can create/update notifications through direct database access or backend functions
  
  3. Important Notes
    - Only one notification should be active at a time (enforced by application logic)
    - User acknowledgment is stored in localStorage on client side
    - Each notification has a unique ID that is used to track if user has read it
*/

-- Create update_notifications table
CREATE TABLE IF NOT EXISTS update_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  version text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE update_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active notifications (no auth required for public access)
CREATE POLICY "Anyone can read active notifications"
  ON update_notifications
  FOR SELECT
  USING (is_active = true);

-- Create index for faster queries on active notifications
CREATE INDEX IF NOT EXISTS idx_update_notifications_active ON update_notifications(is_active) WHERE is_active = true;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_update_notifications_updated_at
  BEFORE UPDATE ON update_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_update_notifications_updated_at();