---
title: "Dog Trick Tracker — Invariant Aggregate Refactor Plan"
created: 2026-06-18
type: refactor-plan
---

# Dog Trick Tracker — Invariant Aggregate Refactor Plan

---

## STEP 0 — Context Discovery

### Stack & Layers

| Layer | Location | Role |
|---|---|---|
| Pages / SSR | `src/pages/` | Renders server-side HTML; runs Supabase queries directly |
| API endpoints | `src/pages/api/` | REST handlers (POST/GET); contains auth + admin checks |
| Domain logic | `src/lib/` | Pure functions (`calculate-score.ts`, `validate-trick.ts`, `ownership-contracts.ts`) |
| UI components | `src/components/` | React islands; `StatusToggle.tsx` holds optimistic-update logic |
| DB schema + RLS | `supabase/migrations/` | Table definitions, enum types, row-level security policies |
| DB types | `src/lib/database.types.ts` | Generated TypeScript types, reflects actual DB schema |

Business logic lives in **`src/lib/`** (compute) and **`supabase/migrations/`** (constraints). No dedicated domain model layer exists — aggregates are implicit in scattered API route handlers.

---

## STEP 1 — Business Invariant Inventory

| # | Invariant | Source |
|---|---|---|
| **INV-01** | `difficulty_weight` is a pure function of `difficulty`: beginner=1, intermediate=2, advanced=3. They must always agree. | `prd.md §Business Logic`: "beginner = 1, intermediate = 2, advanced = 3" |
| **INV-02** | Progress Score = Σ `difficulty_weight` of all `finished` tricks. The score never decays, resets, or expires from user action — only increases. | `prd.md §Business Logic`: "score does not decay, reset, or expire — it only increases" |
| **INV-03** | A user may hold at most one status per trick (`favorite`, `in-progress`, `finished`). No "untracked" row exists; absence = no status. | `prd.md §Success Criteria`, FR-008–012 |
| **INV-04** | Trick status is one of the three enum values; no other state is legal. | `prd.md §Success Criteria` |
| **INV-05** | Only the owning user may write their own trick status. | `prd.md §Access Control` |
| **INV-06** | A soft-deleted trick disappears from the catalog visible to regular users; Admin can restore it. | FR-020 + implementation decision (`20260602000002`) |
| **INV-07** | A user cannot follow themselves; a follow edge is unique. | Logical necessity; `20260531000001:7` |
| **INV-08** | `login_name` is globally unique, 3–20 chars, matches `^[a-z][a-z0-9-]{2,19}$`. | FR-003 |
| **INV-09** | `is_admin` cannot be self-elevated by the profile owner. | `prd.md §Access Control`; `20260602150000` |

---

## STEP 2 — Classification and Selection

### Axis evaluation

| Invariant | (a) Core to product meaning | (b) Layer spread | (c) Enforcement state | Risk score |
|---|---|---|---|---|
| **INV-01** `difficulty_weight` = f(difficulty) | **Highest** — the scoring rule's kernel; makes score "weighted" not just a count | **3 layers**: application (`create.ts:7-11`, `update.ts:7-11`), DB (CHECK range only, not mapping), type system | **Application-only gate** — DB allows `difficulty=beginner, difficulty_weight=3` via raw SQL or a future edge | **CRITICAL** |
| **INV-02** Score never decays | **High** — named explicitly as a PRD guarantee | **4 layers**: prd, `calculate-score.ts`, SWR revalidation (`StatusToggle.tsx:43`), RLS filter | **Silently violable** — admin soft-delete drops `difficulty_weight` from JOIN; score decreases invisibly | **HIGH** |
| **INV-03** One status per trick per user | High | 2 layers: DB PK, upsert | Enforced (composite PK) | LOW — already correct |
| **INV-04** Status enum | Medium | 2 layers: DB enum, API validation | Enforced | LOW — already correct |
| **INV-05** Only owner writes status | High | 2 layers: API user check, RLS | Enforced | LOW — already correct |
| **INV-06** Soft-delete hides from catalog | High | 2 layers: RLS, admin API | Enforced for catalog visibility | MEDIUM — score side-effect unguarded (see INV-02) |
| **INV-07** Self-follow / uniqueness | Medium | 2 layers: DB CHECK, application | Enforced | LOW |
| **INV-08** login_name uniqueness/format | Medium | 2 layers: DB UNIQUE+CHECK, API | Enforced | LOW |
| **INV-09** Admin self-elevation | High | 2 layers: RLS SECURITY DEFINER | Enforced | LOW |

### Selection: **INV-01** — `difficulty_weight` is a pure function of `difficulty`

**Justification**: INV-01 is both the most core to the product (it is the scoring rule's kernel—the feature that differentiates this app from a plain checklist) and the least enforced (the DB allows divergent values; the only guard is a runtime constant in two API route files that a future developer might bypass or forget). If a trick row has `difficulty='beginner'` but `difficulty_weight=3`, every user who marks it "finished" silently earns 3 points instead of 1—a silent data corruption affecting all historical scores for all users who touched that trick, with no runtime error raised anywhere.

INV-02 (score never decays) is the second-most urgent risk, but its fix is a consequence of properly sealing INV-01: once weight is computed rather than stored, the decay-via-soft-delete problem becomes a question of what the JOIN sees. INV-01 is addressed first; INV-02 is addressed in Phase 2 of the plan.

---

## STEP 3 — Diagnosis: Where INV-01 Lives Today

### All current enforcement locations (verified file:line)

#### Application layer — the only real gate

```
src/pages/api/admin/tricks/create.ts:7-11
src/pages/api/admin/tricks/update.ts:7-11
```

Both files define an identical `DIFFICULTY_WEIGHT` constant:

```typescript
// create.ts:7-11  (update.ts:7-11 — identical)
const DIFFICULTY_WEIGHT: Record<Enums<"difficulty_level">, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};
```

The value is applied at write time: `difficulty_weight: DIFFICULTY_WEIGHT[difficulty]` (`create.ts:93`, `update.ts:110`). This is the **sole enforcer** of the mapping.

#### Database layer — range check only, mapping not enforced

```
supabase/migrations/20260526132218_create_tricks_table.sql:9
```

```sql
difficulty_weight INTEGER NOT NULL CHECK (difficulty_weight IN (1, 2, 3)),
```

This prevents values outside `{1, 2, 3}` but **does not prevent** `difficulty='beginner', difficulty_weight=3`. A raw SQL `UPDATE tricks SET difficulty_weight=3 WHERE difficulty='beginner'` succeeds silently.

#### Type system — writable, no narrowing

```
src/lib/database.types.ts:99  (Insert type)
src/lib/database.types.ts:109 (Update type)
```

Both `Insert` and `Update` types declare `difficulty_weight: number` (writable). Nothing in the type system prevents passing an arbitrary integer.

#### Score consumption — trusts whatever weight is stored

```
src/lib/calculate-score.ts:26       — JOIN: .select("tricks(difficulty_weight)")
src/lib/calculate-score.ts:38-41   — reduction: row.tricks?.difficulty_weight
```

`calculateProgressScoreResult` reads `difficulty_weight` directly from the joined `tricks` row. If the stored weight is wrong, the score is wrong, with no validation or alarm.

### Layers that do NOT enforce INV-01

| Layer | Gap |
|---|---|
| **DB generated column** | Does not exist — `difficulty_weight` is a plain `INTEGER NOT NULL` column |
| **DB trigger** | No trigger enforces or derives the mapping |
| **API input validation** (`validate-trick.ts`) | `validateTrickInput` (`src/lib/validate-trick.ts:11-43`) validates difficulty as a member of `TRICK_DIFFICULTIES` set but never checks or derives the weight |
| **UI** | `TrickFormModal.tsx` — weight is not shown to the admin and is never part of the form; the UI relies 100% on the API to set it |
| **score endpoint** (`src/pages/api/tricks/score.ts:24`) | Calls `calculateProgressScore` which trusts the stored weight |

### Error swallowing

No layer throws or alerts when weight and difficulty disagree. The incorrect weight propagates silently into every future score calculation.

---

## STEP 4 — Aggregate-Guardian Design

### Chosen aggregate root: `Trick`

**Boundary**: one `tricks` row. The single invariant to guard: `difficulty_weight` is a pure function of `difficulty`.

### Design decision: DB-generated column (preferred) vs. application aggregate

The cleanest fix for INV-01 is structural at the DB layer: convert `difficulty_weight` from a plain stored column to a **`GENERATED ALWAYS AS` computed column**. This eliminates the entire class of divergence — no application code can write them independently.

The application aggregate pattern (a TypeScript class that enforces the mapping) is a valid fallback if Supabase/PostgREST does not support generated columns in the target version, but for PostgreSQL 12+ (which Supabase runs) this is fully supported.

Both are designed below.

---

### Design A — DB-Generated Column (primary recommendation)

#### Migration

```sql
-- Phase 1 migration: replace difficulty_weight with a generated column

-- Step 1: drop the old check constraint
ALTER TABLE tricks DROP CONSTRAINT IF EXISTS tricks_difficulty_weight_check;

-- Step 2: drop the old column
ALTER TABLE tricks DROP COLUMN difficulty_weight;

-- Step 3: add computed column (STORED so it can be JOINed normally)
ALTER TABLE tricks
  ADD COLUMN difficulty_weight INTEGER GENERATED ALWAYS AS (
    CASE difficulty
      WHEN 'beginner'     THEN 1
      WHEN 'intermediate' THEN 2
      WHEN 'advanced'     THEN 3
    END
  ) STORED;
```

**Effect**: `difficulty_weight` becomes read-only at the DB layer. Any `INSERT` or `UPDATE` that tries to set `difficulty_weight` explicitly will fail with `ERROR: column "difficulty_weight" is a generated column`. The only way to change the weight is to change `difficulty`.

#### Application changes (after migration)

1. Remove `difficulty_weight` from all `INSERT`/`UPDATE` payloads:
   - `src/pages/api/admin/tricks/create.ts:89-95` — remove `difficulty_weight: DIFFICULTY_WEIGHT[difficulty]` from the insert object
   - `src/pages/api/admin/tricks/update.ts:104-114` — remove `difficulty_weight: DIFFICULTY_WEIGHT[difficulty]` from the update object
2. Remove the `DIFFICULTY_WEIGHT` constant from both files (`create.ts:7-11`, `update.ts:7-11`)
3. Update `src/lib/database.types.ts` Insert/Update types: remove `difficulty_weight` from `Insert` and `Update` shapes (it remains in `Row` as a readable computed field)

#### Invariant enforcement after migration

| Layer | Enforcement |
|---|---|
| **DB** | `GENERATED ALWAYS AS` — physically impossible to store a mismatched weight |
| **Application** | No special code needed; the column is not in the write payload |
| **Type system** | `difficulty_weight` absent from `Insert`/`Update` types — TS compiler rejects any attempt to write it |

---

### Design B — Application Aggregate (fallback)

If the generated-column migration cannot be applied (e.g., Supabase version constraint), an application-level aggregate enforces the mapping.

#### `Trick` aggregate (TypeScript)

```typescript
// src/lib/domain/trick.ts

import type { Enums } from "@/lib/database.types";

export type DifficultyLevel = Enums<"difficulty_level">;

export const DIFFICULTY_WEIGHT: Readonly<Record<DifficultyLevel, 1 | 2 | 3>> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
} as const;

export class TrickInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrickInvariantError";
  }
}

export interface TrickProps {
  name: string;
  slug: string;
  difficulty: DifficultyLevel;
  description: string;
}

export class Trick {
  readonly name: string;
  readonly slug: string;
  readonly difficulty: DifficultyLevel;
  readonly difficultyWeight: 1 | 2 | 3;   // derived, not stored separately
  readonly description: string;

  private constructor(props: TrickProps) {
    // precondition: difficulty must be a valid enum member
    if (!(props.difficulty in DIFFICULTY_WEIGHT)) {
      throw new TrickInvariantError(
        `Invalid difficulty '${props.difficulty}'. Must be beginner | intermediate | advanced.`
      );
    }
    this.name = props.name;
    this.slug = props.slug;
    this.difficulty = props.difficulty;
    this.difficultyWeight = DIFFICULTY_WEIGHT[props.difficulty];  // derived always
    this.description = props.description;
  }

  static create(props: TrickProps): Trick {
    return new Trick(props);
  }

  // Returns the DB insert payload — weight is always consistent with difficulty
  toInsert(): { name: string; slug: string; difficulty: DifficultyLevel; difficulty_weight: number; description: string } {
    return {
      name: this.name,
      slug: this.slug,
      difficulty: this.difficulty,
      difficulty_weight: this.difficultyWeight,  // derived, never independently supplied
      description: this.description,
    };
  }
}
```

**Precondition rule**: `Trick.create()` throws `TrickInvariantError` — a named domain error — if `difficulty` is invalid. It never silently updates state or logs-and-continues.

#### `TrickRepository`

```typescript
// src/lib/domain/trick-repository.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { Trick, TrickInvariantError } from "./trick";
import type { DifficultyLevel } from "./trick";

export class TrickRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async create(trick: Trick): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("tricks")
      .insert(trick.toInsert())
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: data.id };
  }

  async update(id: string, trick: Trick): Promise<void> {
    const { error } = await this.supabase
      .from("tricks")
      .update(trick.toInsert())
      .eq("id", id);

    if (error) throw new Error(error.message);
  }
}
```

**One transaction rule**: create and update each execute as a single Supabase call. No scatter across multiple queries for a single trick write.

#### Thin API route (Design B)

```typescript
// src/pages/api/admin/tricks/create.ts  — after refactor

import { Trick, TrickInvariantError } from "@/lib/domain/trick";
import { TrickRepository } from "@/lib/domain/trick-repository";
import { validateTrickInput } from "@/lib/validate-trick";

export const POST: APIRoute = async (context) => {
  // ... auth + admin checks unchanged ...

  const body = await context.request.json();
  const errors = validateTrickInput(body);
  if (Object.keys(errors).length > 0) {
    return new Response(JSON.stringify({ error: "Validation failed", errors }), { status: 400 });
  }

  let trick: Trick;
  try {
    trick = Trick.create({
      name: body.name.trim(),
      slug: body.slug.trim(),
      difficulty: body.difficulty.trim() as DifficultyLevel,
      description: body.description.trim(),
    });
  } catch (e) {
    if (e instanceof TrickInvariantError) {
      return new Response(JSON.stringify({ error: e.message }), { status: 422 });
    }
    throw e;
  }

  const repo = new TrickRepository(supabase);
  const { id } = await repo.create(trick);

  return new Response(JSON.stringify({ success: true, id }), { status: 201 });
};
```

**Error mapping**: `TrickInvariantError` → HTTP 422 Unprocessable Entity. The domain error halts the operation; no silent state change occurs.

---

### INV-02 Corollary Fix: Score Invariance Under Soft-Delete

INV-02 states the score never decays. Currently, when an admin soft-deletes a trick, `calculate-score.ts:26` JOINs `tricks` through an RLS filter (`deleted_at IS NULL`), which silently excludes the deleted trick's weight. The user's score drops with no user action.

**Fix**: preserve `difficulty_weight` at the `user_tricks` level for `status='finished'` rows, OR compute the score from a view that includes soft-deleted tricks' weights for historical entries.

**Recommended approach** (minimal scope, maintains on-demand calculation):

Create a DB view or function that computes score from `user_tricks` joined to `tricks` **without the soft-delete filter**:

```sql
-- New migration: score-preserving join ignores soft-delete for finished rows
CREATE OR REPLACE FUNCTION compute_progress_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(t.difficulty_weight), 0)::INTEGER
  FROM user_tricks ut
  JOIN tricks t ON t.id = ut.trick_id   -- no deleted_at filter here
  WHERE ut.user_id = p_user_id
    AND ut.status = 'finished';
$$;
```

`calculate-score.ts` calls `supabase.rpc('compute_progress_score', { p_user_id: userId })` instead of the scattered JOIN. This fix is a **separate migration and phase** from INV-01 (phased independently below).

---

## STEP 5 — Before / After, Plan, Tests

### Before / After by location

#### `src/pages/api/admin/tricks/create.ts`

| Before | After (Design A / DB-generated) |
|---|---|
| Lines 7–11: defines `DIFFICULTY_WEIGHT` constant | **Removed** — constant no longer needed |
| Line 93: `difficulty_weight: DIFFICULTY_WEIGHT[difficulty]` in INSERT payload | **Removed** — generated column; not in insert payload |
| `create.ts:89-96`: INSERT includes 5 explicit fields | INSERT includes 4 fields (no `difficulty_weight`) |

#### `src/pages/api/admin/tricks/update.ts`

| Before | After |
|---|---|
| Lines 7–11: `DIFFICULTY_WEIGHT` constant | **Removed** |
| Line 110: `difficulty_weight: DIFFICULTY_WEIGHT[difficulty]` in UPDATE payload | **Removed** |

#### `src/lib/database.types.ts`

| Before | After |
|---|---|
| `tricks.Insert.difficulty_weight: number` (line 99) | **Removed** — generated column not writable |
| `tricks.Update.difficulty_weight?: number` (line 109) | **Removed** |
| `tricks.Row.difficulty_weight: number` (line 89) | **Retained** — still readable |

#### `supabase/migrations/` (new file)

| Before | After |
|---|---|
| `difficulty_weight INTEGER NOT NULL CHECK (difficulty_weight IN (1, 2, 3))` | `difficulty_weight INTEGER GENERATED ALWAYS AS (CASE difficulty WHEN 'beginner' THEN 1 ... END) STORED` |

#### `src/lib/calculate-score.ts` (INV-02 corollary, Phase 2)

| Before | After |
|---|---|
| `supabase.from("user_tricks").select("tricks(difficulty_weight)").eq("user_id", ...).eq("status", "finished")` — soft-delete RLS silently drops deleted tricks | `supabase.rpc("compute_progress_score", { p_user_id: userId })` — DB function uses unfiltered JOIN |

---

### Refactor Phase Plan

#### Phase 1 — Seal INV-01 at the DB layer (test-first)

**Goal**: make `difficulty_weight` a computed column; remove application-level `DIFFICULTY_WEIGHT` constant.

1. **Write tests first** (see test cases below)
2. Write migration `20260618000001_make_difficulty_weight_generated.sql`
3. Run `supabase db push` locally and verify migration applies cleanly
4. Remove `difficulty_weight` from `create.ts` INSERT payload and `update.ts` UPDATE payload
5. Remove both `DIFFICULTY_WEIGHT` constants
6. Update `database.types.ts` Insert/Update types (remove `difficulty_weight`)
7. Run full test suite; confirm no type errors

**Test-first discipline**: Phase 1 is marked **test-first**. Tests must be written before the migration is applied.

#### Phase 2 — Seal INV-02: score invariance under soft-delete (test-first)

**Goal**: score never drops when admin soft-deletes a trick a user has marked "finished".

1. **Write tests first** (see test cases below)
2. Write migration `20260618000002_score_preserving_function.sql` (`compute_progress_score` DB function)
3. Update `src/lib/calculate-score.ts` to use `supabase.rpc('compute_progress_score', ...)`
4. Update `src/lib/calculate-score.test.ts` — mock now stubs `rpc`, not `.from(...).select(...)`
5. Verify score API (`/api/tricks/score`) returns correct value for user with a soft-deleted finished trick

**Test-first discipline**: Phase 2 is also **test-first**.

#### Phase 3 — Remove dead code

**Goal**: eliminate confusion around `recalculateScoresForTrick`.

1. Delete `src/lib/recalculate-user-scores.ts` (never imported; dead code)
2. Delete `src/lib/recalculate-user-scores.test.ts`
3. Remove comment at `update.ts:131` ("Wire recalculate… back in if score caching is added")

This is a **no-test phase** (deletion only; nothing new to specify).

---

### Test Cases for INV-01 (Phase 1 — test-first)

**Unit: `Trick` aggregate (Design B) / migration integrity**

| ID | Scenario | Input | Expected |
|---|---|---|---|
| T1-01 | beginner maps to weight 1 | `difficulty='beginner'` | `difficultyWeight === 1` |
| T1-02 | intermediate maps to weight 2 | `difficulty='intermediate'` | `difficultyWeight === 2` |
| T1-03 | advanced maps to weight 3 | `difficulty='advanced'` | `difficultyWeight === 3` |
| T1-04 | invalid difficulty throws | `difficulty='expert'` | throws `TrickInvariantError` |
| T1-05 | `toInsert()` never returns a weight that disagrees with difficulty | any valid difficulty | `toInsert().difficulty_weight === DIFFICULTY_WEIGHT[difficulty]` |

**Integration: DB generated column (Design A)**

| ID | Scenario | Input | Expected |
|---|---|---|---|
| T1-06 | INSERT without `difficulty_weight` succeeds | `{difficulty:'beginner'}` | Row inserted; `difficulty_weight=1` auto-set |
| T1-07 | INSERT with explicit `difficulty_weight` rejected | `{difficulty:'beginner', difficulty_weight:3}` | DB error: generated column |
| T1-08 | UPDATE `difficulty` propagates new weight | `UPDATE difficulty='advanced'` | `difficulty_weight` becomes 3 automatically |
| T1-09 | Direct SQL UPDATE on `difficulty_weight` fails | `UPDATE tricks SET difficulty_weight=3 WHERE difficulty='beginner'` | PostgreSQL error: cannot update generated column |

**Regression: score calculation uses correct weight after migration**

| ID | Scenario | Expected |
|---|---|---|
| T1-10 | User with 2 beginner + 1 advanced finished → score = 2×1 + 1×3 = 5 | score=5 |
| T1-11 | Admin changes trick from beginner→advanced; user's on-demand score recalculates to +2 | score increases by 2 |

---

### Test Cases for INV-02 (Phase 2 — test-first)

| ID | Scenario | Expected |
|---|---|---|
| T2-01 | User finishes a beginner trick; admin soft-deletes it; score is re-queried | score unchanged (still includes weight=1) |
| T2-02 | Admin restores soft-deleted trick; score re-queried | score unchanged (was already correct) |
| T2-03 | User finishes 3 tricks; admin deletes 1; user re-loads profile | score = sum of all 3, not 2 |
| T2-04 | `compute_progress_score(user_id)` called for user with zero finished tricks | returns 0 |
| T2-05 | `compute_progress_score(user_id)` called for non-existent user | returns 0 (COALESCE) |

---

### New Load-Bearing Names to Register

The project maintains `docs/reference/contract-surfaces.md` (scaffolded by `/10x-init`). The following names must be registered after each phase:

| Name | Type | Phase | Notes |
|---|---|---|---|
| `difficulty_weight` (generated column) | DB column | Phase 1 | Now computed; not in Insert/Update payloads — callers must not supply it |
| `TrickInvariantError` | TypeScript class | Phase 1 (Design B only) | Named domain error; maps to HTTP 422 in API routes |
| `Trick.create()` | TypeScript factory | Phase 1 (Design B only) | Only valid constructor; throws on invalid difficulty |
| `TrickRepository` | TypeScript class | Phase 1 (Design B only) | Single write path for trick rows |
| `compute_progress_score(p_user_id UUID)` | PostgreSQL function | Phase 2 | Replaces inline JOIN in `calculate-score.ts`; does not filter by `deleted_at` |

---

## Summary

The selected invariant is **INV-01**: `difficulty_weight` must always equal the numeric representation of `difficulty` (beginner=1, intermediate=2, advanced=3). This rule is the kernel of the weighted progress score—the product's core differentiating feature—yet it is enforced only by a duplicated runtime constant in two API route files, with no DB constraint preventing divergence via raw SQL or a future API change. The refactor plan has two phases: **Phase 1** replaces the plain `difficulty_weight` column with a PostgreSQL `GENERATED ALWAYS AS` computed column, making it physically impossible to store a mismatched weight and allowing the removal of the application-level `DIFFICULTY_WEIGHT` constant from `create.ts` and `update.ts`; **Phase 2** fixes the corollary INV-02 violation by introducing a `compute_progress_score` DB function that joins `tricks` without the soft-delete RLS filter, preventing admin soft-delete from silently reducing a user's score. Both phases are test-first, with eleven INV-01 test cases and five INV-02 test cases specified above. Phase 3 removes the dead `recalculateScoresForTrick` code. After these three phases the scoring rule is enforced at the lowest possible layer—the database—with zero application code capable of bypassing it.

---

*All file:line citations verified against the codebase as of 2026-06-18.*
