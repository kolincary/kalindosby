/*
  # Create Master Data Tables

  1. New Tables
    - `warehouses` (Master Data Gudang)
      - `id` (uuid, primary key)
      - `nama` (text, nama gudang)
      - `alamat` (text, alamat gudang)
      - `kode` (text, kode gudang)
      - `status` (text, status aktif/tidak aktif)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `product_types` (Master Data Jenis Barang)
      - `id` (uuid, primary key)
      - `nama` (text, nama jenis barang)
      - `deskripsi` (text, deskripsi jenis barang)
      - `status` (text, status aktif/tidak aktif)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `units` (Master Data Satuan)
      - `id` (uuid, primary key)
      - `nama` (text, nama satuan)
      - `deskripsi` (text, deskripsi satuan)
      - `status` (text, status aktif/tidak aktif)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `products` (Master Data SKU)
      - `id` (uuid, primary key)
      - `id_barang` (text, ID barang)
      - `sku_code` (text, kode SKU)
      - `nama` (text, nama produk)
      - `satuan` (text, satuan produk)
      - `product_type_id` (uuid, foreign key ke product_types)
      - `status` (text, status aktif/tidak aktif)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `rack_locations` (Master Data Lokasi Rak)
      - `id` (uuid, primary key)
      - `nama` (text, nama lokasi rak)
      - `deskripsi` (text, deskripsi lokasi)
      - `warehouse_id` (uuid, foreign key ke warehouses)
      - `status` (text, status aktif/tidak aktif)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to perform CRUD operations
    - Add policies for anonymous users to read data

  3. Indexes
    - Add indexes for frequently queried columns
    - Add unique constraints where needed
*/

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  alamat text DEFAULT '',
  kode text UNIQUE,
  status text DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Tidak Aktif')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_types table
CREATE TABLE IF NOT EXISTS product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  deskripsi text DEFAULT '',
  status text DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Tidak Aktif')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  deskripsi text DEFAULT '',
  status text DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Tidak Aktif')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table (SKU)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barang text UNIQUE NOT NULL,
  sku_code text UNIQUE NOT NULL,
  nama text NOT NULL,
  satuan text NOT NULL,
  product_type_id uuid REFERENCES product_types(id) ON DELETE SET NULL,
  status text DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Tidak Aktif')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rack_locations table
CREATE TABLE IF NOT EXISTS rack_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  deskripsi text DEFAULT '',
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE,
  status text DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Tidak Aktif')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for warehouses
CREATE POLICY "Allow public read access on warehouses"
  ON warehouses
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users full access on warehouses"
  ON warehouses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for product_types
CREATE POLICY "Allow public read access on product_types"
  ON product_types
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users full access on product_types"
  ON product_types
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for units
CREATE POLICY "Allow public read access on units"
  ON units
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users full access on units"
  ON units
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for products
CREATE POLICY "Allow public read access on products"
  ON products
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users full access on products"
  ON products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for rack_locations
CREATE POLICY "Allow public read access on rack_locations"
  ON rack_locations
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users full access on rack_locations"
  ON rack_locations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warehouses_nama ON warehouses(nama);
CREATE INDEX IF NOT EXISTS idx_warehouses_kode ON warehouses(kode);
CREATE INDEX IF NOT EXISTS idx_warehouses_status ON warehouses(status);

CREATE INDEX IF NOT EXISTS idx_product_types_nama ON product_types(nama);
CREATE INDEX IF NOT EXISTS idx_product_types_status ON product_types(status);

CREATE INDEX IF NOT EXISTS idx_units_nama ON units(nama);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

CREATE INDEX IF NOT EXISTS idx_products_id_barang ON products(id_barang);
CREATE INDEX IF NOT EXISTS idx_products_sku_code ON products(sku_code);
CREATE INDEX IF NOT EXISTS idx_products_nama ON products(nama);
CREATE INDEX IF NOT EXISTS idx_products_satuan ON products(satuan);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_type_id ON products(product_type_id);

CREATE INDEX IF NOT EXISTS idx_rack_locations_nama ON rack_locations(nama);
CREATE INDEX IF NOT EXISTS idx_rack_locations_warehouse_id ON rack_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_rack_locations_status ON rack_locations(status);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_types_updated_at
    BEFORE UPDATE ON product_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rack_locations_updated_at
    BEFORE UPDATE ON rack_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for warehouses
INSERT INTO warehouses (nama, alamat, kode, status) VALUES
('Gudang Utama J', 'Jl. Industri No. 1', 'J', 'Aktif'),
('Gudang K', 'Jl. Industri No. 2', 'K', 'Aktif'),
('Gudang L', 'Jl. Industri No. 3', 'L', 'Aktif'),
('Gudang F', 'Jl. Industri No. 4', 'F', 'Tidak Aktif')
ON CONFLICT (kode) DO NOTHING;

-- Insert sample data for product_types
INSERT INTO product_types (nama, deskripsi, status) VALUES
('Stationery', 'Alat tulis kantor', 'Aktif'),
('Electronics', 'Peralatan elektronik', 'Aktif'),
('Office Supplies', 'Perlengkapan kantor', 'Aktif'),
('Packaging', 'Material kemasan', 'Aktif')
ON CONFLICT DO NOTHING;

-- Insert sample data for units
INSERT INTO units (nama, deskripsi, status) VALUES
('PCS', 'Satuan per buah/unit', 'Aktif'),
('BOX', 'Satuan per kotak', 'Aktif'),
('CTN', 'Satuan per karton', 'Aktif'),
('PACK', 'Satuan per kemasan', 'Aktif'),
('SET', 'Satuan per set/paket', 'Aktif'),
('UNIT', 'Satuan per unit', 'Aktif'),
('KG', 'Satuan berat kilogram', 'Tidak Aktif')
ON CONFLICT DO NOTHING;

-- Insert sample data for rack_locations
INSERT INTO rack_locations (nama, deskripsi, warehouse_id, status) 
SELECT 
  rack_name,
  'Lokasi rak ' || rack_name,
  w.id,
  'Aktif'
FROM (VALUES 
  ('UTAMA'),
  ('LANTAI 4'),
  ('LANTAI 2'),
  ('ECER'),
  ('BLOK I'),
  ('CAMPURAN'),
  ('Rak A-B')
) AS racks(rack_name)
CROSS JOIN (SELECT id FROM warehouses WHERE kode = 'J' LIMIT 1) w
ON CONFLICT DO NOTHING;

-- Insert sample data for products (using first product type)
INSERT INTO products (id_barang, sku_code, nama, satuan, product_type_id, status)
SELECT 
  'BRG' || LPAD(ROW_NUMBER() OVER()::text, 3, '0'),
  product_data.sku_code,
  product_data.nama,
  product_data.satuan,
  pt.id,
  'Aktif'
FROM (VALUES 
  ('A5-MHKN-M510-GREEN', 'A5-MHKN-M510 GREEN', 'PCS'),
  ('A5-MHKN-M510-ORANGE', 'A5-MHKN-M510 ORANGE', 'PCS'),
  ('GLUE-GL-0510', 'GLUE-GL-0510/1PC', 'PCS'),
  ('HOOK-ADHK-3180', 'HOOK-ADHK-3180', 'PCS'),
  ('MARKER-1BOX-WM60', 'MARKER-1BOX/WM-60/BLACK', 'BOX'),
  ('TAPE-WT-100', 'TAPE-WT-100', 'CTN'),
  ('SCISSORS-SC-38-ZBR', 'SCISSORS-SC-38-ZBR', 'PACK')
) AS product_data(sku_code, nama, satuan)
CROSS JOIN (SELECT id FROM product_types WHERE nama = 'Stationery' LIMIT 1) pt
ON CONFLICT (id_barang) DO NOTHING;