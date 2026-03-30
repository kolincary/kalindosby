/*
  # Update sub_rak column based on rak column

  1. Updates
    - Set `sub_rak` column value based on `rak` column value
    - Convert all `sub_rak` values to uppercase
    - Apply to all rows in stock_items table

  2. Examples
    - If `rak` = 'UTAMA' then `sub_rak` = 'UTAMA'
    - If `rak` = 'Ecer-M' then `sub_rak` = 'ECER-M'
    - If `rak` = 'lantai 4' then `sub_rak` = 'LANTAI 4'

  3. Logic
    - Uses UPPER() function to convert to uppercase
    - Updates all rows regardless of current sub_rak value
*/

-- Update sub_rak column to match rak column but in uppercase
UPDATE stock_items 
SET sub_rak = UPPER(rak)
WHERE rak IS NOT NULL AND rak != '';

-- Optional: Verify the update
-- SELECT rak, sub_rak FROM stock_items LIMIT 20;