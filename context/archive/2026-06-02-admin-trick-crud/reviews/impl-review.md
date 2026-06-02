<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Admin Trick CRUD

- **Plan**: context/changes/admin-trick-crud/plan.md
- **Scope**: All Phases (1–5)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Users can self-promote to admin via unrestricted profile UPDATE policy

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260526132201_create_profiles_table.sql:29–31
- **Detail**: The "Users can update own profile" RLS policy (USING auth.uid() = user_id, no WITH CHECK) allows any user to UPDATE any column of their own profile row — including the is_admin column added in Phase 1. A user can call the Supabase API directly and set themselves is_admin = true, bypassing all admin checks.
- **Fix A ⭐ Recommended**: Add a new migration that restricts self-updates via a CHECK-guarding policy:
  ```sql
  DROP POLICY "Users can update own profile" ON profiles;
  CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND is_admin = (SELECT is_admin FROM profiles WHERE user_id = auth.uid()));
  ```
  - Strength: Closes the privilege escalation hole entirely at the DB layer; matches plan's "is_admin flag set via SQL only" intent.
  - Tradeoff: Adds one more migration; the WITH CHECK subquery on the same table may need a SECURITY DEFINER function to avoid RLS recursion — worth testing locally first.
  - Confidence: HIGH — the plan explicitly states admin grant is done via SQL only.
  - Blind spot: Potential RLS recursion in Postgres needs local verification.
- **Fix B**: Block is_admin updates in the API layer (middleware) — strip is_admin from any profile update request body.
  - Strength: Simpler to implement today.
  - Tradeoff: Leaves the DB layer unprotected — direct Supabase client calls still self-promote. Incomplete on its own.
  - Confidence: LOW — no profile update API route currently exists; future-state guard only.
  - Blind spot: No profile update API route currently exists.
- **Decision**: FIXED via Fix A — migration 20260602150000_protect_is_admin_column.sql added

### F2 — recalculateScoresForTrick is a no-op (computes but never writes scores)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/recalculate-user-scores.ts:47–49
- **Detail**: recalculateScoresForTrick calls getRecalculatedScoresForTrick and discards the result — no scores are persisted. The plan anticipated this if scores are on-the-fly (they are, no stored score column). However, the function still executes N DB round-trips per affected user and throws the results away — wasted work on every difficulty edit. Progress check 5.4 is marked done, but on-the-fly scores recalculate automatically on next page load anyway.
- **Fix A ⭐ Recommended**: Remove the recalculateScoresForTrick call from update.ts and keep the function as a stub with a comment noting scores are on-the-fly.
  - Strength: Eliminates N unnecessary DB queries per difficulty edit. On-the-fly scores already reflect the new difficulty on next render.
  - Tradeoff: If scores are later cached/stored, the recalc call needs to be wired back in — deliberate future change.
  - Confidence: HIGH — calculateProgressScore queries live data; no cached score column exists.
  - Blind spot: None significant.
- **Fix B**: Leave as-is with an inline comment documenting the no-op intent.
  - Strength: Zero code change; keeps hook point in place for future caching.
  - Tradeoff: Silently wastes N DB calls on every difficulty edit; misleads future developers.
  - Confidence: MEDIUM — acceptable only if score caching is planned soon.
  - Blind spot: Timeline for score caching.
- **Decision**: FIXED via Fix A — removed call from update.ts, added comment for future score caching

### F3 — verify-scores.ts exposes user IDs and scores in production

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/admin/tricks/verify-scores.ts
- **Detail**: This dev-only helper endpoint is live in production with no environment guard. It returns userId values for all users who have finished a given trick. It's admin-gated but that doesn't make user enumeration appropriate in prod.
- **Fix**: Either delete the file before merging to main, or wrap the route body in `if (import.meta.env.PROD) return new Response(null, { status: 404 })`.
- **Decision**: PENDING

### F4 — status.ts (unplanned route) accepts trickId without UUID validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline / Safety & Quality
- **Location**: src/pages/api/tricks/status.ts
- **Detail**: Unplanned route added outside admin scope. Accepts trickId from request body without UUID validation, passes it directly to Supabase upsert. Invalid trickId causes a DB error whose raw message is leaked back to the client.
- **Fix**: Add UUID format validation for trickId (match the pattern in delete.ts:36) and replace raw error.message passthrough with a generic "Internal server error" response.
- **Decision**: FIXED — added UUID validation and sanitized error response in status.ts

### F5 — list.ts has no pagination — unbounded query on every SWR poll

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/admin/tricks/list.ts:44
- **Detail**: AdminTrickList polls this endpoint via SWR with no limit. Fine at 12 tricks. The plan flags pagination at > 1000 tricks but the endpoint has no limit guard.
- **Fix**: Add `.limit(500)` as an upper bound until pagination is formally implemented.
- **Decision**: FIXED — added .limit(500) to list.ts query

### F6 — slugify.ts behavior exceeds plan spec (underscore handling)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/slugify.ts
- **Detail**: Plan specified lowercase + spaces-to-hyphens + remove non-alphanumeric. Implementation also collapses underscores and trims leading/trailing hyphens. Unit tests don't cover underscore input.
- **Fix**: Add a test case for underscore input ("trick_name" → "trick-name") or document the extended behavior.
- **Decision**: FIXED — added test case documenting actual behavior (underscores are stripped, not hyphenated)

### F7 — Two extra migrations needed to correct Phase 1 RLS policies

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260602141000_*.sql, 20260602143500_*.sql
- **Detail**: Original Phase 1 migrations used scalar subquery form for admin RLS and omitted an admin SELECT policy. Two follow-up migrations fixed this. Migrations are correct now but the pattern (fix via separate migration) is worth capturing as a lesson.
- **Fix**: Record "use EXISTS subquery for RLS admin checks" in lessons.md.
- **Decision**: FIXED — lesson appended to context/foundation/lessons.md

### F8 — supabase package uses caret range (^2.102.0) violating exact-version rule

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: package.json:58
- **Detail**: Project lessons.md mandates exact versions (no ^ or ~). The supabase CLI dev dependency uses "^2.102.0" — the only caret range in the file.
- **Fix**: Change to `"supabase": "2.102.0"` in package.json.
- **Decision**: FIXED — pinned to exact version in package.json
