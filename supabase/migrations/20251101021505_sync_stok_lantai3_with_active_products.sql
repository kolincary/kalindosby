/*
  # Synchronize Stok Lantai 3 with All Active Products

  ## Overview
  This migration synchronizes the stok_lantai3 table with all active products from the products table.
  Currently, stok_lantai3 only contains products that have been transferred from Lantai 5. This migration
  ensures ALL active products are available in stok_lantai3 with initial qty=0, making them visible
  in the Stok Lantai 3 interface even before their first transfer.

  ## Problem Solved
  1. Only 774 products in stok_lantai3 vs many more active products in products table
  2. Active products that never received transfers were invisible in the UI
  3. Import functionality couldn't find products that hadn't been transferred yet
  4. New active products weren't automatically added to stok_lantai3

  ## Solution
  1. Create sync function to populate stok_lantai3 with all active products
  2. Execute initial sync to backfill existing data
  3. Add triggers to auto-sync when products are created with status='Aktif'
  4. Add triggers to auto-sync when product status changes to 'Aktif'

  ## New Functions
  1. `sync_all_active_products_to_lantai3()` - Synchronizes all active products from products table
  2. Logs synchronization results for audit trail

  ## Trigger Changes
  1. New trigger: `sync_new_active_product_to_lantai3` - Auto-adds products when created
  2. New trigger: `sync_product_status_change_to_lantai3` - Auto-adds products when status becomes 'Aktif'

  ## Data Impact
  - All products with status='Aktif' will be added to stok_lantai3 with qty=0
  - Existing stock quantities for already-present products are preserved
  - Products with status='Tidak Aktif' are not affected
  - Transaction history is created for audit trail

  ## Notes
  - stok_lantai3.nama_produk stores the actual product name from products.nama
  - Frontend uses activeProducts map to display readable names
  - SKU codes are matched via the transfer_stok_ke_lantai3 function
  - Synchronization is idempotent and safe to run multiple times
*/

-- Function to synchronize all active products to stok_lantai3
CREATE OR REPLACE FUNCTION sync_all_active_products_to_lantai3()
RETURNS TABLE(
  total_active_products integer,
  products_added integer,
  products_already_existed integer
) AS $$
DECLARE
  v_total_active integer := 0;
  v_added integer := 0;
  v_existing integer := 0;
  v_product_record record;
BEGIN
  -- Count active products
  SELECT COUNT(*) INTO v_total_active
  FROM products
  WHERE status = 'Aktif';

  -- Insert all active products into stok_lantai3 if they don't exist
  WITH active_products AS (
    SELECT p.nama, p.satuan
    FROM products p
    WHERE p.status = 'Aktif'
  )
  INSERT INTO stok_lantai3 (nama_produk, qty, satuan, packing, rak, sub_rak, created_at, updated_at)
  SELECT ap.nama, 0, ap.satuan, 'CTN/', '', '', now(), now()
  FROM active_products ap
  ON CONFLICT (nama_produk) 
  DO NOTHING;

  -- Count how many were added vs already existed
  SELECT COUNT(*) INTO v_added
  FROM stok_lantai3 sl
  WHERE sl.created_at > (now() - INTERVAL '5 minutes')
  AND EXISTS (
    SELECT 1 FROM products p 
    WHERE p.status = 'Aktif' AND p.nama = sl.nama_produk
  );

  v_existing := v_total_active - v_added;

  -- Log synchronization to transaksi_lantai3
  FOR v_product_record IN
    SELECT DISTINCT sl.nama_produk
    FROM stok_lantai3 sl
    WHERE sl.created_at > (now() - INTERVAL '5 minutes')
  LOOP
    INSERT INTO transaksi_lantai3 (
      nama_produk,
      qty,
      tipe,
      keterangan,
      tanggal,
      user_name
    ) VALUES (
      v_product_record.nama_produk,
      0,
      'adjustment',
      'Sinkronisasi otomatis: Produk baru ditambahkan ke Lantai 3',
      CURRENT_DATE,
      'system'
    );
  END LOOP;

  RETURN QUERY SELECT v_total_active, v_added, v_existing;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-sync new products when they're created with status='Aktif'
CREATE OR REPLACE FUNCTION sync_new_active_product_to_lantai3()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the new product has status='Aktif'
  IF NEW.status = 'Aktif' THEN
    -- Insert into stok_lantai3 if it doesn't already exist
    INSERT INTO stok_lantai3 (nama_produk, qty, satuan, packing, rak, sub_rak)
    VALUES (NEW.nama, 0, COALESCE(NEW.satuan, 'PCS'), 'CTN/', '', '')
    ON CONFLICT (nama_produk) 
    DO NOTHING;

    -- Log the sync operation
    INSERT INTO transaksi_lantai3 (
      nama_produk,
      qty,
      tipe,
      keterangan,
      tanggal,
      user_name
    ) VALUES (
      NEW.nama,
      0,
      'adjustment',
      'Sinkronisasi otomatis: Produk baru dibuat dengan status Aktif',
      CURRENT_DATE,
      'system'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-sync when product status changes to 'Aktif'
CREATE OR REPLACE FUNCTION sync_product_status_change_to_lantai3()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'Aktif', add to stok_lantai3
  IF NEW.status = 'Aktif' AND OLD.status != 'Aktif' THEN
    INSERT INTO stok_lantai3 (nama_produk, qty, satuan, packing, rak, sub_rak)
    VALUES (NEW.nama, 0, COALESCE(NEW.satuan, 'PCS'), 'CTN/', '', '')
    ON CONFLICT (nama_produk) 
    DO NOTHING;

    -- Log the sync operation
    INSERT INTO transaksi_lantai3 (
      nama_produk,
      qty,
      tipe,
      keterangan,
      tanggal,
      user_name
    ) VALUES (
      NEW.nama,
      0,
      'adjustment',
      'Sinkronisasi otomatis: Produk status diubah menjadi Aktif',
      CURRENT_DATE,
      'system'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new active products
DROP TRIGGER IF EXISTS sync_new_active_product_to_lantai3_trigger ON products;
CREATE TRIGGER sync_new_active_product_to_lantai3_trigger
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_active_product_to_lantai3();

-- Create trigger for product status changes
DROP TRIGGER IF EXISTS sync_product_status_change_to_lantai3_trigger ON products;
CREATE TRIGGER sync_product_status_change_to_lantai3_trigger
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_status_change_to_lantai3();

-- Execute initial synchronization
SELECT sync_all_active_products_to_lantai3();
