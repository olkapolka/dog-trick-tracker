-- Harden admin RLS checks for tricks writes.
-- Use EXISTS instead of scalar subquery to avoid null/edge-case policy failures.

DROP POLICY IF EXISTS "Admins can insert tricks" ON tricks;
DROP POLICY IF EXISTS "Admins can update tricks" ON tricks;
DROP POLICY IF EXISTS "Admins can delete tricks" ON tricks;

CREATE POLICY "Admins can insert tricks"
  ON tricks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update tricks"
  ON tricks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete tricks"
  ON tricks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );
