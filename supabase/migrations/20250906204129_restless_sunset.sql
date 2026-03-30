/*
  # Fix stock_items table column structure

  1. Changes Made
    - Add new sub_rak column in correct position (after packing)
    - Migrate existing rak data to sub_rak column
    - Drop old rak column
    - Add new rak column at the end (after tersedia)
    - Update indexes to reflect new column structure
    - Preserve all existing data during migration

  2. Column Order (Final)
    - id (uuid, primary key)
    - nama_produk (text)
    - packing (text, default 'CTN/')
    - sub_rak (text) -- NEW: moved from old rak position
    - satuan (text, default 'PCS')
    - stok_awal (integer, default 0)
    - masuk (integer, default 0)
    - keluar (integer, default 0)
    - tersedia (integer, default 0)
    - rak (text) -- NEW: repositioned after tersedia
    - status (text, default 'Aktif')
    - created_at (timestamptz)
    - updated_at (timestamptz)

  3. Data Migration
    - Copy existing rak data to new sub_rak column
    - Set new rak column to empty string as default
    - Maintain all existing data integrity
*/

-- Step 1: Add new sub_rak column after packing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_items' AND column_name = 'sub_rak'
  ) THEN
    ALTER TABLE stock_items ADD COLUMN sub_rak text DEFAULT '';
  END IF;
END $$;

-- Step 2: Copy existing rak data to sub_rak column
UPDATE stock_items SET sub_rak = COALESCE(rak, '') WHERE sub_rak = '';

-- Step 3: Add new rak column after tersedia (temporarily with different name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_items' AND column_name = 'rak_new'
  ) THEN
    ALTER TABLE stock_items ADD COLUMN rak_new text DEFAULT '';
  END IF;
END $$;

-- Step 4: Drop old indexes that reference the old rak column
DROP INDEX IF EXISTS idx_stock_items_rak;
DROP INDEX IF EXISTS idx_stock_items_nama_rak;

-- Step 5: Drop the old rak column
ALTER TABLE stock_items DROP COLUMN IF EXISTS rak;

-- Step 6: Rename rak_new to rak
ALTER TABLE stock_items RENAME COLUMN rak_new TO rak;

-- Step 7: Recreate indexes with new column structure
CREATE INDEX IF NOT EXISTS idx_stock_items_sub_rak ON stock_items USING btree (sub_rak);
CREATE INDEX IF NOT EXISTS idx_stock_items_rak ON stock_items USING btree (rak);
CREATE INDEX IF NOT EXISTS idx_stock_items_nama_sub_rak ON stock_items USING btree (nama_produk, sub_rak);

-- Step 8: Update any existing data to ensure consistency
UPDATE stock_items 
SET 
  sub_rak = COALESCE(sub_rak, ''),
  rak = COALESCE(rak, '')
WHERE sub_rak IS NULL OR rak IS NULL;

-- Step 9: Add comments to document the column structure
COMMENT ON COLUMN stock_items.sub_rak IS 'Sub lokasi rak - detail lokasi dalam rak utama';
COMMENT ON COLUMN stock_items.rak IS 'Lokasi rak utama - posisi rak dalam gudang';