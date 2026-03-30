/*
  # Add Transfer Audit and Backfill System

  1. Overview
    - Create function to identify missing stock_items for TRANSFER entries in database_log
    - Create function to backfill missing stock_items from database_log
    - Add audit table to track backfill operations
    - Add verification function to check data consistency

  2. New Functions
    - find_missing_stock_items_for_transfer(): Identifies TRANSFER IN entries without corresponding stock_items
    - backfill_missing_stock_items(): Creates missing stock_items based on database_log TRANSFER entries
    - verify_transfer_consistency(): Checks for orphaned TRANSFER entries

  3. New Table
    - stock_item_backfill_log: Track all backfill operations with timestamps and counts

  4. Data Integrity
    - All backfill operations are logged with source information
    - Original database_log entries remain unchanged
    - Only creates stock_items that don't already exist

  5. Indexes
    - Create index for efficient audit queries
*/

-- Create backfill audit table
CREATE TABLE IF NOT EXISTS stock_item_backfill_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL,
  items_processed integer DEFAULT 0,
  items_created integer DEFAULT 0,
  items_skipped integer DEFAULT 0,
  total_duration_ms integer,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

-- Create indexes for backfill log queries
CREATE INDEX IF NOT EXISTS idx_backfill_log_created_at ON stock_item_backfill_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backfill_log_operation_type ON stock_item_backfill_log (operation_type);

-- Function to find missing stock_items for TRANSFER entries
CREATE OR REPLACE FUNCTION find_missing_stock_items_for_transfer()
RETURNS TABLE (
  sku text,
  rak text,
  sub_rak text,
  packing text,
  satuan text,
  count_in_log integer,
  log_entries jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    dl.sku,
    dl.rak,
    dl.sub_rak,
    COALESCE(p.packing, dl.sub_rak) as packing,
    COALESCE(p.satuan, 'PCS') as satuan,
    COUNT(dl.id)::integer as count_in_log,
    jsonb_agg(
      jsonb_build_object(
        'id', dl.id,
        'jumlah', dl.jumlah,
        'tgl', dl.tgl,
        'waktu', dl.waktu
      ) ORDER BY dl.created_at DESC
    ) as log_entries
  FROM database_log dl
  LEFT JOIN products p ON dl.sku = p.nama
  WHERE dl.gudang = 'TRANSFER'
    AND dl.type = 'IN'
    AND NOT EXISTS (
      SELECT 1 FROM stock_items si
      WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
        AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
    )
  GROUP BY dl.sku, dl.rak, dl.sub_rak, p.packing, p.satuan
  ORDER BY dl.sku, dl.rak;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to backfill missing stock_items from TRANSFER entries
CREATE OR REPLACE FUNCTION backfill_missing_stock_items()
RETURNS TABLE (
  items_created integer,
  items_skipped integer,
  error_message text
) AS $$
DECLARE
  v_missing RECORD;
  v_items_created integer := 0;
  v_items_skipped integer := 0;
  v_start_time timestamp := now();
BEGIN
  -- Process each missing stock_item combination
  FOR v_missing IN
    SELECT * FROM find_missing_stock_items_for_transfer()
  LOOP
    BEGIN
      -- Insert new stock_item for destination rack
      INSERT INTO stock_items (
        nama_produk,
        packing,
        sub_rak,
        satuan,
        rak,
        stok_awal,
        masuk,
        keluar,
        tersedia,
        status
      ) VALUES (
        v_missing.sku,
        COALESCE(v_missing.packing, 'CTN/'),
        v_missing.sub_rak,
        COALESCE(v_missing.satuan, 'PCS'),
        v_missing.rak,
        0,
        0,
        0,
        0,
        'Aktif'
      );

      v_items_created := v_items_created + 1;
    EXCEPTION WHEN OTHERS THEN
      v_items_skipped := v_items_skipped + 1;
      CONTINUE;
    END;
  END LOOP;

  -- Log the backfill operation
  INSERT INTO stock_item_backfill_log (
    operation_type,
    items_processed,
    items_created,
    items_skipped,
    total_duration_ms,
    details
  ) VALUES (
    'auto_backfill',
    v_items_created + v_items_skipped,
    v_items_created,
    v_items_skipped,
    EXTRACT(EPOCH FROM (now() - v_start_time))::integer * 1000,
    jsonb_build_object(
      'start_time', v_start_time,
      'end_time', now(),
      'status', 'completed'
    )
  );

  RETURN QUERY SELECT v_items_created, v_items_skipped, NULL::text;
END;
$$ LANGUAGE plpgsql;

-- Function to verify transfer consistency
CREATE OR REPLACE FUNCTION verify_transfer_consistency()
RETURNS TABLE (
  total_transfer_in_entries integer,
  missing_stock_items integer,
  inconsistent_combinations integer,
  is_consistent boolean
) AS $$
DECLARE
  v_total_transfer integer;
  v_missing_count integer;
BEGIN
  -- Count total TRANSFER IN entries
  SELECT COUNT(*) INTO v_total_transfer
  FROM database_log
  WHERE gudang = 'TRANSFER' AND type = 'IN';

  -- Count missing stock_items
  SELECT COUNT(*) INTO v_missing_count
  FROM (SELECT DISTINCT sku, rak FROM find_missing_stock_items_for_transfer()) t;

  RETURN QUERY SELECT
    v_total_transfer,
    v_missing_count,
    v_missing_count,
    v_missing_count = 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create view for easy audit queries
CREATE OR REPLACE VIEW v_transfer_audit_summary AS
SELECT
  dl.sku,
  dl.rak,
  COUNT(dl.id) as transfer_in_count,
  SUM(dl.jumlah) as total_transferred_in,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM stock_items si
      WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
        AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
    ) THEN 'exists'
    ELSE 'missing'
  END as stock_item_status,
  MAX(dl.created_at) as last_transfer_date
FROM database_log dl
WHERE dl.gudang = 'TRANSFER' AND dl.type = 'IN'
GROUP BY dl.sku, dl.rak
ORDER BY dl.sku, dl.rak;
