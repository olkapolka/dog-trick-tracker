-- Create user_tricks junction table to track trick progress

CREATE TYPE trick_status AS ENUM ('favorite', 'in-progress', 'finished');

CREATE TABLE user_tricks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trick_id UUID REFERENCES tricks(id) ON DELETE CASCADE NOT NULL,
  status trick_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, trick_id)
);

CREATE INDEX idx_user_tricks_user_id ON user_tricks(user_id);
CREATE INDEX idx_user_tricks_status ON user_tricks(status);

ALTER TABLE user_tricks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trick progress"
  ON user_tricks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trick progress"
  ON user_tricks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trick progress"
  ON user_tricks FOR UPDATE
  USING (auth.uid() = user_id);
