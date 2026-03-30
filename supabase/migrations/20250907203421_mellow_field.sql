/*
  # Update Rak Column to UTAMA

  1. Changes
    - Update all rows in stock_items table where rak column contains "Rak" (case insensitive)
    - Change these values to "UTAMA"
    - This will affect entries like "Rak A-B", "Rak C-D", "Rak E-F", etc.

  2. Safety
    - Uses ILIKE for case-insensitive matching
    - Only updates rows that actually contain "Rak"
    - Preserves other rak values that don't contain "Rak"
*/

-- Update all rak values that contain "Rak" to "UTAMA"
UPDATE stock_items 
SET rak = 'UTAMA'
WHERE rak ILIKE '%rak%';

-- Display summary of changes (optional, for verification)
-- This will show how many rows were affected
-- You can run this separately to verify the changes
-- SELECT COUNT(*) as total_updated_rows 
-- FROM stock_items 
-- WHERE rak = 'UTAMA';