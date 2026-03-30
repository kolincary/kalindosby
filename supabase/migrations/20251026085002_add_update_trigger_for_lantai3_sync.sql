/*
  # Add UPDATE Trigger for Lantai 3 Stock Synchronization
  
  ## Problem
  When data in `database_log` (type='OUT') is edited/updated, the changes are not
  reflected in `stok_lantai3` and `transaksi_lantai3` because the original trigger
  only handles INSERT operations.
  
  ## Solution
  Add a new trigger function `handle_database_log_update_for_lantai3()` that:
  1. Detects when type='OUT' records are updated
  2. Calculates the difference between OLD and NEW quantities
  3. Adjusts stock in stok_lantai3 accordingly
  4. Logs the adjustment in transaksi_lantai3 for audit trail
  
  ## Scenarios Handled
  
  ### 1. Quantity Change (e.g., 96 → 100)
  - Calculates difference: +4
  - Updates stok_lantai3 qty by adding the difference
  - Logs adjustment transaction
  
  ### 2. Product/SKU Change
  - Reduces stock from old product by OLD quantity
  - Increases stock for new product by NEW quantity
  - Logs both transactions
  
  ### 3. Type Change (OUT → IN or IN → OUT)
  - Reverses previous operation
  - Applies new operation
  
  ### 4. Non-OUT Updates (type='IN')
  - Ignored, no changes to lantai3
  
  ## New Tables
  None (uses existing tables)
  
  ## New Functions
  1. `handle_database_log_update_for_lantai3()` - Processes UPDATE events
  
  ## New Triggers
  1. `after_database_log_update_for_lantai3` - Fires on UPDATE of database_log
  
  ## Security
  Uses existing RLS policies (no changes needed)
  
  ## Important Notes
  - Only processes records where type='OUT' (either OLD or NEW)
  - Maintains full audit trail in transaksi_lantai3
  - Handles edge cases like product changes and type changes
  - Uses proper date conversion for DD/MM/YYYY format
*/

-- Function to handle UPDATE events on database_log for lantai3 synchronization
CREATE OR REPLACE FUNCTION handle_database_log_update_for_lantai3()
RETURNS TRIGGER AS $$
DECLARE
  old_product_name text;
  new_product_name text;
  qty_difference integer;
BEGIN
  -- Case 1: OLD was OUT, NEW is not OUT (type changed from OUT to something else)
  -- We need to REVERSE the previous transfer
  IF OLD.type = 'OUT' AND NEW.type != 'OUT' THEN
    -- Get old product name
    SELECT nama INTO old_product_name 
    FROM products 
    WHERE sku_code = OLD.sku 
    LIMIT 1;
    
    IF old_product_name IS NULL THEN
      old_product_name := OLD.sku;
    END IF;
    
    -- Reduce stock in lantai3 (reverse the previous transfer)
    UPDATE stok_lantai3 
    SET 
      qty = qty - OLD.jumlah,
      updated_at = now()
    WHERE nama_produk = old_product_name;
    
    -- Log reversal transaction
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
      old_product_name, 
      -OLD.jumlah, 
      'adjustment', 
      OLD.gudang,
      OLD.rak,
      COALESCE(OLD.sub_rak, ''),
      'Koreksi: Tipe dirubah dari OUT ke ' || NEW.type,
      TO_DATE(OLD.tgl, 'DD/MM/YYYY'),
      OLD.waktu,
      COALESCE(NEW.user_name, '')
    );
    
  -- Case 2: OLD was not OUT, NEW is OUT (type changed to OUT)
  -- We need to ADD the transfer
  ELSIF OLD.type != 'OUT' AND NEW.type = 'OUT' THEN
    -- Get new product name
    SELECT nama INTO new_product_name 
    FROM products 
    WHERE sku_code = NEW.sku 
    LIMIT 1;
    
    IF new_product_name IS NULL THEN
      new_product_name := NEW.sku;
    END IF;
    
    -- Add stock to lantai3
    INSERT INTO stok_lantai3 (nama_produk, qty, rak, sub_rak)
    VALUES (new_product_name, NEW.jumlah, NEW.rak, COALESCE(NEW.sub_rak, ''))
    ON CONFLICT (nama_produk) 
    DO UPDATE SET 
      qty = stok_lantai3.qty + NEW.jumlah,
      rak = COALESCE(NEW.rak, stok_lantai3.rak),
      sub_rak = COALESCE(NEW.sub_rak, stok_lantai3.sub_rak),
      updated_at = now();
    
    -- Log new transfer
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
      new_product_name, 
      NEW.jumlah, 
      'adjustment', 
      NEW.gudang,
      NEW.rak,
      COALESCE(NEW.sub_rak, ''),
      'Koreksi: Tipe dirubah dari ' || OLD.type || ' ke OUT',
      TO_DATE(NEW.tgl, 'DD/MM/YYYY'),
      NEW.waktu,
      COALESCE(NEW.user_name, '')
    );
    
  -- Case 3: Both OLD and NEW are OUT - handle various update scenarios
  ELSIF OLD.type = 'OUT' AND NEW.type = 'OUT' THEN
    -- Get product names
    SELECT nama INTO old_product_name 
    FROM products 
    WHERE sku_code = OLD.sku 
    LIMIT 1;
    
    SELECT nama INTO new_product_name 
    FROM products 
    WHERE sku_code = NEW.sku 
    LIMIT 1;
    
    IF old_product_name IS NULL THEN
      old_product_name := OLD.sku;
    END IF;
    
    IF new_product_name IS NULL THEN
      new_product_name := NEW.sku;
    END IF;
    
    -- Sub-case 3a: Product/SKU changed
    IF old_product_name != new_product_name THEN
      -- Remove from old product
      UPDATE stok_lantai3 
      SET 
        qty = qty - OLD.jumlah,
        updated_at = now()
      WHERE nama_produk = old_product_name;
      
      -- Add to new product
      INSERT INTO stok_lantai3 (nama_produk, qty, rak, sub_rak)
      VALUES (new_product_name, NEW.jumlah, NEW.rak, COALESCE(NEW.sub_rak, ''))
      ON CONFLICT (nama_produk) 
      DO UPDATE SET 
        qty = stok_lantai3.qty + NEW.jumlah,
        rak = COALESCE(NEW.rak, stok_lantai3.rak),
        sub_rak = COALESCE(NEW.sub_rak, stok_lantai3.sub_rak),
        updated_at = now();
      
      -- Log removal from old product
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
        old_product_name, 
        -OLD.jumlah, 
        'adjustment', 
        OLD.gudang,
        OLD.rak,
        COALESCE(OLD.sub_rak, ''),
        'Koreksi: Produk dirubah ke ' || new_product_name,
        TO_DATE(OLD.tgl, 'DD/MM/YYYY'),
        OLD.waktu,
        COALESCE(NEW.user_name, '')
      );
      
      -- Log addition to new product
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
        new_product_name, 
        NEW.jumlah, 
        'adjustment', 
        NEW.gudang,
        NEW.rak,
        COALESCE(NEW.sub_rak, ''),
        'Koreksi: Produk dirubah dari ' || old_product_name,
        TO_DATE(NEW.tgl, 'DD/MM/YYYY'),
        NEW.waktu,
        COALESCE(NEW.user_name, '')
      );
      
    -- Sub-case 3b: Same product, but quantity or other fields changed
    ELSIF OLD.jumlah != NEW.jumlah OR OLD.rak != NEW.rak OR COALESCE(OLD.sub_rak, '') != COALESCE(NEW.sub_rak, '') THEN
      -- Calculate quantity difference
      qty_difference := NEW.jumlah - OLD.jumlah;
      
      -- Update stock with the difference
      UPDATE stok_lantai3 
      SET 
        qty = qty + qty_difference,
        rak = COALESCE(NEW.rak, rak),
        sub_rak = COALESCE(NEW.sub_rak, sub_rak),
        updated_at = now()
      WHERE nama_produk = new_product_name;
      
      -- Log adjustment transaction (only if quantity changed)
      IF qty_difference != 0 THEN
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
          new_product_name, 
          qty_difference, 
          'adjustment', 
          NEW.gudang,
          NEW.rak,
          COALESCE(NEW.sub_rak, ''),
          'Koreksi: Qty dirubah dari ' || OLD.jumlah || ' ke ' || NEW.jumlah,
          TO_DATE(NEW.tgl, 'DD/MM/YYYY'),
          NEW.waktu,
          COALESCE(NEW.user_name, '')
        );
      END IF;
    END IF;
  END IF;
  
  -- If OLD.type != 'OUT' AND NEW.type != 'OUT', do nothing (not relevant for lantai3)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for UPDATE events
DROP TRIGGER IF EXISTS after_database_log_update_for_lantai3 ON database_log;
CREATE TRIGGER after_database_log_update_for_lantai3
  AFTER UPDATE ON database_log
  FOR EACH ROW
  EXECUTE FUNCTION handle_database_log_update_for_lantai3();
