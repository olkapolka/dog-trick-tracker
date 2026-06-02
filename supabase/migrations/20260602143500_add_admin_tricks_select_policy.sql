-- Allow admins to read all tricks, including soft-deleted rows.
-- This complements the public SELECT policy (deleted_at IS NULL only)
-- and prevents admin write flows from being blocked by row visibility rules.

CREATE POLICY "Admins can read all tricks"
  ON tricks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );
