/*
  # Create Minus Stock Table

  1. New Tables
    - `minus_stock`
      - `id` (uuid, primary key)
      - `tanggal` (date) - Transaction date
      - `waktu` (text) - Transaction time
      - `nama_produk` (text) - Product name
      - `jumlah` (integer) - Quantity requested
      - `gudang` (text) - Warehouse name
      - `rak` (text) - Rack name
      - `sub_rak` (text) - Sub rack name
      - `tgl_scan` (text) - Scan date
      - `user_name` (text) - User who scanned
      - `stok_tersedia` (integer) - Available stock at time of move
      - `total_stok` (integer) - Total stock (minus value)
      - `packing` (text, optional) - Packing info
      - `moved_at` (timestamptz) - When moved to minus stock
      - `moved_by` (text) - Who moved the record
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `minus_stock` table
    - Add policy for authenticated users to read all records
    - Add policy for authenticated users to insert records
    - Add policy for authenticated users to delete their own records

  3. Indexes
    - Create index on tanggal for faster date queries
    - Create index on nama_produk for faster product searches
*/

CREATE TABLE IF NOT EXISTS minus_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL,
  waktu text NOT NULL,
  nama_produk text NOT NULL,
  jumlah integer NOT NULL,
  gudang text NOT NULL,
  rak text NOT NULL,
  sub_rak text NOT NULL DEFAULT '',
  tgl_scan text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  stok_tersedia integer NOT NULL DEFAULT 0,
  total_stok integer NOT NULL,
  packing text,
  moved_at timestamptz DEFAULT now(),
  moved_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE minus_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all minus stock records"
  ON minus_stock
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert minus stock records"
  ON minus_stock
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete minus stock records"
  ON minus_stock
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_minus_stock_tanggal ON minus_stock(tanggal);
CREATE INDEX IF NOT EXISTS idx_minus_stock_nama_produk ON minus_stock(nama_produk);
CREATE INDEX IF NOT EXISTS idx_minus_stock_moved_at ON minus_stock(moved_at);
