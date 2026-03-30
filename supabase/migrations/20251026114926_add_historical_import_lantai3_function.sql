/*
  # Add Historical Import Function for Stok Lantai 3

  ## Overview
  This migration adds a function to import historical data from database_log
  into stok_lantai3 and transaksi_lantai3 for data before the system went live.

  ## New Functions
  
  ### 1. `preview_historical_lantai3_import()`
  Returns a preview of data that will be imported from database_log
  - Shows breakdown per gudang (warehouse)
  - Shows total quantity per SKU
  - Only includes type='OUT' and gudang != 'TRANSFER'
  
  ### 2. `execute_historical_lantai3_import()`
  Executes the actual import from database_log to stok_lantai3
  - Inserts/updates stok_lantai3 with aggregated quantities
  - Creates transaction records in transaksi_lantai3
  - Returns summary of import results
  - Prevents duplicate imports by checking existing transactions
  
  ### 3. `get_lantai3_import_stats()`
  Returns statistics about historical data available for import
  - Total records in database_log (type='OUT', gudang != 'TRANSFER')
  - Total unique SKUs
  - Date range of available data
  - Breakdown by gudang

  ## Notes
  
  - Function only imports data with type='OUT' and gudang != 'TRANSFER'
  - Aggregates quantities by SKU before importing
  - Creates single transaction record per SKU with aggregated data
  - Safe to run multiple times (checks for duplicates)
*/

-- Function to get import statistics
CREATE OR REPLACE FUNCTION get_lantai3_import_stats()
RETURNS TABLE (
  total_records bigint,
  total_unique_skus bigint,
  min_date date,
  max_date date,
  gudang_breakdown jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_records,
    COUNT(DISTINCT sku)::bigint as total_unique_skus,
    MIN(tgl::date) as min_date,
    MAX(tgl::date) as max_date,
    jsonb_object_agg(
      gudang, 
      count
    ) as gudang_breakdown
  FROM (
    SELECT 
      dl.gudang,
      COUNT(*)::int as count,
      dl.tgl
    FROM database_log dl
    WHERE dl.type = 'OUT' 
      AND dl.gudang != 'TRANSFER'
    GROUP BY dl.gudang, dl.tgl
  ) sub
  GROUP BY ()
  UNION ALL
  SELECT 
    COUNT(*)::bigint,
    COUNT(DISTINCT sku)::bigint,
    MIN(tgl::date),
    MAX(tgl::date),
    jsonb_build_object(gudang, COUNT(*)::int)
  FROM database_log
  WHERE type = 'OUT' 
    AND gudang != 'TRANSFER'
  GROUP BY gudang
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to preview historical import data
CREATE OR REPLACE FUNCTION preview_historical_lantai3_import()
RETURNS TABLE (
  nama_produk text,
  total_qty bigint,
  gudang_list text[],
  record_count bigint,
  min_date date,
  max_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.nama, dl.sku) as nama_produk,
    SUM(dl.jumlah)::bigint as total_qty,
    array_agg(DISTINCT dl.gudang ORDER BY dl.gudang) as gudang_list,
    COUNT(*)::bigint as record_count,
    MIN(dl.tgl::date) as min_date,
    MAX(dl.tgl::date) as max_date
  FROM database_log dl
  LEFT JOIN products p ON p.sku_code = dl.sku
  WHERE dl.type = 'OUT' 
    AND dl.gudang != 'TRANSFER'
  GROUP BY COALESCE(p.nama, dl.sku)
  ORDER BY SUM(dl.jumlah) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to execute historical import
CREATE OR REPLACE FUNCTION execute_historical_lantai3_import()
RETURNS TABLE (
  status text,
  message text,
  skus_imported integer,
  total_qty_imported bigint,
  transactions_created integer,
  errors text[]
) AS $$
DECLARE
  v_imported_skus integer := 0;
  v_total_qty bigint := 0;
  v_transactions integer := 0;
  v_errors text[] := ARRAY[]::text[];
  v_error_msg text;
  rec RECORD;
BEGIN
  -- Check if import has already been done
  IF EXISTS (
    SELECT 1 
    FROM transaksi_lantai3 
    WHERE keterangan LIKE '%Historical Import%'
    LIMIT 1
  ) THEN
    RETURN QUERY SELECT 
      'warning'::text,
      'Historical import already executed. Please check transaksi_lantai3 for existing records.'::text,
      0,
      0::bigint,
      0,
      ARRAY['Import previously completed']::text[];
    RETURN;
  END IF;

  -- Process each SKU
  FOR rec IN (
    SELECT 
      COALESCE(p.nama, dl.sku) as nama_produk,
      dl.sku as sku_code,
      SUM(dl.jumlah) as total_qty,
      array_agg(DISTINCT dl.gudang ORDER BY dl.gudang) as gudang_list,
      MIN(dl.tgl::date) as first_date,
      MAX(dl.tgl::date) as last_date,
      MIN(dl.rak) as sample_rak,
      MIN(COALESCE(dl.sub_rak, '')) as sample_sub_rak
    FROM database_log dl
    LEFT JOIN products p ON p.sku_code = dl.sku
    WHERE dl.type = 'OUT' 
      AND dl.gudang != 'TRANSFER'
    GROUP BY COALESCE(p.nama, dl.sku), dl.sku
  ) LOOP
    BEGIN
      -- Insert or update stok_lantai3
      INSERT INTO stok_lantai3 (nama_produk, qty, rak, sub_rak)
      VALUES (rec.nama_produk, rec.total_qty, rec.sample_rak, rec.sample_sub_rak)
      ON CONFLICT (nama_produk) 
      DO UPDATE SET 
        qty = stok_lantai3.qty + rec.total_qty,
        updated_at = now();

      -- Create transaction record
      INSERT INTO transaksi_lantai3 (
        nama_produk,
        qty,
        tipe,
        gudang,
        rak,
        sub_rak,
        keterangan,
        tanggal,
        waktu,
        user_name
      )
      VALUES (
        rec.nama_produk,
        rec.total_qty,
        'transfer_masuk',
        array_to_string(rec.gudang_list, ', '),
        rec.sample_rak,
        rec.sample_sub_rak,
        'Historical Import - Data ' || rec.first_date || ' s/d ' || rec.last_date || ' dari gudang: ' || array_to_string(rec.gudang_list, ', '),
        rec.last_date,
        to_char(now(), 'HH24:MI:SS'),
        'System Historical Import'
      );

      v_imported_skus := v_imported_skus + 1;
      v_total_qty := v_total_qty + rec.total_qty;
      v_transactions := v_transactions + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := 'Error importing ' || rec.nama_produk || ': ' || SQLERRM;
      v_errors := array_append(v_errors, v_error_msg);
    END;
  END LOOP;

  -- Return results
  RETURN QUERY SELECT 
    'success'::text,
    'Historical import completed successfully'::text,
    v_imported_skus,
    v_total_qty,
    v_transactions,
    v_errors;
END;
$$ LANGUAGE plpgsql;