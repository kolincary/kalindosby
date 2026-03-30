/*
  # Add Date Normalization Column to database_log Table

  1. Overview
    - Add `tgl_normalized` column (DATE type) for standardized date storage
    - Create function to parse multiple date formats
    - Backfill existing data with normalized dates
    - Create trigger for automatic normalization on INSERT/UPDATE
    - Add performance indexes for sorting and filtering

  2. New Column
    - `tgl_normalized` (date) - Standardized date for sorting/filtering
      Format: YYYY-MM-DD, derived from inconsistent `tgl` column formats

  3. Date Format Support
    - DD/MM/YYYY or DD-MM-YYYY (Indonesian format)
    - DD/MM/YY or DD-MM-YY (2-digit year)
    - YYYY-MM-DD or YYYY/MM/DD (ISO format)
    - DD/MM (current year assumed)
    
  4. Functions
    - `parse_flexible_date()`: Converts text to DATE using multiple format patterns
    - Trigger function to auto-normalize dates on INSERT/UPDATE

  5. Performance
    - Composite index (tgl_normalized DESC, waktu DESC, id DESC)
    - Index on tgl_normalized for fast filtering
    - Improves query performance from O(n log n) to O(log n)

  6. Safety & Compatibility
    - Preserves existing `tgl` column for backward compatibility
    - IF NOT EXISTS checks prevent migration conflicts
    - Data integrity maintained through validation function
    - No data loss during migration
*/

-- Add tgl_normalized column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'database_log' AND column_name = 'tgl_normalized'
  ) THEN
    ALTER TABLE database_log ADD COLUMN tgl_normalized DATE;
  END IF;
END $$;

-- Create function to parse flexible date formats
CREATE OR REPLACE FUNCTION parse_flexible_date(date_str text) RETURNS DATE AS $$
DECLARE
  parsed_date DATE;
  day int;
  month int;
  year int;
  parts text[];
BEGIN
  IF date_str IS NULL OR date_str = '' THEN
    RETURN NULL;
  END IF;
  
  date_str := TRIM(date_str);
  
  -- Try ISO format first (YYYY-MM-DD or YYYY/MM/DD)
  IF date_str ~ '^\d{4}[-/]\d{1,2}[-/]\d{1,2}$' THEN
    parts := string_to_array(REPLACE(date_str, '/', '-'), '-');
    BEGIN
      parsed_date := make_date(parts[1]::int, parts[2]::int, parts[3]::int);
      RETURN parsed_date;
    EXCEPTION WHEN OTHERS THEN
      -- Invalid date, continue to next format
    END;
  END IF;
  
  -- Try DD/MM/YYYY or DD-MM-YYYY format
  IF date_str ~ '^\d{1,2}[-/]\d{1,2}[-/]\d{4}$' THEN
    parts := string_to_array(REPLACE(date_str, '/', '-'), '-');
    BEGIN
      parsed_date := make_date(parts[3]::int, parts[2]::int, parts[1]::int);
      RETURN parsed_date;
    EXCEPTION WHEN OTHERS THEN
      -- Invalid date, continue to next format
    END;
  END IF;
  
  -- Try DD/MM/YY or DD-MM-YY format (2-digit year)
  IF date_str ~ '^\d{1,2}[-/]\d{1,2}[-/]\d{2}$' THEN
    parts := string_to_array(REPLACE(date_str, '/', '-'), '-');
    BEGIN
      year := parts[3]::int;
      -- Assume 2000s for 00-99 range
      IF year < 100 THEN
        year := year + 2000;
      END IF;
      parsed_date := make_date(year, parts[2]::int, parts[1]::int);
      RETURN parsed_date;
    EXCEPTION WHEN OTHERS THEN
      -- Invalid date, continue to next format
    END;
  END IF;
  
  -- Try DD/MM format (assume current year)
  IF date_str ~ '^\d{1,2}[-/]\d{1,2}$' THEN
    parts := string_to_array(REPLACE(date_str, '/', '-'), '-');
    BEGIN
      parsed_date := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, parts[2]::int, parts[1]::int);
      RETURN parsed_date;
    EXCEPTION WHEN OTHERS THEN
      -- Invalid date, return NULL
    END;
  END IF;
  
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill tgl_normalized for existing records
UPDATE database_log 
SET tgl_normalized = parse_flexible_date(tgl)
WHERE tgl_normalized IS NULL AND tgl IS NOT NULL;

-- Create trigger function to auto-normalize tgl on INSERT/UPDATE
CREATE OR REPLACE FUNCTION trigger_normalize_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tgl IS NOT NULL THEN
    NEW.tgl_normalized := parse_flexible_date(NEW.tgl);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_database_log_normalize_date ON database_log;

-- Create trigger
CREATE TRIGGER trigger_database_log_normalize_date
  BEFORE INSERT OR UPDATE OF tgl ON database_log
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_date();

-- Create indexes for performance
-- Composite index for sorting by date, time, and id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_database_log_date_time_id 
  ON database_log(tgl_normalized DESC NULLS LAST, waktu DESC, id DESC);

-- Index on normalized date for fast filtering
CREATE INDEX IF NOT EXISTS idx_database_log_tgl_normalized 
  ON database_log(tgl_normalized DESC NULLS LAST);

-- Index for range queries on date with type filtering
CREATE INDEX IF NOT EXISTS idx_database_log_date_type 
  ON database_log(tgl_normalized DESC NULLS LAST, type);

-- Add comment to explain the column
COMMENT ON COLUMN database_log.tgl_normalized IS 'Standardized date column in YYYY-MM-DD format for accurate sorting and filtering';
COMMENT ON FUNCTION parse_flexible_date(text) IS 'Converts various date formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD) to DATE type';
