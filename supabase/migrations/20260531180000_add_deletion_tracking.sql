-- Add soft delete columns to profiles table
ALTER TABLE profiles 
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deletion_scheduled_for TIMESTAMPTZ;
COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when deletion was requested (soft delete marker)';
COMMENT ON COLUMN profiles.deletion_scheduled_for IS 'Timestamp when permanent deletion should execute (14 days after deleted_at)';
