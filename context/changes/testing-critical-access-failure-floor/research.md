---
date: 2026-06-08T13:09:45+0200
researcher: GitHub Copilot (GPT-5.3-Codex)
git_commit: 2658874bf5daca843e4a7d8cd56edd45199c9ceb
branch: feature/m3l1-test-plan
repository: dog-trick-tracker
topic: "Ground rollout Phase 1 of test-plan risks #1, #3, #5"
tags: [research, codebase, auth, middleware, error-handling, authorization, supabase-rls]
status: complete
last_updated: 2026-06-08
last_updated_by: GitHub Copilot (GPT-5.3-Codex)
---

# Research: Phase 1 Test Rollout Grounding

**Date**: 2026-06-08T13:09:45+0200  
**Researcher**: GitHub Copilot (GPT-5.3-Codex)  
**Git Commit**: 2658874bf5daca843e4a7d8cd56edd45199c9ceb  
**Branch**: feature/m3l1-test-plan  
**Repository**: dog-trick-tracker

## Research Question

Ground rollout Phase 1 from [context/foundation/test-plan.md](context/foundation/test-plan.md): validate risks #1 (access/session continuity), #3 (failure-path behavior), #5 (authorization/ownership abuse), verify/adjust response guidance, identify existing tests, and recommend cheapest high-signal test layers.

## Summary

1. Risk #1 is real and currently untested: access control is centralized in middleware + server-side session hydration, and protected API routes rely on middleware-populated locals. Session/cookie or redirect regressions would immediately cut users off from protected pages and APIs.
2. Risk #3 is real and partially under-specified in the plan: API routes usually return explicit errors, but page-level data loads often do not distinguish query failure from empty data. Score calculation and admin-role helper collapse some failures into normal-looking values.
3. Risk #5 is mostly well-defended for write paths: ownership is enforced by endpoint scoping plus RLS policies. No obvious write-side IDOR was found. The notable residual risk is broad read visibility by policy design (authenticated/global read on follows; public read on user_tricks).
4. Current test base is sparse and does not cover any of these risks: only three `src/lib/*.test.ts` unit tests exist.

## Detailed Findings

### 1) Risk #1: Authenticated Access Through Session Transitions

- Protected routes are path-prefix guarded in middleware via `PROTECTED_ROUTES` ([src/middleware.ts#L4](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L4), [src/middleware.ts#L28](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L28)).
- Middleware hydrates `context.locals.user` from `supabase.auth.getUser()` ([src/middleware.ts#L19](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L19), [src/middleware.ts#L22](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L22)), and redirects unauthenticated protected traffic ([src/middleware.ts#L29](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L29)).
- Profile-presence gating is part of access flow for most protected routes ([src/middleware.ts#L34](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L34), [src/middleware.ts#L47](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L47)).
- Sign-in performs auth then profile check before redirect ([src/pages/api/auth/signin.ts#L14](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/auth/signin.ts#L14), [src/pages/api/auth/signin.ts#L21](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/auth/signin.ts#L21), [src/pages/api/auth/signin.ts#L28](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/auth/signin.ts#L28)).
- Sign-out clears session via Supabase and redirects ([src/pages/api/auth/signout.ts#L4](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/auth/signout.ts#L4), [src/pages/api/auth/signout.ts#L6](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/auth/signout.ts#L6)).
- Protected APIs assume middleware has populated auth context; they deny when `!user` ([src/pages/api/tricks/status.ts#L14](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/tricks/status.ts#L14), [src/pages/api/follow.ts#L5](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/follow.ts#L5), [src/pages/api/unfollow.ts#L5](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/unfollow.ts#L5)).

Guidance verdict for #1: valid. Keep integration-first emphasis. Add explicit session-transition scenarios (signin -> protected page, signout -> protected API/page denial, profile-missing redirect continuity).

### 2) Risk #3: Failure/Fallback Paths vs Silent Success

- Dashboard/profile/friends page queries do not consistently handle query `error`; many reads destructure `data` only ([src/pages/dashboard.astro#L23](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/dashboard.astro#L23), [src/pages/dashboard.astro#L33](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/dashboard.astro#L33), [src/pages/profile.astro#L18](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/profile.astro#L18), [src/pages/friends.astro#L27](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/friends.astro#L27), [src/pages/friends.astro#L50](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/friends.astro#L50)).
- Score calculation returns `0` by reduction fallback without explicit query-error branch ([src/lib/calculate-score.ts#L11](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/lib/calculate-score.ts#L11), [src/lib/calculate-score.ts#L17](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/lib/calculate-score.ts#L17)).
- Admin role helper converts profile-query errors into `false` (same outcome as non-admin) ([src/lib/admin.ts#L5](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/lib/admin.ts#L5), [src/lib/admin.ts#L7](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/lib/admin.ts#L7)).
- In contrast, API endpoints show good explicit error mapping patterns (401/400/409/500) in follow/unfollow/status/upload handlers ([src/pages/api/follow.ts#L7](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/follow.ts#L7), [src/pages/api/follow.ts#L49](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/follow.ts#L49), [src/pages/api/unfollow.ts#L41](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/unfollow.ts#L41), [src/pages/api/profile/upload-photo.ts#L57](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/profile/upload-photo.ts#L57)).

Guidance verdict for #3: partially correct, needs refinement. The risk is less "no crash" and more "error indistinguishable from empty/zero state" in SSR pages + helper functions. Add a requirement to assert distinct behavior for query-failure vs genuinely empty data.

### 3) Risk #5: Authorization / Ownership Abuse (IDOR class)

- Middleware enforces authentication before protected APIs/pages ([src/middleware.ts#L28](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L28), [src/middleware.ts#L30](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/middleware.ts#L30)).
- Endpoint ownership is scoped to authenticated user IDs server-side (not client-controlled):
  - Follow insert uses `follower_id: user.id` ([src/pages/api/follow.ts#L64](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/follow.ts#L64))
  - Unfollow delete filters by `follower_id = user.id` ([src/pages/api/unfollow.ts#L38](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/unfollow.ts#L38))
  - Trick status upsert writes `user_id: user.id` ([src/pages/api/tricks/status.ts#L60](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/tricks/status.ts#L60))
  - Profile photo update filters by `user_id = user.id` ([src/pages/api/profile/upload-photo.ts#L70](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/src/pages/api/profile/upload-photo.ts#L70)).
- RLS policies backstop write ownership:
  - user_tricks owner-only write ([supabase/migrations/20260526132227_create_user_tricks_table.sql#L18](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/supabase/migrations/20260526132227_create_user_tricks_table.sql#L18), [supabase/migrations/20260526132227_create_user_tricks_table.sql#L21](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/supabase/migrations/20260526132227_create_user_tricks_table.sql#L21))
  - follows owner-only insert/delete ([supabase/migrations/20260531000001_create_follows_table.sql#L18](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/supabase/migrations/20260531000001_create_follows_table.sql#L18), [supabase/migrations/20260531000001_create_follows_table.sql#L21](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/supabase/migrations/20260531000001_create_follows_table.sql#L21)).

Guidance verdict for #5: valid for ownership write abuse. Correction: include privacy/read-surface checks as separate abuse angle because some reads are intentionally broad by policy:
- user_tricks is publicly readable ([supabase/migrations/20260531160000_allow_public_user_tricks_read.sql#L5](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/supabase/migrations/20260531160000_allow_public_user_tricks_read.sql#L5))
- follows readable by any authenticated user ([supabase/migrations/20260531000001_create_follows_table.sql#L15](https://github.com/olkapolka/dog-trick-tracker/blob/2658874bf5daca843e4a7d8cd56edd45199c9ceb/supabase/migrations/20260531000001_create_follows_table.sql#L15)).

## Existing Tests and Gaps

- Current tests are only:
  - [src/lib/slugify.test.ts](src/lib/slugify.test.ts)
  - [src/lib/validate-trick.test.ts](src/lib/validate-trick.test.ts)
  - [src/lib/recalculate-user-scores.test.ts](src/lib/recalculate-user-scores.test.ts)
- Runner is Node test + tsx scoped to `src/lib/*.test.ts` ([package.json](package.json)).
- No tests currently cover middleware, API auth/authorization, SSR fallback/error paths, or RLS-backed ownership behavior.

## Cheapest Useful Test Layers (Cost x Signal)

1. Integration at API + middleware boundary (Phase 1 primary):
   - Verify protected route redirect behavior, profile-missing redirect, and API 401/403/500 behavior with realistic request/cookie context.
2. Focused unit tests for helper error contracts:
   - `calculateProgressScore` query failure behavior.
   - `isAdmin` error vs non-admin distinction (or explicitly codify current collapse if intentional).
3. Integration security scenarios for ownership abuse:
   - Cross-user mutation attempts on trick status/follow/unfollow/upload-photo to confirm endpoint scoping + RLS enforcement.
4. Defer broad browser E2E until a specific regression requires browser signal beyond middleware/API integration.

## Hot-Spot Evidence Check (Misleading vs Useful)

- Useful likelihood evidence:
  - `src/pages` for #1 and #3 (actual access and fallback logic is concentrated there).
  - `src/middleware.ts` for #1 and #5.
- Potentially misleading evidence:
  - `src/components` as primary signal for #3 in this phase; most failure-path risk currently sits in SSR page loaders and API/lib error translation, not in component rendering logic.

## Architecture Insights

- Auth architecture is defense-in-depth: middleware gate + endpoint checks + RLS constraints.
- Error handling style is split: API routes are explicit; SSR page loaders and helpers are less explicit about data vs error semantics.
- Authorization model intentionally combines strict write ownership with broader read visibility for social/profile features.

## Historical Context (from prior changes)

- Public profile/following rollout established public-facing social surfaces and follow table model ([context/archive/2026-05-31-public-profile-view/plan.md](context/archive/2026-05-31-public-profile-view/plan.md)).
- Follow relationships were archived as completed scope with API-level follow/unfollow patterns now in production ([context/archive/2026-05-31-follow-relationships/change.md](context/archive/2026-05-31-follow-relationships/change.md)).
- Team lesson for admin RLS uses `EXISTS` + `TO authenticated`, reflected in current admin trick policy migration ([context/foundation/lessons.md](context/foundation/lessons.md), [supabase/migrations/20260602141000_fix_admin_tricks_rls_policies.sql](supabase/migrations/20260602141000_fix_admin_tricks_rls_policies.sql)).

## Related Research

- No prior `research.md` artifact exists yet for this change-id.

## Open Questions

1. Should query failures in dashboard/profile/friends render explicit user-facing fallback states, or is redirect/empty-state behavior considered acceptable UX?
2. Is collapsing `isAdmin()` query failures to `false` a deliberate security posture, or should operational errors be observable separately?
3. Are current read-visibility policies (`user_tricks` public read, `follows` auth-wide read) still aligned with product privacy expectations, or should they be narrowed and tested as abuse boundaries?
