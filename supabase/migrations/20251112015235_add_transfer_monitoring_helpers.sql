/*
  # Add Transfer Monitoring Helpers

  1. Views and Functions
    - Add monitoring views for tracking transfer health
    - Add function to generate detailed audit reports
    - Add function for anomaly detection

  2. Monitoring Views
    - v_transfer_health_summary: Overall transfer consistency status
    - v_orphaned_transfer_entries: TRANSFER entries without stock_items
    - v_transfer_statistics_by_date: Daily transfer statistics

  3. Helper Functions
    - get_transfer_audit_report(): Generate comprehensive audit report
    - detect_transfer_anomalies(): Find unusual patterns
*/

-- View untuk monitoring kesehatan transfer
CREATE OR REPLACE VIEW v_transfer_health_summary AS
SELECT
  COUNT(DISTINCT CASE WHEN dl.gudang = 'TRANSFER' AND dl.type = 'IN' THEN dl.id END) as total_transfer_in_entries,
  COUNT(DISTINCT CASE 
    WHEN dl.gudang = 'TRANSFER' AND dl.type = 'IN'
    AND EXISTS (
      SELECT 1 FROM stock_items si
      WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
        AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
    )
    THEN dl.id
  END) as stock_items_with_matching_entry,
  COUNT(DISTINCT CASE 
    WHEN dl.gudang = 'TRANSFER' AND dl.type = 'IN'
    AND NOT EXISTS (
      SELECT 1 FROM stock_items si
      WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
        AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
    )
    THEN dl.id
  END) as missing_stock_items,
  ROUND(
    COUNT(DISTINCT CASE WHEN dl.gudang = 'TRANSFER' AND dl.type = 'IN' THEN dl.id END)::numeric /
    NULLIF(COUNT(DISTINCT CASE WHEN dl.gudang = 'TRANSFER' AND dl.type = 'IN' THEN dl.id END), 0) * 100,
    2
  ) as consistency_percentage
FROM database_log dl;

-- View untuk orphaned transfer entries
CREATE OR REPLACE VIEW v_orphaned_transfer_entries AS
SELECT
  dl.id,
  dl.sku,
  dl.rak,
  dl.sub_rak,
  dl.jumlah,
  dl.tgl,
  dl.waktu,
  dl.created_at,
  'MISSING_STOCK_ITEM' as issue_type
FROM database_log dl
WHERE dl.gudang = 'TRANSFER' 
  AND dl.type = 'IN'
  AND NOT EXISTS (
    SELECT 1 FROM stock_items si
    WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
      AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
  )
ORDER BY dl.created_at DESC;

-- View untuk transfer statistics by date
CREATE OR REPLACE VIEW v_transfer_statistics_by_date AS
SELECT
  DATE(dl.created_at) as transfer_date,
  COUNT(DISTINCT dl.id) as total_transfers,
  COUNT(DISTINCT dl.sku) as unique_products,
  COUNT(DISTINCT dl.rak) as unique_racks,
  SUM(dl.jumlah) FILTER (WHERE dl.type = 'IN') as total_quantity_in,
  SUM(dl.jumlah) FILTER (WHERE dl.type = 'OUT') as total_quantity_out,
  COUNT(DISTINCT CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM stock_items si
      WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
        AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
        AND dl.type = 'IN'
    ) AND dl.type = 'IN'
    THEN dl.id
  END) as orphaned_entries
FROM database_log dl
WHERE dl.gudang = 'TRANSFER'
GROUP BY DATE(dl.created_at)
ORDER BY transfer_date DESC;

-- Function untuk generate audit report
CREATE OR REPLACE FUNCTION get_transfer_audit_report()
RETURNS TABLE (
  report_date timestamptz,
  report_type text,
  total_transfer_entries integer,
  missing_stock_items integer,
  consistency_percentage numeric,
  recent_orphaned_count integer,
  last_transfer_date timestamp without time zone,
  backfill_operations_count integer,
  last_backfill_date timestamptz
) AS $$
DECLARE
  v_missing_count integer;
  v_total_transfers integer;
  v_consistency numeric;
  v_orphaned_count integer;
  v_last_transfer timestamp;
  v_backfill_ops integer;
  v_last_backfill timestamptz;
BEGIN
  SELECT
    MAX(total_transfer_in_entries),
    MAX(missing_stock_items),
    MAX(consistency_percentage)
  INTO v_total_transfers, v_missing_count, v_consistency
  FROM v_transfer_health_summary;

  SELECT COUNT(*) INTO v_orphaned_count FROM v_orphaned_transfer_entries;

  SELECT MAX(dl.created_at)::timestamp without time zone
  INTO v_last_transfer
  FROM database_log dl
  WHERE dl.gudang = 'TRANSFER';

  SELECT COUNT(*), MAX(created_at)
  INTO v_backfill_ops, v_last_backfill
  FROM stock_item_backfill_log;

  RETURN QUERY SELECT
    now(),
    'transfer_audit_report',
    v_total_transfers,
    v_missing_count,
    v_consistency,
    v_orphaned_count,
    v_last_transfer,
    v_backfill_ops,
    v_last_backfill;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function untuk detect anomalies
CREATE OR REPLACE FUNCTION detect_transfer_anomalies()
RETURNS TABLE (
  anomaly_type text,
  severity text,
  affected_items integer,
  description text,
  recommendation text
) AS $$
BEGIN
  -- Check for high orphaned entries
  RETURN QUERY
  SELECT
    'HIGH_ORPHANED_ENTRIES'::text as anomaly_type,
    CASE
      WHEN (SELECT missing_stock_items FROM v_transfer_health_summary) > 100 THEN 'CRITICAL'
      WHEN (SELECT missing_stock_items FROM v_transfer_health_summary) > 50 THEN 'HIGH'
      ELSE 'MEDIUM'
    END as severity,
    (SELECT missing_stock_items FROM v_transfer_health_summary)::integer as affected_items,
    'Banyak TRANSFER entries tidak memiliki stock_item yang sesuai'::text as description,
    'Jalankan backfill missing stock items segera'::text as recommendation
  WHERE (SELECT missing_stock_items FROM v_transfer_health_summary) > 0;

  -- Check for transfers without logs
  RETURN QUERY
  SELECT
    'INCONSISTENT_LOG_ENTRIES'::text,
    'MEDIUM',
    COUNT(*)::integer,
    'Ada stock_items tanpa log entry untuk transfer',
    'Verifikasi data manually dan update log entries'
  FROM stock_items
  WHERE rak NOT IN (SELECT DISTINCT rak FROM database_log WHERE gudang = 'TRANSFER')
    AND EXISTS (SELECT 1 FROM database_log WHERE gudang = 'TRANSFER')
  HAVING COUNT(*) > 0;

  -- Check for recent transfer spike
  RETURN QUERY
  SELECT
    'TRANSFER_SPIKE'::text,
    'INFO',
    COUNT(*)::integer,
    'Peningkatan aktivitas transfer dalam 24 jam terakhir',
    'Monitor closely untuk anomalies'
  FROM database_log
  WHERE gudang = 'TRANSFER'
    AND created_at > now() - interval '24 hours'
  HAVING COUNT(*) > (
    SELECT AVG(daily_count)::integer * 2
    FROM (
      SELECT COUNT(*) as daily_count
      FROM database_log
      WHERE gudang = 'TRANSFER'
        AND created_at > now() - interval '30 days'
      GROUP BY DATE(created_at)
    ) t
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create indexes for monitoring views
CREATE INDEX IF NOT EXISTS idx_database_log_gudang_type ON database_log (gudang, type);
CREATE INDEX IF NOT EXISTS idx_database_log_created_at_gudang ON database_log (created_at DESC, gudang);

-- Grant access to monitoring functions
ALTER TABLE stock_item_backfill_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to backfill logs"
  ON stock_item_backfill_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow public read access to backfill logs"
  ON stock_item_backfill_log
  FOR SELECT
  TO public
  USING (true);
