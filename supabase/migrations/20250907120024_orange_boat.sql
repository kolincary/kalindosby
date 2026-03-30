/*
  # Update stok_awal menjadi 0 untuk semua data

  1. Changes
    - Update semua record di table stock_items
    - Set kolom stok_awal = 0 untuk semua data
    - Update kolom tersedia berdasarkan perhitungan ulang (masuk - keluar)
  
  2. Notes
    - Operasi ini akan mengupdate semua record yang ada
    - Stok tersedia akan dihitung ulang berdasarkan masuk - keluar saja
*/

-- Update semua stok_awal menjadi 0
UPDATE stock_items 
SET stok_awal = 0;

-- Update kolom tersedia berdasarkan perhitungan ulang (masuk - keluar)
UPDATE stock_items 
SET tersedia = masuk - keluar;

-- Update timestamp
UPDATE stock_items 
SET updated_at = now();