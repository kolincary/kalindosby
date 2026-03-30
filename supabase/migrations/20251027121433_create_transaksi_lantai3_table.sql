/*
  # Create transaksi_lantai3 table

  ## Overview
  This migration creates the transaksi_lantai3 table to track all stock movements
  for Lantai 3 (Floor 3). This table logs incoming transfers from Lantai 5,
  customer purchases, and manual adjustments.

  ## New Tables
  
  ### transaksi_lantai3
  Transaction history for all stock movements in Lantai 3
  - `id` (uuid, primary key) - Unique transaction identifier
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

  ## Indexes
  - Index on `nama_produk` for faster product lookups
  - Index on `tanggal` for date-based queries
  - Index on `tipe` for filtering by transaction type

  ## Security
  - Enable RLS on table
  - Allow all users to view transactions
  - Allow all users to insert transactions
  - Allow all users to update transactions
  - Allow all users to delete transactions

  ## Notes
  - Transactions with positive qty indicate stock increases
  - Transactions with negative qty indicate stock decreases
  - All transactions are logged for audit trail
  - Supports various transaction types for flexible tracking
*/

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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transaksi_lantai3_nama_produk ON transaksi_lantai3(nama_produk);
CREATE INDEX IF NOT EXISTS idx_transaksi_lantai3_tanggal ON transaksi_lantai3(tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_lantai3_tipe ON transaksi_lantai3(tipe);

-- Enable RLS
ALTER TABLE transaksi_lantai3 ENABLE ROW LEVEL SECURITY;

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
    ALTER PUBLICATION supabase_realtime ADD TABLE transaksi_lantai3;
  END IF;
END $$;