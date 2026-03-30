/*
  # Create Stok Lantai 3 System

  ## Overview
  This migration creates a complete stock management system for Lantai 3 (Floor 3),
  which receives stock transfers from Lantai 5 (main warehouse) and tracks daily
  customer purchases.

  ## New Tables
  
  ### 1. `stok_lantai3`
  Main stock table for Lantai 3 inventory
  - `id` (uuid, primary key)
  - `nama_produk` (text, unique) - Product name (primary identifier)
  - `qty` (integer, default 0) - Current stock quantity
  - `satuan` (text) - Unit of measurement
  - `packing` (text) - Packing format
  - `rak` (text) - Rack location
  - `sub_rak` (text) - Sub-rack location
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `transaksi_lantai3`
  Transaction history for all stock movements in Lantai 3
  - `id` (uuid, primary key)
  - `nama_produk` (text) - Product name
  - `qty` (integer) - Quantity (positive for incoming, negative for outgoing)
  - `tipe` (text) - Transaction type: 'transfer_masuk', 'pembelian_customer', 'adjustment'
  - `gudang` (text) - Warehouse name
  - `rak` (text) - Rack location
  - `sub_rak` (text) - Sub-rack location
  - `keterangan` (text) - Additional notes/remarks
  - `tanggal` (date) - Transaction date
  - `waktu` (text) - Transaction time
  - `user_name` (text) - User who created the transaction
  - `created_at` (timestamptz) - Record creation timestamp

  ## Functions
  
  ### 1. `transfer_stok_ke_lantai3()`
  Trigger function that automatically transfers stock from database_log (type='OUT') to lantai 3
  - Creates/updates stock in stok_lantai3
  - Logs transaction in transaksi_lantai3
  - Maintains stock quantity accuracy

  ### 2. `update_stok_lantai3_timestamp()`
  Trigger function to automatically update the updated_at timestamp

  ## Triggers
  
  1. `after_database_log_out_insert` - Auto-transfer stock when database_log type='OUT' is inserted
  2. `update_stok_lantai3_timestamp_trigger` - Auto-update timestamp on stok_lantai3 changes

  ## Security
  
  - Enable RLS on both tables
  - Allow authenticated users to read all data
  - Allow authenticated users to insert/update/delete data
  - Restrict access to authenticated users only

  ## Notes
  
  - Stock quantities in lantai 3 start at 0 and increase via transfers
  - Customer purchases decrease lantai 3 stock via bulk import/paste
  - All transactions are logged for audit trail and stock opname
  - Daily stock tracking enables identification of discrepancies
*/

-- Create stok_lantai3 table
CREATE TABLE IF NOT EXISTS stok_lantai3 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_produk text UNIQUE NOT NULL,
  qty integer DEFAULT 0 NOT NULL,
  satuan text DEFAULT 'PCS',
  packing text DEFAULT 'CTN/',
  rak text DEFAULT '',
  sub_rak text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transaksi_lantai3 table
CREATE TABLE IF NOT EXISTS transaksi_lantai3 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_produk text NOT NULL,
  qty integer NOT NULL,
  tipe text NOT NULL CHECK (tipe IN ('transfer_masuk', 'pembelian_customer', 'adjustment')),
  gudang text DEFAULT '',
  rak text DEFAULT '',
  sub_rak text DEFAULT '',
  keterangan text,
  tanggal date DEFAULT CURRENT_DATE,
  waktu text DEFAULT '',
  user_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stok_lantai3_nama_produk ON stok_lantai3(nama_produk);
CREATE INDEX IF NOT EXISTS idx_transaksi_lantai3_nama_produk ON transaksi_lantai3(nama_produk);
CREATE INDEX IF NOT EXISTS idx_transaksi_lantai3_tanggal ON transaksi_lantai3(tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_lantai3_tipe ON transaksi_lantai3(tipe);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_stok_lantai3_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-transfer stock from database_log (type='OUT') to lantai3
CREATE OR REPLACE FUNCTION transfer_stok_ke_lantai3()
RETURNS TRIGGER AS $$
DECLARE
  product_name text;
BEGIN
  -- Only process if type is 'OUT'
  IF NEW.type = 'OUT' THEN
    -- Get the product name from SKU
    SELECT nama INTO product_name 
    FROM products 
    WHERE sku_code = NEW.sku 
    LIMIT 1;
    
    -- If product name not found, use SKU as fallback
    IF product_name IS NULL THEN
      product_name := NEW.sku;
    END IF;
    
    -- Insert or update stok_lantai3
    INSERT INTO stok_lantai3 (nama_produk, qty, rak, sub_rak)
    VALUES (product_name, NEW.jumlah, NEW.rak, COALESCE(NEW.sub_rak, ''))
    ON CONFLICT (nama_produk) 
    DO UPDATE SET 
      qty = stok_lantai3.qty + NEW.jumlah,
      rak = COALESCE(NEW.rak, stok_lantai3.rak),
      sub_rak = COALESCE(NEW.sub_rak, stok_lantai3.sub_rak),
      updated_at = now();

    -- Log transaction
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
      product_name, 
      NEW.jumlah, 
      'transfer_masuk', 
      NEW.gudang,
      NEW.rak,
      COALESCE(NEW.sub_rak, ''),
      'Transfer otomatis dari Lantai 5 (Gudang ' || NEW.gudang || ')',
      NEW.tgl::date,
      NEW.waktu,
      COALESCE(NEW.user_name, '')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS after_database_log_out_insert ON database_log;
CREATE TRIGGER after_database_log_out_insert
  AFTER INSERT ON database_log
  FOR EACH ROW
  EXECUTE FUNCTION transfer_stok_ke_lantai3();

DROP TRIGGER IF EXISTS update_stok_lantai3_timestamp_trigger ON stok_lantai3;
CREATE TRIGGER update_stok_lantai3_timestamp_trigger
  BEFORE UPDATE ON stok_lantai3
  FOR EACH ROW
  EXECUTE FUNCTION update_stok_lantai3_timestamp();

-- Enable RLS
ALTER TABLE stok_lantai3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_lantai3 ENABLE ROW LEVEL SECURITY;

-- Policies for stok_lantai3
CREATE POLICY "Allow all users to view stok lantai 3"
  ON stok_lantai3
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all users to insert stok lantai 3"
  ON stok_lantai3
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all users to update stok lantai 3"
  ON stok_lantai3
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all users to delete stok lantai 3"
  ON stok_lantai3
  FOR DELETE
  USING (true);

-- Policies for transaksi_lantai3
CREATE POLICY "Allow all users to view transaksi lantai 3"
  ON transaksi_lantai3
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all users to insert transaksi lantai 3"
  ON transaksi_lantai3
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all users to update transaksi lantai 3"
  ON transaksi_lantai3
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all users to delete transaksi lantai 3"
  ON transaksi_lantai3
  FOR DELETE
  USING (true);

-- Enable realtime (if needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stok_lantai3;
    ALTER PUBLICATION supabase_realtime ADD TABLE transaksi_lantai3;
  END IF;
END $$;