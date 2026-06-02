-- Prevent users from self-promoting to admin via the profile UPDATE RLS policy.
-- The WITH CHECK subquery cannot reference the same table directly (RLS recursion),
-- so a SECURITY DEFINER function reads the current is_admin value for the caller.

CREATE OR REPLACE FUNCTION get_own_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin FROM profiles WHERE user_id = auth.uid();
$$;

DROP POLICY "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_admin = get_own_is_admin());
