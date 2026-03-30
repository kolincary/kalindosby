/*
  # Update sub_rak column in database_log table

  1. Updates
    - Update `sub_rak` column to match `rak` column value in each row
    - Convert to uppercase for consistency
    - Only update rows where rak is not null or empty

  2. Examples
    - If rak = 'UTAMA' → sub_rak = 'UTAMA'
    - If rak = 'Ecer-M' → sub_rak = 'ECER-M'
    - If rak = 'lantai 4' → sub_rak = 'LANTAI 4'
    - If rak = 'Blok-I' → sub_rak = 'BLOK-I'

  3. Safety
    - Only updates non-null and non-empty rak values
    - Preserves existing data structure
*/

-- Update sub_rak column to match rak column (in uppercase)
UPDATE database_log 
SET sub_rak = UPPER(rak)
WHERE rak IS NOT NULL 
  AND rak != '';

-- Verification query (uncomment to check results)
-- SELECT rak, sub_rak, COUNT(*) as count
-- FROM database_log 
-- WHERE rak IS NOT NULL AND rak != ''
-- GROUP BY rak, sub_rak
-- ORDER BY rak
-- LIMIT 20;