/*
  # Update Stock Items Structure and Data Logic

  1. Database Changes
    - Update stock items with proper rak logic based on sub_rak content
    - Ensure proper column ordering and data consistency

  2. Logic Implementation
    - If sub_rak contains "Rak" → set rak to "UTAMA"
    - Otherwise → copy sub_rak value to rak column
    - Handle case variations properly
*/

-- Update existing data based on sub_rak content
UPDATE stock_items 
SET rak = CASE 
  WHEN UPPER(sub_rak) LIKE '%RAK%' THEN 'UTAMA'
  WHEN sub_rak IS NOT NULL AND sub_rak != '' THEN UPPER(sub_rak)
  ELSE UPPER(rak)
END
WHERE sub_rak IS NOT NULL OR rak IS NOT NULL;

-- Create function to automatically update rak based on sub_rak
CREATE OR REPLACE FUNCTION update_rak_from_sub_rak()
RETURNS TRIGGER AS $$
BEGIN
  -- Update rak based on sub_rak content
  IF NEW.sub_rak IS NOT NULL AND NEW.sub_rak != '' THEN
    IF UPPER(NEW.sub_rak) LIKE '%RAK%' THEN
      NEW.rak = 'UTAMA';
    ELSE
      NEW.rak = UPPER(NEW.sub_rak);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update rak when sub_rak changes
DROP TRIGGER IF EXISTS trigger_update_rak_from_sub_rak ON stock_items;
CREATE TRIGGER trigger_update_rak_from_sub_rak
  BEFORE INSERT OR UPDATE OF sub_rak ON stock_items
  FOR EACH ROW
  EXECUTE FUNCTION update_rak_from_sub_rak();