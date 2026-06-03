-- Create tricks table with difficulty levels and weighted scoring

CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TABLE tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  difficulty difficulty_level NOT NULL,
  difficulty_weight INTEGER NOT NULL CHECK (difficulty_weight IN (1, 2, 3)),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tricks_difficulty ON tricks(difficulty);
CREATE INDEX idx_tricks_slug ON tricks(slug);
ALTER TABLE tricks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tricks are publicly readable"
  ON tricks FOR SELECT
  USING (true);
