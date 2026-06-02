# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Use EXISTS subquery for admin RLS policies in Supabase

- **Context**: supabase/migrations/ — any migration adding admin-gated write policies on a table
- **Problem**: Scalar subquery form `(SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true` silently fails on some Postgres/Supabase builds and does not include `TO authenticated` role scoping, requiring follow-up corrective migrations.
- **Rule**: Write admin RLS policies using `EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)` and always add `TO authenticated` role scoping. Also add a separate SELECT policy for admins if they need to read soft-deleted or otherwise-filtered rows.
- **Applies to**: all Supabase RLS migrations with admin-gated access

## Use exact npm package versions

- **Context**: the whole current project
- **Problem**: shai-hulud attack
- **Rule**: Always use exact versions (no ^ or ~) in package.json dependencies
- **Applies to**: all
