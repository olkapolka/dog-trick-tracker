-- Add admin role flag to profiles for role-based authorization

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
ON profiles (is_admin)
WHERE is_admin = true;
