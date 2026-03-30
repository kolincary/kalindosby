/*
  # Add tampil_di_menu column to rack_locations table

  1. Changes
    - Add `tampil_di_menu` column to `rack_locations` table
    - Set default value to 'KEDUANYA' for existing records
    - Add check constraint to ensure valid values
    - Update existing records based on rack name rules

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add the tampil_di_menu column with default value
ALTER TABLE rack_locations 
ADD COLUMN IF NOT EXISTS tampil_di_menu text DEFAULT 'KEDUANYA';

-- Add check constraint to ensure only valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rack_locations_tampil_di_menu_check' 
    AND table_name = 'rack_locations'
  ) THEN
    ALTER TABLE rack_locations 
    ADD CONSTRAINT rack_locations_tampil_di_menu_check 
    CHECK (tampil_di_menu = ANY (ARRAY['INPUT_MASUK'::text, 'INPUT_KELUAR'::text, 'KEDUANYA'::text]));
  END IF;
END $$;

-- Update existing records based on rack name rules
UPDATE rack_locations 
SET tampil_di_menu = 'INPUT_KELUAR'
WHERE UPPER(nama) IN ('UTAMA', 'ECER-M', 'ECER-N', 'ECER-O', 'BLOK-I', 'LANTAI 4', 'LANTAI 2')
AND tampil_di_menu = 'KEDUANYA';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_rack_locations_tampil_di_menu 
ON rack_locations (tampil_di_menu);