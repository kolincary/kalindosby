/*
  # Create stock_items table

  1. New Tables
    - `stock_items`
      - `id` (uuid, primary key)
      - `nama_produk` (text, product name)
      - `packing` (text, packing information)
      - `rak` (text, rack location)
      - `satuan` (text, unit of measurement)
      - `stok_awal` (integer, initial stock)
      - `masuk` (integer, stock in)
      - `keluar` (integer, stock out)
      - `tersedia` (integer, available stock)
      - `status` (text, status with constraint)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `stock_items` table
    - Add policies for authenticated users to have full access
    - Add policies for public read access

  3. Indexes
    - Add indexes for better query performance on commonly searched fields
*/

CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_produk text NOT NULL,
  packing text NOT NULL DEFAULT 'CTN/',
  rak text NOT NULL,
  satuan text NOT NULL DEFAULT 'PCS',
  stok_awal integer DEFAULT 0,
  masuk integer DEFAULT 0,
  keluar integer DEFAULT 0,
  tersedia integer DEFAULT 0,
  status text DEFAULT 'Aktif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraint for status
ALTER TABLE stock_items 
ADD CONSTRAINT stock_items_status_check 
CHECK (status = ANY (ARRAY['Aktif'::text, 'Tidak Aktif'::text]));

-- Enable RLS
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users full access on stock_items"
  ON stock_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access on stock_items"
  ON stock_items
  FOR SELECT
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_items_nama_produk ON stock_items USING btree (nama_produk);
CREATE INDEX IF NOT EXISTS idx_stock_items_rak ON stock_items USING btree (rak);
CREATE INDEX IF NOT EXISTS idx_stock_items_satuan ON stock_items USING btree (satuan);
CREATE INDEX IF NOT EXISTS idx_stock_items_status ON stock_items USING btree (status);
CREATE INDEX IF NOT EXISTS idx_stock_items_created_at ON stock_items USING btree (created_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_items_updated_at
    BEFORE UPDATE ON stock_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();