/*
  # Tabel Pengecualian Rak untuk Produk

  Tabel ini menyimpan data produk dan rak mana yang harus dikecualikan (disabled) 
  dari sistem auto-select rak pada menu Input Barang Masuk.

  ## Tabel Baru
    - `product_rack_exclusions`
      - `id` (uuid, primary key) - ID unik
      - `nama_produk` (text, not null) - Nama produk
      - `rak` (text, not null) - Lokasi rak yang di-exclude
      - `is_excluded` (boolean, default false) - Status: true = tidak muncul di auto-select, false = muncul
      - `created_at` (timestamptz) - Waktu pembuatan
      - `updated_at` (timestamptz) - Waktu update terakhir
      - Unique constraint pada (nama_produk, rak) untuk mencegah duplikasi

  ## Security
    - Enable RLS
    - Policy untuk membaca data (semua user authenticated)
    - Policy untuk insert/update/delete (semua user authenticated)

  ## Catatan
    - Tabel ini digunakan untuk mengatur prioritas rak per produk
    - Jika is_excluded = true, maka rak tersebut tidak akan dipilih otomatis untuk produk tersebut
*/

-- Buat tabel product_rack_exclusions
CREATE TABLE IF NOT EXISTS product_rack_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_produk text NOT NULL,
  rak text NOT NULL,
  is_excluded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nama_produk, rak)
);

-- Tambah index untuk performa query
CREATE INDEX IF NOT EXISTS idx_product_rack_exclusions_nama_produk 
  ON product_rack_exclusions(nama_produk);

CREATE INDEX IF NOT EXISTS idx_product_rack_exclusions_rak 
  ON product_rack_exclusions(rak);

CREATE INDEX IF NOT EXISTS idx_product_rack_exclusions_is_excluded 
  ON product_rack_exclusions(is_excluded);

-- Enable RLS
ALTER TABLE product_rack_exclusions ENABLE ROW LEVEL SECURITY;

-- Policy untuk SELECT
CREATE POLICY "Allow read access to all authenticated users"
  ON product_rack_exclusions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy untuk INSERT
CREATE POLICY "Allow insert to all authenticated users"
  ON product_rack_exclusions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy untuk UPDATE
CREATE POLICY "Allow update to all authenticated users"
  ON product_rack_exclusions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy untuk DELETE
CREATE POLICY "Allow delete to all authenticated users"
  ON product_rack_exclusions
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_product_rack_exclusions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_rack_exclusions_updated_at
  BEFORE UPDATE ON product_rack_exclusions
  FOR EACH ROW
  EXECUTE FUNCTION update_product_rack_exclusions_updated_at();
