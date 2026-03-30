/*
  # Fix database_log table access policies

  1. Security Updates
    - Ensure RLS is properly enabled on database_log table
    - Add comprehensive policies for anonymous and authenticated users
    - Allow SELECT access for all users to read log data
    - Maintain existing INSERT, UPDATE, DELETE policies

  2. Changes
    - Drop existing conflicting policies if any
    - Create new comprehensive policies for data access
    - Ensure anonymous users can read SKU and other log data
*/

-- Enable RLS on database_log table
ALTER TABLE database_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON database_log;
DROP POLICY IF EXISTS "Allow public insert access" ON database_log;
DROP POLICY IF EXISTS "Allow public update access" ON database_log;
DROP POLICY IF EXISTS "Allow public delete access" ON database_log;
DROP POLICY IF EXISTS "Anonymous users can read all data" ON database_log;
DROP POLICY IF EXISTS "Anonymous users can insert data" ON database_log;
DROP POLICY IF EXISTS "Authenticated users can read all data" ON database_log;
DROP POLICY IF EXISTS "Authenticated users can insert data" ON database_log;
DROP POLICY IF EXISTS "Authenticated users can update data" ON database_log;
DROP POLICY IF EXISTS "Authenticated users can delete data" ON database_log;

-- Create comprehensive policies for all operations
CREATE POLICY "Enable read access for all users" ON database_log
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON database_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON database_log
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON database_log
  FOR DELETE USING (true);