<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Critical Access and Failure-Path Floor

- **Plan**: context/changes/testing-critical-access-failure-floor/plan.md
- **Scope**: All 5 phases
- **Date**: 2026-06-08
- **Verdict**: NEEDS ATTENTION (2 warnings)
- **Findings**: 0 critical  2 warnings  7 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Constraint errors masked as 500 in tricks/status

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/tricks/status.ts
- **Detail**: The upsert error handler returns a generic 500 "Internal server error" for all DB failures, including FK constraint violations (invalid trick_id, error code 23503). Clients cannot distinguish a bad trickId from a real server fault. The endpoint already handles UUID format but not the DB-level FK failure.
- **Fix**: Add a check for error.code === "23503" (FK violation) and return 400 with "Invalid trickId" — mirrors the existing 23505/23514 handling pattern in follow.ts.
- **Decision**: FIXED

### F2 — Fire-and-forget storage cleanup in upload-photo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/upload-photo.ts:81
- **Detail**: Cleanup after a failed profile update uses `void supabase.storage.from("dog-photos").remove([fileName])` with no logging. If the delete fails, the file orphans in storage silently and forever.
- **Fix**: Add `.catch((err) => console.error("Cleanup failed:", err))` to surface failures without blocking the 500 response.
- **Decision**: FIXED

### F3 — page-state contract tests missing profileError=true branch

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/integration/failure-states/page-failure-contracts.test.ts
- **Detail**: All six tests exercise other error paths but none passes profileError: true. The OR logic covers it implicitly but the gap is visible.
- **Fix**: Add one test per page resolver with profileError: true.
- **Decision**: FIXED

### F4 — UUID validation missing from follow.ts followingId

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/follow.ts
- **Detail**: tricks/status.ts validates trickId with UUID_PATTERN before the DB query. follow.ts relies on the profiles lookup to reject invalid UUIDs — causing unnecessary DB round-trips for malformed input.
- **Fix**: Import UUID_PATTERN and validate followingId before the profile query.
- **Decision**: FIXED

### F5 — Pagination not capped against very large page numbers

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/friends.astro:12-13
- **Detail**: Math.max(1, parseInt(...)) prevents negative pages but not arbitrarily large ones.
- **Fix**: Clamp to a MAX_PAGE constant e.g. Math.min(1000, Math.max(1, parseInt(...))).
- **Decision**: FIXED

### F6 — RLS tests verify SQL text, not runtime enforcement

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/test/integration/ownership-rls/ownership-rls-policies.test.ts
- **Detail**: Tests read migration files and match policy SQL with regex. A developer who removes a policy at the DB level (not via migration) would not be caught. Runtime RLS assertions require a live Supabase instance and are deferred to Phase 2 of the test rollout.
- **Fix**: Accept as-is for Phase 1. Document the gap in test-plan.md §6.4 as "runtime RLS enforcement deferred to Phase 2 rollout".
- **Decision**: FIXED

### F7 — profileError always false in page-state resolver calls

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/dashboard.astro, src/pages/profile.astro
- **Detail**: Both pages pass profileError: false unconditionally because a profile query error causes an early redirect before the resolver is reached. The parameter exists but carries no information.
- **Fix**: Either remove profileError from the resolver interface, or add an inline comment explaining why it is always false here.
- **Decision**: FIXED

### F8 — Test oracle intent not commented in page-state tests

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/test/integration/failure-states/page-failure-contracts.test.ts
- **Detail**: Tests verify state transitions but don't document the domain rule that forms the oracle. Future maintainers must infer it.
- **Fix**: Add a one-line comment per test naming the rule, e.g. "// Rule: any query failure → error state; only an empty dataset with no errors → empty state".
- **Decision**: FIXED
