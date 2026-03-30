/*
  # Add tampil_di_menu column to warehouses table

  1. Changes
    - Add `tampil_di_menu` column to `warehouses` table
    - Set default value to 'KEDUANYA' for backward compatibility
    - Add check constraint to ensure valid values
    - Update existing records to have default value

  2. Security
    - No changes to RLS policies needed
*/

-- Add tampil_di_menu column to warehouses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'tampil_di_menu'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN tampil_di_menu text DEFAULT 'KEDUANYA';
  END IF;
END $$;

-- Add check constraint for tampil_di_menu values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'warehouses_tampil_di_menu_check'
  ) THEN
    ALTER TABLE warehouses ADD CONSTRAINT warehouses_tampil_di_menu_check 
    CHECK (tampil_di_menu = ANY (ARRAY['INPUT_MASUK'::text, 'INPUT_KELUAR'::text, 'KEDUANYA'::text]));
  END IF;
END $$;

-- Update existing records to have default value
UPDATE warehouses 
SET tampil_di_menu = 'KEDUANYA' 
WHERE tampil_di_menu IS NULL;