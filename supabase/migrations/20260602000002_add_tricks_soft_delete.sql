-- Add soft delete support for tricks and admin write policies

ALTER TABLE tricks
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tricks_active_name
ON tricks (name)
WHERE deleted_at IS NULL;

ALTER POLICY "Tricks are publicly readable"
ON tricks
USING (deleted_at IS NULL);

CREATE POLICY "Admins can insert tricks"
  ON tricks FOR INSERT
  WITH CHECK (
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Admins can update tricks"
  ON tricks FOR UPDATE
  USING (
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Admins can delete tricks"
  ON tricks FOR DELETE
  USING (
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true
  );
