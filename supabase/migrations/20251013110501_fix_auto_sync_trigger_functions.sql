/*
  # Fix Auto-Sync Trigger Functions

  1. Updates
    - Drop old trigger functions
    - Create new trigger functions that call edge functions via http
    - These functions are called by cron jobs every 5 minutes
    
  2. Security
    - Functions use service role to call edge functions
*/

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS trigger_stock_sync();
DROP FUNCTION IF EXISTS trigger_packing_sync();
DROP FUNCTION IF EXISTS trigger_auto_sync_stock();
DROP FUNCTION IF EXISTS trigger_auto_sync_packing();

-- Create function to trigger stock sync via edge function
CREATE OR REPLACE FUNCTION trigger_auto_sync_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://yrmkclmdarszgyazbncg.supabase.co/functions/v1/auto-sync-stock',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
END;
$$;

-- Create function to trigger packing sync via edge function
CREATE OR REPLACE FUNCTION trigger_auto_sync_packing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://yrmkclmdarszgyazbncg.supabase.co/functions/v1/auto-sync-packing',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
END;
$$;

-- Remove any existing duplicate cron jobs
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid FROM cron.job WHERE jobname IN ('auto-sync-stock-job', 'auto-sync-packing-job')
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

-- Ensure the main cron jobs exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-sync-stock') THEN
    PERFORM cron.schedule(
      'auto-sync-stock',
      '*/5 * * * *',
      'SELECT public.trigger_auto_sync_stock();'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-sync-packing') THEN
    PERFORM cron.schedule(
      'auto-sync-packing',
      '*/5 * * * *',
      'SELECT public.trigger_auto_sync_packing();'
    );
  END IF;
END $$;
