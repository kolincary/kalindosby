/*
  # Fix Lantai 3 Trigger Date Format Conversion
  
  ## Problem
  The trigger `transfer_stok_ke_lantai3()` was failing because it tried to convert
  DD/MM/YYYY text format from database_log.tgl directly to DATE type using `::date`,
  which PostgreSQL cannot parse.
  
  ## Solution
  Update the trigger function to properly convert DD/MM/YYYY text format to DATE type
  using TO_DATE() function with the correct format mask.
  
  ## Changes
  - Modified `transfer_stok_ke_lantai3()` function
  - Changed line: `NEW.tgl::date` 
  - To: `TO_DATE(NEW.tgl, 'DD/MM/YYYY')`
  
  ## Notes
  - This allows database_log to continue using DD/MM/YYYY format (Indonesian standard)
  - Properly converts to DATE type for transaksi_lantai3 table
  - No data migration needed, only function update
*/

-- Update the trigger function to handle DD/MM/YYYY format properly
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

    -- Log transaction with proper date conversion from DD/MM/YYYY to DATE
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
      TO_DATE(NEW.tgl, 'DD/MM/YYYY'),
      NEW.waktu,
      COALESCE(NEW.user_name, '')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
