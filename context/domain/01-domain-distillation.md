---
title: "Dog Trick Tracker — Domain Distillation"
created: 2026-06-18
type: domain-distillation
---

# Dog Trick Tracker — Domain Distillation

## STEP 0 — Project Context

### Source Documents Found

| Document | Path |
|---|---|
| Product Requirements | `context/foundation/prd.md` |
| Shape Notes | `context/foundation/shape-notes.md` |
| Tech Stack | `context/foundation/tech-stack.md` |
| README | `README.md` |

### Stack & Repo Structure

- **Framework**: Astro v6 (SSR, server-first) + React v19 (interactive islands)
- **Runtime**: Cloudflare Workers (edge)
- **Auth + DB**: Supabase (PostgreSQL with RLS, Supabase Auth)
- **Language**: TypeScript throughout

**Layer map**:

| Layer | Location |
|---|---|
| Pages / Routes | `src/pages/` |
| API endpoints | `src/pages/api/` |
| Domain logic | `src/lib/` |
| UI components | `src/components/` |
| DB schema + migrations | `supabase/migrations/` |
| DB types | `src/lib/database.types.ts` |

Business logic is concentrated in `src/lib/` (pure functions + Supabase queries) and `supabase/migrations/` (schema constraints and RLS policies).

---

## STEP 1 — Ubiquitous Language

### Core Domain Concepts

| Term | Definition | Source Citation | Code Location |
|---|---|---|---|
| **Trick** | A named dog-training exercise with a step-by-step description and a fixed difficulty level. The unit of the catalog. | prd.md §Trick Catalog | `database.types.ts:83` (`tricks` table), `supabase/migrations/20260526132218_create_tricks_table.sql` |
| **Trick Catalog** | The admin-curated set of all active (non-deleted) tricks, organized into three difficulty sections. | prd.md §"The catalog is organized into three static difficulty sections" | `src/pages/dashboard.astro:36-44` (query), `supabase/seed.sql` (initial 12 tricks) |
| **Difficulty Level** | Enum with three values: `beginner`, `intermediate`, `advanced`. Assigned by Admin; immutable after creation (only Admin can change it). | prd.md §Business Logic, prd.md §Trick Catalog | `database.types.ts:152`, `supabase/migrations/20260526132218_create_tricks_table.sql:3` |
| **Difficulty Weight** | An integer (1, 2, 3) derived from Difficulty Level (beginner=1, intermediate=2, advanced=3). Used to compute Progress Score. | prd.md §Business Logic: "beginner = 1, intermediate = 2, advanced = 3" | `database.types.ts:89`, `src/pages/api/admin/tricks/create.ts:7-11` (`DIFFICULTY_WEIGHT` map), `supabase/migrations/20260526132218_create_tricks_table.sql:9` (`CHECK (difficulty_weight IN (1, 2, 3))`) |
| **Trick Status** | The relationship state a user holds with a trick: `favorite`, `in-progress`, or `finished`. There is no "untracked" row — absence of a row means the trick has no status for that user. | prd.md §Success Criteria, FR-008–010 | `database.types.ts:153`, `supabase/migrations/20260526132227_create_user_tricks_table.sql:3` |
| **User Trick** | The join record linking a user to a trick with a status. Composite primary key `(user_id, trick_id)` enforces one status per trick per user. | prd.md §Data persistence | `database.types.ts:116-147`, `supabase/migrations/20260526132227_create_user_tricks_table.sql` |
| **Progress Score** | A user's weighted total: sum of `difficulty_weight` for all `finished` tricks. Never decays or resets. Displayed on the profile. | prd.md §Business Logic: "every trick marked 'finished' adds its difficulty weight to the user's total score" | `src/lib/calculate-score.ts:20-47`, `src/components/catalog/TrainingPoints.tsx`, `src/pages/api/tricks/score.ts` |
| **Profile** | A user's public identity page containing dog info (name, breed, date of birth, sex, optional photo) and owner `login_name`. One profile per auth user. | prd.md §FR-003, FR-004 | `database.types.ts:42-80`, `supabase/migrations/20260526132201_create_profiles_table.sql` |
| **Login Name** | A unique, human-readable URL slug for the profile (format: `^[a-z][a-z0-9-]{2,19}$`). Enables friendly sharing URLs (`/@username`). | prd.md §FR-003: "unique login name allows friendly sharing" | `database.types.ts:49`, `supabase/migrations/20260527000001_add_login_name_constraints.sql` |
| **Follow** | A one-way relationship: User A bookmarks User B's profile to revisit later. No reciprocation required. Not a social feed — MVP is "profile bookmarking". | prd.md §FR-013: "following in MVP is simplified to profile bookmarks" | `database.types.ts:22-40`, `supabase/migrations/20260531000001_create_follows_table.sql`, `src/pages/api/follow.ts` |
| **Followers / Following** | Two views on the Follow relation. `followers` = users who follow the current user; `following` = users the current user follows. Displayed in the Friends tab. | prd.md §FR-015, FR-016 | `src/pages/friends.astro` (page), `src/lib/page-state-contracts.ts:37-53` |
| **Admin** | A user role stored as `is_admin: boolean` on the Profile. Grants catalog management rights. Promotion requires direct DB operation (no self-promotion path; protected by RLS). | prd.md §Access Control, FR-018–020 | `database.types.ts:48`, `src/lib/admin.ts`, `supabase/migrations/20260602000001_add_admin_role.sql`, `supabase/migrations/20260602150000_protect_is_admin_column.sql` |
| **Soft Delete** | Tricks are never hard-deleted. Setting `deleted_at` removes them from the public catalog and all user queries (RLS filter `deleted_at IS NULL`). Admin can restore. | Not in original prd.md (implementation decision) | `supabase/migrations/20260602000002_add_tricks_soft_delete.sql`, `src/pages/api/admin/tricks/delete.ts:61-64`, `src/pages/api/admin/tricks/restore.ts:60-64` |
| **Training Points** | UI label for the Progress Score shown on the dashboard and profile. Same concept, different label. | prd.md §Business Logic | `src/components/catalog/TrainingPoints.tsx`, `src/pages/dashboard.astro:98` |
| **Slug** | URL-safe identifier for a trick (lowercase alphanumeric + hyphens). Admin-set at creation; unique. | `validate-trick.ts:9` (SLUG_PATTERN) | `database.types.ts:87`, `src/lib/slugify.ts`, `src/lib/validate-trick.ts:8-13` |
| **Optimistic Update** | UI pattern used in StatusToggle: status is reflected immediately in the browser while the network request is in-flight; rolled back on failure. | prd.md §Guardrails: "immediate with a single click", NFR 500ms | `src/components/catalog/StatusToggle.tsx:31-48` |

---

## STEP 2 — Subdomain Classification

| Concept / Area | Classification | Justification |
|---|---|---|
| **Progress Score calculation** | **Core** | The PRD names this the primary business logic: weighted scoring distinguishes this app from generic habit trackers. It is the "training progress" measurement that gives the product its value proposition. |
| **Trick Status management** (favorite / in-progress / finished) | **Core** | The first primary success criterion — "track which tricks their dog knows and change status on any trick." Without status tracking there is no product. |
| **Trick Catalog** (difficulty-organized, admin-curated) | **Core** | The PRD explicitly calls out that curated, domain-focused tricks are what differentiates this from generic apps. The difficulty segmentation drives the scoring rule. |
| **Difficulty Weight derivation** | **Core** | The mapping (beginner=1, intermediate=2, advanced=3) is the scoring rule's kernel. It is what makes the score "weighted" rather than just a count. |
| **One-way Follow / Profile Bookmarking** | **Supporting** | Enables social viewing of others' progress (secondary success criterion), but the MVP explicitly defers an aggregated feed. Adds engagement without being the core differentiator. |
| **Friends tab** (follower/following lists) | **Supporting** | UI surface for the Follow feature. Not independently valuable; supports Follow. |
| **Admin catalog management** (CRUD + soft-delete + restore) | **Supporting** | Necessary to keep the catalog high-quality, but the value is in the curated content, not the management tooling itself. |
| **User Profile** (dog info, login name, photo) | **Supporting** | Required identity surface for sharing and social features. Contains no domain rules beyond uniqueness of `login_name`. |
| **Authentication** (email/password via Supabase Auth) | **Generic** | Standard auth — no domain differentiation. Delegated entirely to Supabase. |
| **Photo upload** (dog photo to Supabase Storage) | **Generic** | Standard blob storage. No domain logic. |
| **Slug generation / validation** | **Generic** | URL utility. Pure string transformation with no domain semantics. |
| **Soft delete** | **Generic** | Standard CRUD lifecycle pattern. |
| **Route access guards / middleware** | **Generic** | Standard auth middleware. |

---

## STEP 3 — Candidate Aggregates and Invariants

### Aggregate 1: `Trick` (catalog entry)

**Boundary**: One trick row plus its difficulty-weight pair.

| Invariant | Source | Code Enforcement |
|---|---|---|
| A trick belongs to exactly one difficulty level. | prd.md §Business Logic: "Each trick is assigned to exactly one section based on its difficulty level." | **Declared & Enforced**: `difficulty difficulty_level NOT NULL` (migration `20260526132218`). Enum type prevents out-of-range values. |
| `difficulty_weight` must equal the numeric representation of `difficulty` (beginner=1, intermediate=2, advanced=3). | prd.md §Business Logic: "beginner = 1, intermediate = 2, advanced = 3" | **Partial**: DB CHECK `difficulty_weight IN (1, 2, 3)` (`20260526132218:9`) prevents invalid weights but does NOT prevent `difficulty=beginner, difficulty_weight=3`. Application enforces mapping via `DIFFICULTY_WEIGHT` constant (`create.ts:7-11`, `update.ts:7-11`), but there is no DB constraint tying the two columns together. **Gap exists.** |
| Slug is globally unique. | Implicit (URL routing requires uniqueness). | **Enforced**: `slug TEXT NOT NULL UNIQUE` (`20260526132218:6`). |
| A trick's name is at most 100 characters. | Not in PRD — implementation rule. | **Declared in app only**: `validate-trick.ts:18`. No DB constraint. |
| Description is at least 20 characters. | Not in PRD — implementation rule. | **Declared in app only**: `validate-trick.ts:35`. No DB constraint. |
| Deleted tricks are invisible to regular users. | Not explicit in PRD but implied by admin-only restore (FR-020). | **Enforced**: RLS policy altered in `20260602000002`: `USING (deleted_at IS NULL)`. |

### Aggregate 2: `UserTrick` (trick progress record)

**Boundary**: One `(user_id, trick_id)` pair with a status.

| Invariant | Source | Code Enforcement |
|---|---|---|
| A user may have at most one status per trick. | Implied by FR-011/012: single-click toggle between statuses (not accumulation). | **Enforced**: composite PK `(user_id, trick_id)` (`20260526132227:11`). Upsert `onConflict: "user_id,trick_id"` in `status.ts:60`. |
| Status must be one of `favorite`, `in-progress`, `finished`. | prd.md §Success Criteria | **Enforced**: `status trick_status NOT NULL` with DB enum (`20260526132227:3`). App also validates (`status.ts:10-12`). |
| Only the owning user may write their own trick status. | prd.md §Access Control | **Enforced**: RLS `WITH CHECK (auth.uid() = user_id)` (`20260526132227:23`). |
| A UserTrick must reference a valid, non-deleted trick. | Implied by product intent (no "orphan" progress entries). | **Partial**: FK constraint `user_tricks_trick_id_fkey` references `tricks(id)` (`database.types.ts:141`). However, if a trick is soft-deleted, its UserTrick rows are **retained** (no cascade). Users keep "finished" status on deleted tricks, which inflates their progress score. **Gap exists.** |

### Aggregate 3: `Profile` (user identity)

**Boundary**: One profile per auth user, containing dog info + role.

| Invariant | Source | Code Enforcement |
|---|---|---|
| Exactly one profile per auth user. | FR-003: profile creation is part of onboarding flow. | **Enforced**: `user_id UUID UNIQUE` (`20260526132201:6`). |
| `login_name` is unique, 3–20 chars, format `^[a-z][a-z0-9-]{2,19}$`. | FR-003: "unique login name allows friendly sharing" | **Enforced**: UNIQUE constraint + regex CHECK (`20260527000001`). |
| `sex` must be `'Male'` or `'Female'`. | FR-003: dog sex field. | **Enforced**: `CHECK (sex IN ('Male', 'Female'))` (`20260526132201:11`). |
| `is_admin` cannot be self-elevated by the profile owner. | prd.md §Access Control (admin role exists for catalog curation). | **Enforced**: RLS `WITH CHECK (is_admin = get_own_is_admin())` (`20260602150000`). `SECURITY DEFINER` function prevents RLS recursion. |
| Profiles have `deleted_at` / `deletion_scheduled_for` columns. | Not in PRD (implementation addition). | **Declared** (`20260531180000`) but **not enforced** in application logic — no API endpoint or middleware checks these columns. **Dead schema.** |

### Aggregate 4: `Follow` (social graph edge)

**Boundary**: One `(follower_id, following_id)` directed edge.

| Invariant | Source | Code Enforcement |
|---|---|---|
| A user cannot follow themselves. | Logical necessity; not stated explicitly in PRD. | **Dual enforcement**: DB CHECK `follower_id != following_id` (`20260531000001:7`) + application guard in `follow.ts:45-49`. |
| A user may follow another user at most once (idempotency). | Implied by toggle-style "Follow/Unfollow" UX. | **Enforced**: composite PK `(follower_id, following_id)`. App returns 409 on duplicate (`follow.ts:78-81`). |
| Only the follower can create/delete their own follow rows. | prd.md §Access Control | **Enforced**: RLS `WITH CHECK (auth.uid() = follower_id)` / `USING (auth.uid() = follower_id)` (`20260531000001:20-23`). |

### Aggregate 5: `ProgressScore` (derived value)

**Boundary**: Not a stored entity — a pure computation over `UserTrick` rows.

| Invariant | Source | Code Enforcement |
|---|---|---|
| Score = sum of `difficulty_weight` for all `finished` UserTrick rows. | prd.md §Business Logic: "every trick marked 'finished' adds its difficulty weight" | **Declared**: `calculate-score.ts:37-41`. Computed on-demand; not persisted in any column. |
| Score never decays or resets. | prd.md §Business Logic: "The score does not decay, reset, or expire" | **Partial**: The computation is always additive (only queries `status='finished'`). However, soft-deleting a trick whose status is 'finished' silently removes it from future score calculations because the RLS filter hides the trick, breaking the join — meaning the score CAN silently drop after an admin soft-delete. **Gap exists** (see Step 4). |
| Score updates immediately when a trick is marked "finished". | prd.md §Business Logic: "updates immediately when a trick status changes to 'finished'" | **Partial**: SWR `revalidateScore()` is called optimistically after status mutation (`StatusToggle.tsx:42`), but it is a background revalidation (`void`), not a synchronous update. The score is re-fetched from the API; network latency means UI update is near-immediate but not atomic. |

---

## STEP 4 — Model vs. Code Crossovers

| # | Domain says (source) | Code does (behaviour) | Evidence |
|---|---|---|---|
| **MC-01** | "difficulty_weight = 1 for beginner, 2 for intermediate, 3 for advanced" — the weight is a **function** of difficulty, not an independent property. (prd.md §Business Logic) | The `tricks` table stores `difficulty_weight` as an independent column. Application enforces the mapping at write time via `DIFFICULTY_WEIGHT` constant, but no DB constraint ties the two columns together. A manual DB write can create `difficulty='beginner', difficulty_weight=3`. | `create.ts:7-11`, `supabase/migrations/20260526132218_create_tricks_table.sql:9` (CHECK only validates range 1–3, not mapping) |
| **MC-02** | "The score does not decay, reset, or expire — it only increases as the user completes more tricks." (prd.md §Business Logic) | If an admin soft-deletes a trick that a user has marked "finished", that trick's `difficulty_weight` is silently excluded from future score calculations (RLS hides deleted tricks; the JOIN in `calculate-score.ts:27` returns no weight for the hidden trick). The user's score decreases without any user action. | `calculate-score.ts:27` (join on `tricks(difficulty_weight)` filtered by RLS), `supabase/migrations/20260602000002:11-13` (RLS policy `USING (deleted_at IS NULL)`) |
| **MC-03** | "Admin can remove tricks from the catalog" (FR-020) — implied to mean removal from the catalog available to users. | Soft-delete removes the trick from the public catalog AND from all active UserTrick score calculations (MC-02), but the UserTrick rows themselves are **retained**. Users retain a "finished" badge for a trick that no longer exists in the catalog, creating inconsistent UI state. | `supabase/migrations/20260526132227_create_user_tricks_table.sql:9` (FK `ON DELETE CASCADE` references `tricks(id)` — hard delete would cascade, but soft delete does not trigger CASCADE) |
| **MC-04** | PRD is silent on trick deletion recovery. | Admin can **restore** soft-deleted tricks (endpoint `restore.ts`). This is an implementation decision not in the PRD. When restored, scores automatically re-include the trick's weight (because the JOIN becomes visible again). This means a trick can be used to artificially cycle scores up and down. | `src/pages/api/admin/tricks/restore.ts`, `recalculate-user-scores.ts` (function exists but is never called; comment in `update.ts:131` explicitly notes it was removed) |
| **MC-05** | "score … updates immediately when a trick status changes to 'finished'" (prd.md §Business Logic) | `recalculateScoresForTrick` exists in `recalculate-user-scores.ts` and was apparently intended to propagate score changes on trick-weight edits. It is imported nowhere in API routes; a comment in `update.ts:131` says "Wire … back in here if score caching is added later." The function is dead code. Score is always computed on-demand. | `src/lib/recalculate-user-scores.ts`, `src/pages/api/admin/tricks/update.ts:131` |
| **MC-06** | "Profiles are not publicly listed or searchable, but shared links grant full read access." (prd.md §NFRs — Privacy) | The `profiles` table RLS policy is `USING (true)` — all rows readable by anyone, including unauthenticated requests. This is broader than the intent: a full table scan (`SELECT * FROM profiles`) returns all profiles to anyone who can reach Supabase directly, even without a shared link. | `supabase/migrations/20260526132201_create_profiles_table.sql:17-20` |
| **MC-07** | `profiles.deleted_at` and `profiles.deletion_scheduled_for` columns exist in the DB schema (migration `20260531180000`) with comments describing a 14-day grace-period deletion flow. | No application code reads or writes these columns. No API endpoint, middleware, or background job references them. The PRD does not mention account deletion at all. | `supabase/migrations/20260531180000_add_deletion_tracking.sql`, `src/lib/database.types.ts:46-47` (type definitions present but unused) |
| **MC-08** | "Trick status change is immediate (no page refresh or confirmation dialog required)" (prd.md §US-01 AC) | The `StatusToggle` component uses optimistic UI, immediately showing the new status. However, the score revalidation is fired with `void revalidateScore()` — errors in revalidation are silently swallowed, meaning a score fetch failure would leave stale score on screen without any user feedback. | `src/components/catalog/StatusToggle.tsx:42-43` |

---

## STEP 5 — Refactor Ranking

| Rank | Aggregate / Concept | Core Invariant at Risk | Current Enforcement | Risk |
|---|---|---|---|---|
| **#1** | `Trick.difficulty_weight` ↔ `Trick.difficulty` coupling (MC-01) | Weight is a pure function of difficulty — they must always agree. | Application-only (`DIFFICULTY_WEIGHT` constant at write time). No DB constraint prevents divergence via raw SQL or future API edge. | **HIGH** — This is the scoring rule's kernel. If weight and difficulty diverge, every Progress Score computed from that trick is wrong for all users, silently. |
| **#2** | `ProgressScore` invariance under soft-delete (MC-02, MC-03) | Score never decays without user action. | Score is computed on-demand via a JOIN that silently drops soft-deleted tricks. Admin soft-delete is a user-invisible score reduction. | **HIGH** — Violates an explicit PRD invariant ("score does not decay"). Users will notice their score drop after admin catalog changes with no explanation. |
| **#3** | `profiles` over-exposure (MC-06) | Profiles are only accessible via shared link, not broadly listed. | RLS `USING (true)` makes all profiles table-scannable. | **MEDIUM** — Privacy NFR violation. Not an immediate functionality bug but a compliance and trust issue. Could be addressed with a targeted RLS policy. |
| **#4** | `profiles.deleted_at` dead schema (MC-07) | N/A — this schema has no corresponding invariant yet. | Migration added two columns + comments describing a deletion flow; zero application code implements it. | **LOW-MEDIUM** — Creates schema-code divergence confusion for future developers. Either implement the account deletion flow or remove the columns. |
| **#5** | `recalculateScoresForTrick` dead code (MC-05) | Score reflects current trick weights after admin edits. | Function exists but is never called. If a trick's difficulty is edited, existing "finished" statuses immediately use the new weight (on-demand calc), which is actually correct for the current on-demand approach. The dead code creates misleading intent. | **LOW** — No active bug; the on-demand calculation is correct. Risk is confusion: a future developer may try to "wire it back" unnecessarily. |

### #1 Refactor Recommendation

**Fix the `difficulty` ↔ `difficulty_weight` coupling at the database level.**

The simplest approach: replace the `difficulty_weight` stored column with a DB-generated column or a computed expression. In PostgreSQL this can be done with a `GENERATED ALWAYS AS` expression:

```sql
difficulty_weight INTEGER GENERATED ALWAYS AS (
  CASE difficulty
    WHEN 'beginner'     THEN 1
    WHEN 'intermediate' THEN 2
    WHEN 'advanced'     THEN 3
  END
) STORED;
```

This eliminates the entire class of divergence by making `difficulty_weight` a pure function of `difficulty` at the DB layer — no application code can write them independently. The `DIFFICULTY_WEIGHT` constant in `create.ts` and `update.ts` becomes unnecessary and can be removed.

**Why this is #1**: It is the lowest-effort fix for the highest-impact invariant. The progress score is the single most distinguishing feature of the product (the "weighted training progress score" is named in the PRD's business logic section as the core rule). Any bug in that rule affects every user's data silently and is hard to detect from the outside.

---

*Sources: `context/foundation/prd.md` (primary requirements), `context/foundation/shape-notes.md` (discovery notes), `supabase/migrations/` (schema), `src/lib/` (domain logic), `src/components/` (UI), `src/pages/api/` (endpoints). All file:line citations verified against the codebase as of 2026-06-18.*
