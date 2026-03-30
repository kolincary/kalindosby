/*
  # Pengaturan Prioritas Rak untuk Auto-Select

  1. Tabel Baru
    - `rack_priority_settings`
      - `id` (uuid, primary key)
      - `rack_name` (text) - Nama rak (misal: LANTAI 4, LANTAI 2, ECER-O, ECER-N, UTAMA)
      - `priority_order` (integer) - Urutan prioritas (1 = tertinggi)
      - `is_active` (boolean) - Aktif/nonaktif untuk auto-select
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS pada tabel `rack_priority_settings`
    - Policy untuk authenticated users bisa read
    - Policy untuk authenticated users bisa insert/update/delete

  3. Data Default
    - Insert data default berdasarkan prioritas saat ini:
      - LANTAI 4 (prioritas 1)
      - LANTAI 2 (prioritas 2)
      - ECER-O (prioritas 3)
      - ECER-N (prioritas 4)
      - UTAMA (prioritas 5)
*/

-- Create rack_priority_settings table
CREATE TABLE IF NOT EXISTS rack_priority_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_name text UNIQUE NOT NULL,
  priority_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rack_priority_settings ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can read rack priority settings"
  ON rack_priority_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert rack priority settings"
  ON rack_priority_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update rack priority settings"
  ON rack_priority_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete rack priority settings"
  ON rack_priority_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert default data
INSERT INTO rack_priority_settings (rack_name, priority_order, is_active)
VALUES
  ('LANTAI 4', 1, true),
  ('LANTAI 2', 2, true),
  ('ECER-O', 3, true),
  ('ECER-N', 4, true),
  ('UTAMA', 5, true)
ON CONFLICT (rack_name) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_rack_priority_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rack_priority_settings_updated_at
  BEFORE UPDATE ON rack_priority_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_rack_priority_settings_updated_at();