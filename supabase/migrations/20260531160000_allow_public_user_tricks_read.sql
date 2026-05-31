-- Allow public read access to user_tricks for public profiles
-- This enables viewing training points and trick lists on public profile pages

DROP POLICY IF EXISTS "Users can view own trick progress" ON user_tricks;

CREATE POLICY "User tricks are publicly readable"
  ON user_tricks FOR SELECT
  USING (true);
