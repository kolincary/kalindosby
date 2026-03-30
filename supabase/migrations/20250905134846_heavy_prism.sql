/*
  # Simplify Master Data Tables

  1. Changes to Tables
    - Remove `kode` and `alamat` columns from `warehouses` table
    - Remove `deskripsi` column from `product_types` table  
    - Remove `deskripsi` column from `units` table
    - Remove `deskripsi` column from `rack_locations` table

  2. Security
    - Maintain existing RLS policies
    - Keep all indexes and constraints
*/

-- Remove columns from warehouses table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'kode'
  ) THEN
    ALTER TABLE warehouses DROP COLUMN kode;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'alamat'
  ) THEN
    ALTER TABLE warehouses DROP COLUMN alamat;
  END IF;
END $$;

-- Remove deskripsi column from product_types table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_types' AND column_name = 'deskripsi'
  ) THEN
    ALTER TABLE product_types DROP COLUMN deskripsi;
  END IF;
END $$;

-- Remove deskripsi column from units table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'units' AND column_name = 'deskripsi'
  ) THEN
    ALTER TABLE units DROP COLUMN deskripsi;
  END IF;
END $$;

-- Remove deskripsi column from rack_locations table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rack_locations' AND column_name = 'deskripsi'
  ) THEN
    ALTER TABLE rack_locations DROP COLUMN deskripsi;
  END IF;
END $$;

-- Drop indexes that are no longer needed
DROP INDEX IF EXISTS idx_warehouses_kode;
DROP INDEX IF EXISTS warehouses_kode_key;