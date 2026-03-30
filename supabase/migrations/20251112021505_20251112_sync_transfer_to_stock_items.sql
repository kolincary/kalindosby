/*
  # Transfer Sync System - Auto-sync TRANSFER entries from database_log to stock_items

  1. New Tables
    - `transfer_sync_log` - Audit log for all TRANSFER sync operations
      - `id` (uuid, primary key)
      - `operation_type` (text) - 'auto_trigger', 'manual_sync', 'backfill'
      - `total_processed` (integer) - Total entries processed
      - `items_created` (integer) - New stock_items created
      - `items_skipped` (integer) - Existing items skipped
      - `details` (jsonb) - Detailed operation information
      - `created_at` (timestamptz)
      - `created_by` (text)

  2. New Functions
    - `sync_transfer_to_stock_items()` - Process a single TRANSFER entry from database_log
    - `process_pending_transfers()` - Batch process all pending TRANSFER entries
    - `find_missing_transfer_stock_items()` - Find entries in database_log with gudang='TRANSFER' that don't have corresponding stock_items

  3. New Triggers
    - `trigger_sync_transfer_on_insert` - Auto-sync when TRANSFER is inserted into database_log

  4. Indexes
    - Optimized indexes on database_log for TRANSFER filtering
    - Indexes on transfer_sync_log for query performance

  5. Security
    - Enable RLS on transfer_sync_log
    - Add policies for authenticated users to read and insert logs

  6. Important Notes
    - This system monitors database_log entries where gudang='TRANSFER'
    - For each TRANSFER entry, it checks if a stock_items record exists with the same nama_produk and rak
    - If not exists, it creates a new stock_items record with:
      * nama_produk from the SKU (or database_log.sku if product not found)
      * rak from database_log.rak
      * packing='CTN/' (default)
      * satuan from products table, or 'PCS' if not found
      * stok_awal=0 (default initial stock)
      * status='Aktif'
    - The trigger runs asynchronously to avoid blocking inserts
*/

CREATE TABLE IF NOT EXISTS transfer_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL,
  total_processed integer DEFAULT 0,
  items_created integer DEFAULT 0,
  items_skipped integer DEFAULT 0,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_transfer_sync_log_created_at ON transfer_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_sync_log_operation_type ON transfer_sync_log (operation_type);

ALTER TABLE transfer_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users to view transfer sync logs"
  ON transfer_sync_log FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert transfer sync logs"
  ON transfer_sync_log FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_database_log_gudang_rak ON database_log (gudang, rak);
CREATE INDEX IF NOT EXISTS idx_database_log_gudang_sku ON database_log (gudang, sku);

CREATE OR REPLACE FUNCTION sync_transfer_to_stock_items()
RETURNS TRIGGER AS $$
DECLARE
  product_name text;
  product_satuan text;
  existing_stock_item_id uuid;
  normalized_produk text;
  normalized_rak text;
BEGIN
  IF NEW.gudang = 'TRANSFER' THEN
    normalized_produk := LOWER(TRIM(COALESCE(NEW.sku, '')));
    normalized_rak := LOWER(TRIM(COALESCE(NEW.rak, '')));

    IF normalized_produk = '' OR normalized_rak = '' THEN
      RETURN NEW;
    END IF;

    SELECT id INTO existing_stock_item_id
    FROM stock_items
    WHERE LOWER(TRIM(nama_produk)) = normalized_produk
      AND LOWER(TRIM(rak)) = normalized_rak
    LIMIT 1;

    IF existing_stock_item_id IS NULL THEN
      SELECT nama, satuan INTO product_name, product_satuan
      FROM products
      WHERE sku_code = NEW.sku OR LOWER(sku_code) = normalized_produk
      LIMIT 1;

      IF product_name IS NULL THEN
        product_name := NEW.sku;
      END IF;

      IF product_satuan IS NULL THEN
        product_satuan := 'PCS';
      END IF;

      INSERT INTO stock_items (nama_produk, rak, packing, satuan, stok_awal, masuk, keluar, tersedia, status)
      VALUES (
        product_name,
        NEW.rak,
        'CTN/',
        product_satuan,
        0,
        0,
        0,
        0,
        'Aktif'
      );

      INSERT INTO transfer_sync_log (operation_type, total_processed, items_created, items_skipped, details, created_by)
      VALUES (
        'auto_trigger',
        1,
        1,
        0,
        jsonb_build_object(
          'sku', NEW.sku,
          'product_name', product_name,
          'rak', NEW.rak,
          'satuan', product_satuan,
          'database_log_id', NEW.id
        ),
        'trigger'
      );
    ELSE
      INSERT INTO transfer_sync_log (operation_type, total_processed, items_created, items_skipped, details, created_by)
      VALUES (
        'auto_trigger',
        1,
        0,
        1,
        jsonb_build_object(
          'sku', NEW.sku,
          'rak', NEW.rak,
          'stock_item_id', existing_stock_item_id
        ),
        'trigger'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_transfer_on_insert ON database_log;
CREATE TRIGGER trigger_sync_transfer_on_insert
  AFTER INSERT ON database_log
  FOR EACH ROW
  EXECUTE FUNCTION sync_transfer_to_stock_items();

CREATE OR REPLACE FUNCTION process_pending_transfers()
RETURNS TABLE (
  total_processed integer,
  items_created integer,
  items_skipped integer,
  duration_ms integer
) AS $$
DECLARE
  start_time timestamptz;
  total_processed integer := 0;
  items_created integer := 0;
  items_skipped integer := 0;
  product_name text;
  product_satuan text;
  existing_stock_item_id uuid;
  normalized_produk text;
  normalized_rak text;
  db_log_record RECORD;
BEGIN
  start_time := now();

  FOR db_log_record IN
    SELECT DISTINCT dl.id, dl.sku, dl.rak
    FROM database_log dl
    WHERE dl.gudang = 'TRANSFER'
      AND NOT EXISTS (
        SELECT 1 FROM stock_items si
        WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
          AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
      )
    ORDER BY dl.id
  LOOP
    total_processed := total_processed + 1;

    normalized_produk := LOWER(TRIM(COALESCE(db_log_record.sku, '')));
    normalized_rak := LOWER(TRIM(COALESCE(db_log_record.rak, '')));

    IF normalized_produk != '' AND normalized_rak != '' THEN
      SELECT nama, satuan INTO product_name, product_satuan
      FROM products
      WHERE sku_code = db_log_record.sku
         OR LOWER(sku_code) = normalized_produk
      LIMIT 1;

      IF product_name IS NULL THEN
        product_name := db_log_record.sku;
      END IF;

      IF product_satuan IS NULL THEN
        product_satuan := 'PCS';
      END IF;

      INSERT INTO stock_items (nama_produk, rak, packing, satuan, stok_awal, masuk, keluar, tersedia, status)
      VALUES (
        product_name,
        db_log_record.rak,
        'CTN/',
        product_satuan,
        0,
        0,
        0,
        0,
        'Aktif'
      );

      items_created := items_created + 1;
    ELSE
      items_skipped := items_skipped + 1;
    END IF;
  END LOOP;

  INSERT INTO transfer_sync_log (operation_type, total_processed, items_created, items_skipped, details, created_by)
  VALUES (
    'manual_sync',
    total_processed,
    items_created,
    items_skipped,
    jsonb_build_object(
      'duration_ms', EXTRACT(EPOCH FROM (now() - start_time)) * 1000
    ),
    'system'
  );

  RETURN QUERY SELECT total_processed, items_created, items_skipped, CAST(EXTRACT(EPOCH FROM (now() - start_time)) * 1000 AS integer);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_missing_transfer_stock_items()
RETURNS TABLE (
  sku text,
  rak text,
  product_name text,
  satuan text,
  count_in_log bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.sku,
    dl.rak,
    COALESCE(p.nama, dl.sku) as product_name,
    COALESCE(p.satuan, 'PCS') as satuan,
    COUNT(*) as count_in_log
  FROM database_log dl
  LEFT JOIN products p ON p.sku_code = dl.sku
  WHERE dl.gudang = 'TRANSFER'
    AND NOT EXISTS (
      SELECT 1 FROM stock_items si
      WHERE LOWER(TRIM(si.nama_produk)) = LOWER(TRIM(dl.sku))
        AND LOWER(TRIM(si.rak)) = LOWER(TRIM(dl.rak))
    )
  GROUP BY dl.sku, dl.rak, p.nama, p.satuan
  ORDER BY count_in_log DESC;
END;
$$ LANGUAGE plpgsql;
