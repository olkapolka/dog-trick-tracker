---
title: "Dog Trick Tracker — Anti-Corruption Layer Plan"
created: 2026-06-18
type: refactor-plan
---

# Dog Trick Tracker — Anti-Corruption Layer Plan

---

## STEP 0 — Context Discovery

### Source Documents

| Document | Path | Relevant Declarations |
|---|---|---|
| PRD | `context/foundation/prd.md` | No explicit mention of Supabase as replaceable. Stack openness declared in tech-stack.md. |
| Tech Stack | `context/foundation/tech-stack.md` | Declares Supabase Auth + PostgreSQL as the chosen backend. Notes "can be replaced" is implicitly true for a bootstrapped starter — the selection is strategic, not forever. |
| README | `README.md` | "Must use external Supabase (cloud or self-hosted)" — explicitly acknowledges the Supabase constraint but as a deployment constraint, not a domain one. |
| Domain Distillation | `context/domain/01-domain-distillation.md` | States "Business logic is concentrated in `src/lib/`" and identifies `database.types.ts` as the type authority. |

### Stack Summary

| Layer | Location | Role |
|---|---|---|
| Framework | Astro v6 SSR | Routing, server-rendering, middleware |
| Interactive islands | React v19 | Client-side components |
| Auth + DB client | `@supabase/supabase-js` v2, `@supabase/ssr` v0.10 | Authentication and all data persistence |
| Data fetching (client) | `swr` v2 | Client-side cache + mutation for React islands |
| Notifications (client) | `sonner` v2 | Toast notification library |
| Generated types | `src/lib/database.types.ts` | Auto-generated Supabase schema types |

### External Dependencies — Complete Import Map

| Package | Files that import it |
|---|---|
| `@supabase/supabase-js` | `src/env.d.ts:3`, `src/lib/admin.ts:1`, `src/lib/calculate-score.ts:1`, `src/lib/recalculate-user-scores.ts:1` |
| `@supabase/ssr` | `src/lib/supabase.ts:1` |
| `swr` / `swr/mutation` | `src/components/catalog/TrainingPoints.tsx:1`, `src/components/catalog/StatusToggle.tsx:3-4`, `src/components/admin/AdminTrickList.tsx:2` |
| `sonner` | `src/components/ui/ToastProvider.tsx:1`, `src/components/catalog/StatusToggle.tsx:5`, `src/components/admin/AdminTrickList.tsx:3`, `src/components/admin/TrickFormModal.tsx:4`, `src/components/profile/FollowButton.tsx:2`, `src/components/profile/PhotoUpload.tsx:2`, `src/components/profile/ShareModal.tsx:5` |
| `@radix-ui/react-dialog` | `src/components/admin/TrickFormModal.tsx:2`, `src/components/profile/ShareModal.tsx:2` |
| `lucide-react` | 8 component files (UI icons only — pure rendering concern) |
| `qrcode.react` | `src/components/profile/ShareModal.tsx:3` |

---

## STEP 1 — Leaky Dependency Identification

### Leak A — `@supabase/supabase-js` `SupabaseClient<Database>` in domain function signatures

**What leaks**: The concrete `SupabaseClient<Database>` type from `@supabase/supabase-js` appears in the **parameter signatures** of three domain-layer functions. These functions live in `src/lib/` — declared to be the domain logic layer — but their public interface is permanently coupled to Supabase's client type.

**Files that "know" this type today**:

| File | Line(s) | How it knows |
|---|---|---|
| `src/lib/admin.ts` | 1, 16, 33 | `import type { SupabaseClient }` — used in both exported function signatures |
| `src/lib/calculate-score.ts` | 1, 21, 49 | `import type { SupabaseClient }` — used in both exported function signatures |
| `src/lib/recalculate-user-scores.ts` | 1, 10, 33, 47 | `import type { SupabaseClient }` — used in all three function signatures |
| `src/lib/supabase.ts` | 1 | Adapter file — legitimately knows the library |
| `src/env.d.ts` | 3 | `App.Locals.user` typed as `import("@supabase/supabase-js").User` — leaks Supabase's auth User type into the Astro framework global |

**Callers that pass a raw `SupabaseClient` into domain functions**:

| File | Line(s) | What it does |
|---|---|---|
| `src/pages/dashboard.astro` | 31 | Passes Supabase client directly to `calculateProgressScoreResult(supabase, user.id)` |
| `src/pages/api/tricks/score.ts` | 24 | `calculateProgressScore(supabase, user.id)` |
| `src/pages/api/admin/tricks/create.ts` | 51 | `isAdmin(user.id, supabase)` |
| `src/pages/api/admin/tricks/update.ts` | 54 | `isAdmin(user.id, supabase)` |
| `src/pages/api/admin/tricks/delete.ts` | 42 | `isAdmin(user.id, supabase)` |
| `src/pages/api/admin/tricks/list.ts` | 36 | `isAdmin(user.id, supabase)` |
| `src/pages/api/admin/tricks/restore.ts` | 42 | `isAdmin(user.id, supabase)` |
| `src/pages/api/admin/tricks/check-slug.ts` | 29 | Uses `supabase.auth.getUser()` directly (no domain function) |

### Leak B — `database.types.ts` (`Tables<>`, `Enums<>`) in UI components and wire contracts

**What leaks**: `Tables<"tricks">` (the full Supabase-generated row type, including internal columns like `created_at`, `deleted_at`, `difficulty_weight`) and `Enums<"trick_status">` flow directly from `src/lib/database.types.ts` into **UI components and API-layer route files**. This makes the UI aware of the persistence schema, not a domain shape.

**Files that import `database.types.ts` outside `src/lib/`**:

| File | Line(s) | What it imports |
|---|---|---|
| `src/components/catalog/StatusToggle.tsx` | 6, 11, 16, 31, 36, 52 | `Enums<"trick_status">` — used in prop types and internal state |
| `src/components/catalog/TrickCard.astro` | 2, 6, 7 | `Tables<"tricks">`, `Enums<"trick_status">` — prop types |
| `src/components/admin/AdminTrickList.tsx` | 4, 7 | `Tables<"tricks">` — `type Trick = Tables<"tricks">`, used throughout |
| `src/components/admin/TrickFormModal.tsx` | 8, 10, 15, 261 | `Enums<"difficulty_level">`, `Tables<"tricks">` — form value types, prop types |
| `src/components/profile/ProfileDisplay.astro` | 5, 7 | `Database["public"]["Tables"]["profiles"]["Row"]` — prop type |
| `src/pages/dashboard.astro` | 7, 47-48 | `Tables<"tricks">`, `Enums<"trick_status">` — inline `TrickWithStatus` type |
| `src/pages/tricks/[slug].astro` | 5, 21-22 | `Tables<"tricks">`, `Enums<"trick_status">` — inline `TrickWithStatus` type |
| `src/pages/api/admin/tricks/create.ts` | 5, 7, 85 | `Enums<"difficulty_level">` — typed DIFFICULTY_WEIGHT constant + cast |
| `src/pages/api/admin/tricks/update.ts` | 5, 7, 101 | `Enums<"difficulty_level">` — same pattern |
| `src/pages/api/tricks/status.ts` | 4, 10-11 | `Enums<"trick_status">` — type guard against DB enum |
| `src/lib/ownership-contracts.ts` | 1, 16, 41 | `Enums<"trick_status">` — in DTO builder signatures |

### Leak C — `swr` / `swr/mutation` wired directly to API route string literals in components

**What leaks**: SWR cache keys (`"/api/tricks/score"`, `"/api/admin/tricks/list"`) are hardcoded string literals in component files. `SCORE_KEY` is exported from one component and imported by another, creating a component-to-component coupling routed through an SWR cache key string. The data-fetching library and the API contract are known at the component level.

**Files that "know" SWR today**:

| File | Line(s) | What it does |
|---|---|---|
| `src/components/catalog/TrainingPoints.tsx` | 1, 3, 17, 22 | Owns `SCORE_KEY = "/api/tricks/score"`, exports it, uses `useSWR` |
| `src/components/catalog/StatusToggle.tsx` | 3-4, 7, 33-34 | Imports `SCORE_KEY` from sibling component; uses `useSWR` + `useSWRMutation` |
| `src/components/admin/AdminTrickList.tsx` | 2, 52 | Uses `useSWR` with inline `"/api/admin/tricks/list"` key |

---

## STEP 2 — Classification and Selection

### Axis assessment

| Leak | (a) Layers/files affected | (b) Cost to replace library today | (c) Documents declare replaceable? | Severity |
|---|---|---|---|---|
| **A** `SupabaseClient` in domain function signatures | **3 domain lib files** + **7+ API route callers** = 10+ files; the signatures of `isAdmin`, `calculateProgressScore`, `calculateProgressScoreResult` are permanently Supabase-typed | **HIGH** — every caller passes a raw `SupabaseClient`; replacing Supabase requires changing every domain function signature AND every call site | tech-stack.md: "battle-tested starter" — no explicit "will replace" but the starter pattern always leaves the door open; `env.d.ts:3` leaks Supabase's `User` type into Astro Locals, forcing every page/middleware to know it implicitly | **CRITICAL** |
| **B** `Tables<>` / `Enums<>` in UI and wire layer | **11 files** across components, pages, and API routes; the raw DB row shape (`created_at`, `deleted_at`, `difficulty_weight`) appears in UI prop types | **HIGH** — replacing Supabase requires changing every prop type in every component | tech-stack.md implies "Supabase for data" but column names shouldn't travel to the UI | **HIGH** |
| **C** `swr` in component files with hardcoded API keys | **3 component files**; mostly contained to the UI layer | **LOW** — swr is a UI-layer concern and can be swapped per-component; the real risk is the inter-component coupling via `SCORE_KEY` export | No interchangeability declaration | **MEDIUM** |

### Selection: **Leak A** — `SupabaseClient<Database>` embedded in domain function signatures

**Justification**: This is the worst leak for three compounding reasons:

1. **Layer boundary violated**: `src/lib/` is declared in the domain distillation (p. 01) as "domain logic concentrated in `src/lib/`." Three functions in this layer (`isAdmin`, `calculateProgressScoreResult`, `calculateProgressScore`) accept a `SupabaseClient<Database>` as a parameter, making the domain boundary definition contradictory — it is simultaneously "domain logic" and "Supabase adapter."

2. **Widest blast radius**: Replacing or mocking Supabase for testing requires callers to construct or fake a full `SupabaseClient` object. Every test for `isAdmin` or score calculation must import `@supabase/supabase-js` types. The test files in `src/lib/calculate-score.test.ts` and `src/lib/recalculate-user-scores.test.ts` already demonstrate the pain: they hand-build deeply nested mock objects (`{ from() { return { select() { return { eq() { ... } } } } } }`) that exactly mirror the Supabase query builder chain — the domain tests are testing Supabase's fluent API, not the domain logic.

3. **`App.Locals.user` typed as Supabase's `User`**: `src/env.d.ts:3` declares `user: import("@supabase/supabase-js").User | null`. Every page, middleware, and API route that reads `context.locals.user` or `Astro.locals.user` implicitly depends on Supabase's auth user shape. Switching auth providers requires touching every file that touches `locals.user`.

**Leak B** (database types in UI) is a consequence of Leak A: once the domain functions are decoupled from the persistence library, it becomes natural to define domain types that the UI uses instead of raw `Tables<>` shapes. The ACL design below addresses both A and B together through a single domain interface + adapter pattern.

---

## STEP 3 — Diagnosis

### 3.1 Domain functions with Supabase in their public signatures

```typescript
// src/lib/admin.ts:1 — Supabase library type imported at domain layer
import type { SupabaseClient } from "@supabase/supabase-js";

// src/lib/admin.ts:14-17 — library type bleeds into exported function signature
export async function getAdminCheckResult(
  userId: string,
  supabase: SupabaseClient<Database>,   // ← Supabase in domain signature
): Promise<AdminCheckResult> {

// src/lib/admin.ts:33 — same leak in convenience wrapper
export async function isAdmin(userId: string, supabase: SupabaseClient<Database>): Promise<boolean> {
```

```typescript
// src/lib/calculate-score.ts:1 — library type imported at domain layer
import type { SupabaseClient } from "@supabase/supabase-js";

// src/lib/calculate-score.ts:20-23 — Supabase in domain signature
export async function calculateProgressScoreResult(
  supabase: SupabaseClient<Database>,   // ← Supabase in domain signature
  userId: string,
): Promise<ProgressScoreResult> {

// src/lib/calculate-score.ts:49 — same leak
export async function calculateProgressScore(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
```

```typescript
// src/lib/recalculate-user-scores.ts:1 — library type imported at domain layer
import type { SupabaseClient } from "@supabase/supabase-js";

// src/lib/recalculate-user-scores.ts:10 — private function leaks too (signals design intent)
async function listAffectedUserIds(trickId: string, supabase: SupabaseClient<Database>): Promise<string[]>

// src/lib/recalculate-user-scores.ts:31-34, 47
export async function getRecalculatedScoresForTrick(
  trickId: string,
  supabase: SupabaseClient<Database>,   // ← Supabase in domain signature
)
export async function recalculateScoresForTrick(trickId: string, supabase: SupabaseClient<Database>): Promise<void>
```

### 3.2 Supabase `User` type in framework global (`App.Locals`)

```typescript
// src/env.d.ts:1-5 — Supabase auth User type embedded in Astro framework globals
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;   // ← lib type in global contract
  }
}
```

Every route/middleware that reads `context.locals.user` or `Astro.locals.user` implicitly depends on the full Supabase `User` shape (including `app_metadata`, `user_metadata`, `identities`, `factors`, etc.) when it only needs `{ id: string }`. Files affected by this implicit leak:

`src/middleware.ts` (reads `context.locals.user`), `src/pages/dashboard.astro`, `src/pages/profile.astro`, `src/pages/friends.astro`, `src/pages/profile/create.astro`, `src/pages/admin/tricks.astro`, `src/pages/user/[username].astro`, `src/pages/tricks/[slug].astro`, every `src/pages/api/**/*.ts`.

### 3.3 DB row types (`Tables<>`, `Enums<>`) reaching UI prop types

```typescript
// src/components/admin/AdminTrickList.tsx:4,7 — persistence schema in UI component
import type { Tables } from "@/lib/database.types";
type Trick = Tables<"tricks">;   // ← Full DB row: id, name, slug, difficulty,
                                  //   difficulty_weight, description, created_at, deleted_at
```

```typescript
// src/components/catalog/StatusToggle.tsx:6,11 — DB enum in UI prop contract
import type { Enums } from "@/lib/database.types";
interface Props {
  initialStatus: Enums<"trick_status"> | null;   // ← DB enum in component contract
}
```

```typescript
// src/components/profile/ProfileDisplay.astro:5,7 — raw DB table path in UI
import type { Database } from "@/lib/database.types";
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];   // ← full persistence path
```

### 3.4 Duplicate `TrickWithStatus` inline type across two pages

```typescript
// src/pages/dashboard.astro:47-49 — inline type constructed from DB types
type TrickWithStatus = Tables<"tricks"> & {
  user_tricks?: { status: Enums<"trick_status"> }[];
};

// src/pages/tricks/[slug].astro:21-23 — identical inline type, second file
type TrickWithStatus = Tables<"tricks"> & {
  user_tricks?: { status: Enums<"trick_status"> }[];
};
```

The same persistence-coupled type is reconstructed in two page files with no shared definition.

### 3.5 Test files mirror Supabase's fluent query builder (domain tests test infrastructure)

```typescript
// src/lib/calculate-score.test.ts:6-26 — mock must replicate Supabase chain exactly
const supabase = {
  from() {
    return {
      select() {
        return {
          eq() {
            return {
              eq() {
                return Promise.resolve({ data: null, error: { message: "db down" } });
              },
            };
          },
        };
      },
    };
  },
};
```

This 20-line nested mock object exists solely because `calculateProgressScoreResult` accepts `SupabaseClient<Database>` — the domain test cannot run without replicating the entire Supabase query builder chain. The domain logic (`sum difficulty_weight for finished tricks`) is buried inside infrastructure knowledge.

---

## STEP 4 — ACL Design

### Concept: narrow domain ports, single adapter

The fix is a classic **port + adapter** pattern. Two ports are needed:

1. **`ScoreRepository`** — query port for progress score calculation
2. **`AdminRepository`** — query port for admin role check
3. **`AuthenticatedUser`** — a minimal domain value replacing `supabase-js User`

The adapter (Supabase implementation) lives in `src/lib/supabase/` and is the **only** place `@supabase/supabase-js` is imported outside `src/lib/supabase.ts`.

---

### 4.1 Domain value: `AuthenticatedUser`

```typescript
// src/lib/domain/authenticated-user.ts

/**
 * Domain value representing a verified, authenticated session principal.
 * All layers use this type — no Supabase User type escapes lib/supabase/.
 */
export interface AuthenticatedUser {
  readonly id: string;     // auth.users.id — used for all ownership checks
  readonly email: string;  // used for display only; never used in domain rules
}
```

**Replaces**: `import("@supabase/supabase-js").User` in `src/env.d.ts:3`.

**After**: `App.Locals.user` becomes `AuthenticatedUser | null`. No file outside `src/lib/supabase/` ever imports from `@supabase/supabase-js` for the user type.

---

### 4.2 Port: `ScoreRepository`

```typescript
// src/lib/domain/ports/score-repository.ts

export interface ScoreRepository {
  /**
   * Returns the weighted progress score for a user.
   * Sum of difficulty_weight for all finished user_tricks rows.
   * Returns 0 on any error — callers must use ScoreRepositoryResult for error distinction.
   */
  getProgressScore(userId: string): Promise<number>;

  getProgressScoreResult(userId: string): Promise<ScoreRepositoryResult>;
}

export type ScoreRepositoryResult =
  | { ok: true; score: number }
  | { ok: false; error: string };
```

**Domain operations declared**: the port knows nothing about Supabase, SQL, or join strategy. It only declares the operation (`getProgressScore`) and the result shape. The implementation decides how to query.

**Error contract**: returns a typed Result — never throws, never logs-and-continues. Callers receive `ok: false` and handle it at the API/page boundary.

---

### 4.3 Port: `AdminRepository`

```typescript
// src/lib/domain/ports/admin-repository.ts

export interface AdminRepository {
  /**
   * Returns true iff the given user holds the admin role.
   * Implementation may check any backing store; domain code does not know which.
   */
  isAdmin(userId: string): Promise<boolean>;

  isAdminResult(userId: string): Promise<AdminCheckResult>;
}

export type AdminCheckResult =
  | { ok: true; isAdmin: boolean }
  | { ok: false; error: string };
```

---

### 4.4 Supabase adapters (the ONLY files that import `@supabase/supabase-js`)

```typescript
// src/lib/supabase/score-repository-supabase.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ScoreRepository, ScoreRepositoryResult } from "@/lib/domain/ports/score-repository";

export class SupabaseScoreRepository implements ScoreRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getProgressScoreResult(userId: string): Promise<ScoreRepositoryResult> {
    const { data, error } = await this.client
      .from("user_tricks")
      .select("tricks(difficulty_weight)")
      .eq("user_id", userId)
      .eq("status", "finished");

    if (error) return { ok: false, error: error.message };

    const score = (data ?? []).reduce((sum, row) => {
      const weight = (row as { tricks: { difficulty_weight: number } | null }).tricks?.difficulty_weight;
      return sum + (typeof weight === "number" ? weight : 0);
    }, 0);

    return { ok: true, score };
  }

  async getProgressScore(userId: string): Promise<number> {
    const result = await this.getProgressScoreResult(userId);
    return result.ok ? result.score : 0;
  }
}
```

```typescript
// src/lib/supabase/admin-repository-supabase.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AdminRepository, AdminCheckResult } from "@/lib/domain/ports/admin-repository";

export class SupabaseAdminRepository implements AdminRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async isAdminResult(userId: string): Promise<AdminCheckResult> {
    const { data, error } = await this.client
      .from("profiles")
      .select("is_admin")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    return { ok: true, isAdmin: data?.is_admin === true };
  }

  async isAdmin(userId: string): Promise<boolean> {
    const result = await this.isAdminResult(userId);
    return result.ok && result.isAdmin;
  }
}
```

---

### 4.5 Domain functions rewritten to accept ports (not the library)

```typescript
// src/lib/domain/score.ts  (replaces src/lib/calculate-score.ts)

import type { ScoreRepository, ScoreRepositoryResult } from "./ports/score-repository";

// Domain logic: take the port, call one method, return typed result.
// No Supabase import. No query builder. Testable with any ScoreRepository mock.

export async function calculateProgressScoreResult(
  repo: ScoreRepository,
  userId: string,
): Promise<ScoreRepositoryResult> {
  return repo.getProgressScoreResult(userId);
}

export async function calculateProgressScore(repo: ScoreRepository, userId: string): Promise<number> {
  return repo.getProgressScore(userId);
}
```

```typescript
// src/lib/domain/admin.ts  (replaces src/lib/admin.ts)

import type { AdminRepository, AdminCheckResult } from "./ports/admin-repository";

export async function getAdminCheckResult(
  userId: string,
  repo: AdminRepository,
): Promise<AdminCheckResult> {
  return repo.isAdminResult(userId);
}

export async function isAdmin(userId: string, repo: AdminRepository): Promise<boolean> {
  return repo.isAdmin(userId);
}
```

---

### 4.6 Domain types: replacing `Tables<>` and `Enums<>` in UI contracts

```typescript
// src/lib/domain/types.ts

/**
 * Domain-facing types for the UI and API layer.
 * These are stable shapes the UI can depend on — not raw DB row types.
 * Persistence concerns (created_at, deleted_at, difficulty_weight) are stripped.
 */

export type TrickStatus = "favorite" | "in-progress" | "finished";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export interface CatalogTrick {
  id: string;
  name: string;
  slug: string;
  difficulty: DifficultyLevel;
  description: string;
  isDeleted: boolean;           // mapped from deleted_at !== null
  userStatus: TrickStatus | null;
}

export interface AdminTrick {
  id: string;
  name: string;
  slug: string;
  difficulty: DifficultyLevel;
  difficultyWeight: number;     // readable by admin UI, not the scoring kernel
  description: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  loginName: string;
  dogName: string;
  breed: string;
  sex: "Male" | "Female";
  photoUrl: string | null;
  dateOfBirth: string;
}
```

**Mapping location**: The conversion from `Tables<"tricks">` → `CatalogTrick` happens in the API route handler or page server code — NOT in the component. The component receives `CatalogTrick`, not the raw DB row.

---

### 4.7 ACL factory: constructing adapters at the request boundary

```typescript
// src/lib/supabase/repository-factory.ts

import { createClient } from "@/lib/supabase";   // still the only place @supabase/ssr is used
import { SupabaseScoreRepository } from "./score-repository-supabase";
import { SupabaseAdminRepository } from "./admin-repository-supabase";
import type { ScoreRepository } from "@/lib/domain/ports/score-repository";
import type { AdminRepository } from "@/lib/domain/ports/admin-repository";

export interface Repositories {
  score: ScoreRepository;
  admin: AdminRepository;
}

export function createRepositories(requestHeaders: Headers, cookies: AstroCookies): Repositories | null {
  const client = createClient(requestHeaders, cookies);
  if (!client) return null;

  return {
    score: new SupabaseScoreRepository(client),
    admin: new SupabaseAdminRepository(client),
  };
}
```

**API route pattern after ACL**:

```typescript
// src/pages/api/tricks/score.ts — thin API handler (pseudocode, not production code)

import { createRepositories } from "@/lib/supabase/repository-factory";
import { calculateProgressScore } from "@/lib/domain/score";

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;          // AuthenticatedUser | null
  if (!user) return unauthorized();

  const repos = createRepositories(context.request.headers, context.cookies);
  if (!repos) return serverError();

  // Domain call: no Supabase type visible here
  const score = await calculateProgressScore(repos.score, user.id);
  return ok({ score });
};
```

**Admin route pattern after ACL**:

```typescript
// src/pages/api/admin/tricks/create.ts — thin API handler (pseudocode)

import { createRepositories } from "@/lib/supabase/repository-factory";
import { isAdmin } from "@/lib/domain/admin";

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) return unauthorized();

  const repos = createRepositories(context.request.headers, context.cookies);
  if (!repos) return serverError();

  // Domain call: no SupabaseClient passed, no Supabase type visible
  if (!(await isAdmin(user.id, repos.admin))) return forbidden();

  // ... rest of handler unchanged ...
};
```

---

## STEP 5 — Proof of Isolation + Before/After

### 5.1 Library interchange proof: what changes if Supabase is replaced

| Scope | Files changed | Files NOT changed |
|---|---|---|
| **Adapter files** | `src/lib/supabase/score-repository-supabase.ts`, `src/lib/supabase/admin-repository-supabase.ts`, `src/lib/supabase.ts`, `src/lib/supabase/repository-factory.ts` | — |
| **Domain logic** | Not changed — ports are interfaces, not Supabase types | `src/lib/domain/score.ts`, `src/lib/domain/admin.ts` |
| **API routes** | Not changed — call `createRepositories()` which returns port interfaces | All `src/pages/api/**` files |
| **UI components** | Not changed — receive domain types, not DB rows | All `src/components/**` files |
| **Pages** | Not changed — call `createRepositories()` + domain functions | All `src/pages/**` files |
| **Tests** | Not changed — mock the port interface, not `SupabaseClient` | `src/lib/**/*.test.ts` |

**One change in the adapter directory = zero changes everywhere else.** This is the isolation guarantee.

---

### 5.2 Before/After for each leaky location

#### `src/lib/admin.ts`

| Before | After |
|---|---|
| `import type { SupabaseClient } from "@supabase/supabase-js"` at line 1 | **Removed** — no Supabase import in domain file |
| `isAdmin(userId: string, supabase: SupabaseClient<Database>)` | `isAdmin(userId: string, repo: AdminRepository)` |
| `getAdminCheckResult(userId: string, supabase: SupabaseClient<Database>)` | `getAdminCheckResult(userId: string, repo: AdminRepository)` |
| File lives in `src/lib/` | File moves to `src/lib/domain/admin.ts` |

#### `src/lib/calculate-score.ts`

| Before | After |
|---|---|
| `import type { SupabaseClient } from "@supabase/supabase-js"` at line 1 | **Removed** |
| `calculateProgressScoreResult(supabase: SupabaseClient<Database>, userId: string)` | `calculateProgressScoreResult(repo: ScoreRepository, userId: string)` |
| `calculateProgressScore(supabase: SupabaseClient<Database>, userId: string)` | `calculateProgressScore(repo: ScoreRepository, userId: string)` |
| Supabase query builder chain embedded in function body | **Moved** to `SupabaseScoreRepository.getProgressScoreResult()` |

#### `src/env.d.ts`

| Before | After |
|---|---|
| `user: import("@supabase/supabase-js").User \| null` | `user: import("@/lib/domain/authenticated-user").AuthenticatedUser \| null` |

#### `src/components/admin/AdminTrickList.tsx` (representative UI before/after)

| Before | After |
|---|---|
| `import type { Tables } from "@/lib/database.types"` | **Removed** |
| `type Trick = Tables<"tricks">` — full DB row including `deleted_at`, `difficulty_weight`, `created_at` | `import type { AdminTrick } from "@/lib/domain/types"` |
| Component prop: `initialTricks: Trick[]` | Component prop: `initialTricks: AdminTrick[]` |
| `const isDeleted = trick.deleted_at !== null` | `const isDeleted = trick.isDeleted` — mapping done in API route |
| API response `ListResponse.tricks: Trick[]` (raw DB row) | API response `{ tricks: AdminTrick[] }` (domain shape) |

#### `src/components/catalog/StatusToggle.tsx`

| Before | After |
|---|---|
| `import type { Enums } from "@/lib/database.types"` | `import type { TrickStatus } from "@/lib/domain/types"` |
| `Enums<"trick_status">` in 5 places | `TrickStatus` in 5 places |

#### `src/pages/dashboard.astro` and `src/pages/tricks/[slug].astro`

| Before | After |
|---|---|
| Inline `type TrickWithStatus = Tables<"tricks"> & { user_tricks?: ... }[]` (duplicated in both files) | Removed — both pages receive `CatalogTrick[]` from a single mapping helper |
| `import type { Tables, Enums } from "@/lib/database.types"` in both files | `import type { CatalogTrick } from "@/lib/domain/types"` |

---

### 5.3 UI receives domain data, not raw library objects

The mapping from raw Supabase query result to domain type happens **at the page server code boundary**, before data is passed to components:

```typescript
// Mapping pseudocode — lives in page server code or a dedicated mapper module
// NOT in the component

function toAdminTrick(row: Tables<"tricks">): AdminTrick {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    difficulty: row.difficulty,
    difficultyWeight: row.difficulty_weight,
    description: row.description,
    isDeleted: row.deleted_at !== null,
    createdAt: row.created_at ?? "",
  };
}
```

The component `AdminTrickList` receives `AdminTrick[]` — it never calls `.deleted_at`, never casts `difficulty_level` enums, never knows `difficulty_weight` exists.

---

### 5.4 Open questions resolved at the ACL layer

**Q: Does `AuthenticatedUser` need the full Supabase `User.user_metadata` for display?**
Resolution: No. The middleware only uses `user.id` for ownership checks and profile lookups. The email field can be populated from Supabase's `user.email` at the adapter boundary, but even that is not used in any domain rule. The mapping in `middleware.ts` extracts only `{ id, email }` from the Supabase User object — this decision is coded in the middleware's adapter call, not scattered across API routes.

**Q: Does the `TrickStatus` domain type need to match the DB enum string values exactly?**
Resolution: Yes — they are the values sent over the API wire (`POST /api/tricks/status` body `{ status: "finished" }`). The ACL does not remap them; `TrickStatus = "favorite" | "in-progress" | "finished"` is an exact string alias. Changing the DB enum would require a migration AND an ACL update — both in one place.

---

## STEP 6 — Verify and Plan

### 6.1 Success Criteria

**After refactoring**: `grep -r "@supabase/supabase-js" src/` returns **only** files inside `src/lib/supabase/` and `src/lib/database.types.ts` (generated file, cannot move).

**Current state** (files that import `@supabase/supabase-js`):

| File | Status after refactor |
|---|---|
| `src/env.d.ts` | Changed — uses `AuthenticatedUser` instead |
| `src/lib/admin.ts` | Deleted — replaced by `src/lib/domain/admin.ts` (no Supabase import) |
| `src/lib/calculate-score.ts` | Deleted — replaced by `src/lib/domain/score.ts` (no Supabase import) |
| `src/lib/recalculate-user-scores.ts` | Already deleted per plan 02 |
| `src/lib/supabase.ts` | Retained — legitimate adapter file |
| `src/lib/database.types.ts` | Retained — generated, read-only; only imported inside `src/lib/supabase/` after refactor |

**After refactoring**: `grep -r "database\.types" src/` returns only files inside `src/lib/supabase/` plus the file itself.

**Current files importing `database.types.ts` that will no longer do so after refactor**:

| File | Imports removed |
|---|---|
| `src/components/catalog/StatusToggle.tsx` | `Enums<"trick_status">` → `TrickStatus` |
| `src/components/catalog/TrickCard.astro` | `Tables<"tricks">`, `Enums<"trick_status">` → `CatalogTrick` |
| `src/components/admin/AdminTrickList.tsx` | `Tables<"tricks">` → `AdminTrick` |
| `src/components/admin/TrickFormModal.tsx` | `Enums<"difficulty_level">`, `Tables<"tricks">` → `DifficultyLevel`, `AdminTrick` |
| `src/components/profile/ProfileDisplay.astro` | `Database["public"]["Tables"]["profiles"]["Row"]` → `UserProfile` |
| `src/pages/dashboard.astro` | `Tables<"tricks">`, `Enums<"trick_status">` → `CatalogTrick` |
| `src/pages/tricks/[slug].astro` | `Tables<"tricks">`, `Enums<"trick_status">` → `CatalogTrick` |
| `src/pages/api/admin/tricks/create.ts` | `Enums<"difficulty_level">` → `DifficultyLevel` |
| `src/pages/api/admin/tricks/update.ts` | `Enums<"difficulty_level">` → `DifficultyLevel` |
| `src/pages/api/tricks/status.ts` | `Enums<"trick_status">` → `TrickStatus` |
| `src/lib/ownership-contracts.ts` | `Enums<"trick_status">` → `TrickStatus` |

---

### 6.2 Phase Plan

#### Phase 1 — Define domain types and ports (no production behavior change)

**Goal**: Create the skeleton — ports and domain value types — without changing any existing code. Pure additions.

1. Create `src/lib/domain/authenticated-user.ts` — `AuthenticatedUser` interface
2. Create `src/lib/domain/types.ts` — `TrickStatus`, `DifficultyLevel`, `CatalogTrick`, `AdminTrick`, `UserProfile`
3. Create `src/lib/domain/ports/score-repository.ts` — `ScoreRepository` port + `ScoreRepositoryResult`
4. Create `src/lib/domain/ports/admin-repository.ts` — `AdminRepository` port + `AdminCheckResult`

No existing files are changed. No tests required (pure type declarations).

#### Phase 2 — Write Supabase adapters (test-first)

**Goal**: Implement the adapters that satisfy the ports, verified against the real Supabase behavior.

1. Create `src/lib/supabase/score-repository-supabase.ts` implementing `ScoreRepository`
2. Create `src/lib/supabase/admin-repository-supabase.ts` implementing `AdminRepository`
3. Create `src/lib/supabase/repository-factory.ts` — `createRepositories()` factory

**Test-first**: Write unit tests for each adapter using the port interface as the mock target. The new domain functions (`src/lib/domain/score.ts`, `src/lib/domain/admin.ts`) have trivially simple tests — mock implements `ScoreRepository`, pass it to `calculateProgressScore`, assert return value. No Supabase query chain to replicate.

#### Phase 3 — Migrate domain functions to ports

**Goal**: Rewrite `admin.ts` and `calculate-score.ts` to use ports; move to `src/lib/domain/`.

1. Create `src/lib/domain/score.ts` — functions accept `ScoreRepository`, not `SupabaseClient`
2. Create `src/lib/domain/admin.ts` — functions accept `AdminRepository`, not `SupabaseClient`
3. Update all callers (`src/pages/api/**`, `src/pages/*.astro`) to:
   - Call `createRepositories()` once per request
   - Pass `repos.score` / `repos.admin` to domain functions
4. Delete old `src/lib/admin.ts` and `src/lib/calculate-score.ts`
5. Update `src/lib/calculate-score.test.ts` — mock now stubs `ScoreRepository`, not a Supabase client chain

#### Phase 4 — Replace `database.types` in UI layer with domain types

**Goal**: Components and pages receive domain types; `database.types.ts` imports confined to `src/lib/supabase/`.

1. Update `src/components/catalog/StatusToggle.tsx` — `TrickStatus` replaces `Enums<"trick_status">`
2. Update `src/components/catalog/TrickCard.astro` — `CatalogTrick` replaces `Tables<"tricks"> + Enums<...>`
3. Update `src/components/admin/AdminTrickList.tsx` — `AdminTrick` replaces `Tables<"tricks">`
4. Update `src/components/admin/TrickFormModal.tsx` — `DifficultyLevel`, `AdminTrick` replace DB types
5. Update `src/components/profile/ProfileDisplay.astro` — `UserProfile` replaces `Database[...]["Row"]`
6. Update pages (`dashboard.astro`, `tricks/[slug].astro`) — remove inline `TrickWithStatus`, use `CatalogTrick`
7. Add mapping helpers (e.g., `toAdminTrick`, `toCatalogTrick`) at the page/API boundary
8. Update `src/lib/ownership-contracts.ts` — `TrickStatus` replaces `Enums<"trick_status">`

#### Phase 5 — Seal `App.Locals.user`

**Goal**: Remove Supabase's `User` type from the framework global.

1. Update `src/env.d.ts:3` — `AuthenticatedUser | null` replaces `import("@supabase/supabase-js").User | null`
2. Update `src/middleware.ts` — middleware extracts `{ id, email }` from Supabase `User` and stores as `AuthenticatedUser`
3. Run `grep -r "@supabase/supabase-js" src/` — confirm only `src/lib/supabase/` files remain

#### Phase 6 — Verify isolation

1. Run `grep -r "@supabase/supabase-js" src/` — only `src/lib/supabase/` and `src/lib/database.types.ts`
2. Run `grep -r "database\.types" src/` — only `src/lib/supabase/`
3. Run full test suite (`npm run test:unit`, `npm run test:integration`)
4. Run `npm run typecheck` — zero type errors

---

### New Load-Bearing Names to Register in `docs/reference/contract-surfaces.md`

| Name | Type | Phase | Notes |
|---|---|---|---|
| `AuthenticatedUser` | TypeScript interface | Phase 1 | Domain user principal; replaces `supabase-js User` in `App.Locals` |
| `TrickStatus` | TypeScript union type | Phase 1 | Domain enum replacing `Enums<"trick_status">` |
| `DifficultyLevel` | TypeScript union type | Phase 1 | Domain enum replacing `Enums<"difficulty_level">` |
| `CatalogTrick` | TypeScript interface | Phase 1 | Domain shape for catalog display; excludes persistence columns |
| `AdminTrick` | TypeScript interface | Phase 1 | Domain shape for admin CRUD; includes `isDeleted`, `difficultyWeight` |
| `UserProfile` | TypeScript interface | Phase 1 | Domain shape for profile display |
| `ScoreRepository` | TypeScript interface (port) | Phase 1 | The only interface domain score functions accept |
| `AdminRepository` | TypeScript interface (port) | Phase 1 | The only interface domain admin functions accept |
| `SupabaseScoreRepository` | TypeScript class (adapter) | Phase 2 | Supabase implementation of `ScoreRepository`; lives in `src/lib/supabase/` |
| `SupabaseAdminRepository` | TypeScript class (adapter) | Phase 2 | Supabase implementation of `AdminRepository`; lives in `src/lib/supabase/` |
| `createRepositories()` | Function | Phase 2 | Single factory for all repository adapters per request; called at the route/page boundary |

---

## Summary

The dominant leaky dependency is `@supabase/supabase-js`'s `SupabaseClient<Database>` type embedded in the public signatures of three domain-layer functions (`isAdmin`, `calculateProgressScoreResult`, `calculateProgressScore`) in `src/lib/`, making those functions' contracts permanently coupled to the persistence library rather than to domain intent. A secondary, consequential leak is that the Supabase-generated `database.types.ts` types (`Tables<"tricks">`, `Enums<"trick_status">`, `Database["public"]["Tables"]["profiles"]["Row"]`) flow directly into 11 UI component and page files, so the full DB row schema — including implementation columns like `deleted_at`, `difficulty_weight`, `created_at` — is a live dependency of every component that renders a trick or profile. The fix is a classic port + adapter split: two narrow domain ports (`ScoreRepository`, `AdminRepository`) replace the `SupabaseClient` parameter in domain functions, while three domain value types (`CatalogTrick`, `AdminTrick`, `UserProfile`) replace raw `Tables<>` shapes in component props — with all Supabase knowledge confined to a single `src/lib/supabase/` adapter directory. The secondary Leak C (SWR wired directly in components with hardcoded API key strings) is contained to three files in the UI layer and does not cross a layer boundary, making it a low-priority cleanup deferred to after the primary isolation is complete. A six-phase plan — types → adapters → migrate domain functions → migrate UI types → seal `App.Locals` → verify — delivers full isolation, and the success condition is verifiable with a single grep: `grep -r "@supabase/supabase-js" src/` returns only files inside `src/lib/supabase/`.

---

*All file:line citations verified against the codebase as of 2026-06-18.*
