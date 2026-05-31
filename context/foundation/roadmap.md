---
project: Dog Trick Tracker
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-31
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Dog Trick Tracker

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Dog owners training at home have no systematic way to track which tricks they're working on and how their dog is progressing. This product offers a focused, curated trick catalog with progress tracking that calculates a weighted score based on trick difficulty — proving that domain-specific tracking beats generic habit apps.

## North star

**S-01: User can track their first trick** — the smallest end-to-end flow that proves the core product hypothesis (systematic tracking with weighted progress score). This slice validates the primary Success Criterion: users can actually track tricks and see meaningful progress. Sequenced as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | database-schema | (foundation) Schema and migrations in place — users, profiles, dogs, tricks, user_tricks, difficulty levels | — | Access Control, Business Logic, FR-003 | ready |
| F-02 | seed-trick-catalog | (foundation) Starter trick catalog seeded — 10-15 tricks across 3 difficulty levels | F-01 | Vision, Business Logic, Success Criteria guardrail | proposed |
| S-01 | first-trick-tracking | Create profile with dog info, browse trick catalog with detail pages, mark trick status, see weighted progress score | F-01, F-02 | US-01, FR-001-012, Business Logic, Success Criteria (primary) | done |
| S-02 | shareable-profile-link | Share profile via copy link, QR code, or email (enhances existing copy button with modal UI) | S-01 | FR-005 (already met; this adds enhancements) | done |
| S-03 | public-profile-view | Visit another user's profile via shared link and see their dog info and trick progress | S-02 | FR-013, FR-017, Success Criteria (primary) | proposed |
| S-04 | follow-relationships | Follow users, view list of followed profiles in Friends tab, view list of followers in Friends tab | S-03 | FR-014, FR-015, FR-016, Access Control | proposed |
| S-05 | admin-trick-crud | (admin) Add, edit, and remove tricks from catalog | F-01, F-02 | FR-018, FR-019, FR-020, Access Control | blocked |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | User tracking & social | F-01 → F-02 → S-01 → S-02 → S-03 → S-04 | North star (S-01) sequenced first per speed goal; social features follow dependency order |
| B | Catalog curation | F-01 → F-02 → S-05 | Parallel with Stream A after F-02; blocked on admin role assignment unknown (see Open Questions) |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro v6 + React v19, file-based routing, Tailwind CSS v4, reusable components (src/components/ui/button.tsx, auth forms)
- **Backend / API:** present — Astro APIRoute handlers in src/pages/api/auth/ (signin, signup, signout), auth middleware in src/middleware.ts
- **Data:** partial — Supabase client configured (src/lib/supabase.ts), but no schema files, migration directory, or seed data
- **Auth:** present — Supabase integration, session verification in middleware, PROTECTED_ROUTES guard for /dashboard, sign-in/sign-up UI components
- **Deploy / infra:** present — Cloudflare Workers adapter (astro.config.mjs), wrangler.jsonc, GitHub Actions CI/CD (.github/workflows/ci.yml, deploy.yml)
- **Observability:** absent — No logging library, error tracking, or metrics configured

## Foundations

### F-01: Database schema and migrations

- **Outcome:** (foundation) Schema and migrations landed — users table, profiles table (with dog info: name, breed, date of birth, sex, optional photo), tricks table (with difficulty level: beginner/intermediate/advanced, step-by-step teaching description), user_tricks junction table (with status: favorite/in-progress/finished), difficulty levels defined
- **Change ID:** database-schema
- **PRD refs:** Access Control (3 roles: Admin, Regular user), Business Logic (weighted scoring by difficulty), FR-003 (profile structure with unique login name and dog info)
- **Unlocks:** S-01, S-02, S-03, S-04, S-05 (every user-facing slice and admin slice requires this schema)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Should breed be a fixed dropdown enum or user-submitted text? Owner: user. Block: no (PRD FR-003 says "breed from dropdown", so fixed enum wins; can expand list post-launch if needed).
- **Risk:** Schema design is load-bearing — mistakes here cascade to all slices. But PRD is specific (weighted scoring, 3 difficulty levels, user_tricks junction with status), so core shape is clear. Invest time here per "invest deeply in data" framing.
- **Status:** ready

### F-02: Seed starter trick catalog

- **Outcome:** (foundation) Initial trick catalog populated — 10-15 tricks across beginner/intermediate/advanced difficulty levels, each with step-by-step teaching description
- **Change ID:** seed-trick-catalog
- **PRD refs:** Vision ("10-15 starter tricks"), Business Logic (3 static difficulty sections), Success Criteria guardrail (catalog loads all starter tricks without delay)
- **Unlocks:** S-01 (users can't track tricks without tricks in the catalog)
- **Prerequisites:** F-01 (schema must exist to seed data)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which specific 10-15 tricks to include? Owner: user/admin. Block: no (any common tricks work for MVP validation — "sit", "stay", "shake", "rollover", etc.; can refine post-launch based on user feedback).
- **Risk:** Seed data quality affects first impression, but it's easy to update via SQL or admin UI (S-05) post-launch. Low risk.
- **Status:** proposed

## Slices

### S-01: User can track their first trick

- **Outcome:** User can create profile with dog info (unique login name, dog name, breed from dropdown, date of birth, sex, optional photo), browse trick catalog as flat list, view trick detail pages with step-by-step teaching descriptions, mark trick status (favorite/in-progress/finished) from catalog or detail page, and see weighted progress score on profile
- **Change ID:** first-trick-tracking
- **PRD refs:** US-01, FR-001 (register), FR-002 (login), FR-003 (create profile), FR-004 (view own profile), FR-006 (browse catalog), FR-007 (trick detail pages), FR-008 (mark favorite), FR-009 (mark in-progress), FR-010 (mark finished), FR-011 (change status from catalog), FR-012 (change status from detail page), Business Logic (weighted progress score calculation), Success Criteria (primary: "user can track which tricks their dog knows and successfully change status")
- **Prerequisites:** F-01 (schema), F-02 (seed tricks), auth scaffold (Supabase integration present in baseline)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Should profile creation happen immediately after registration (wizard flow), or as a separate step? Owner: user. Block: no (PRD doesn't specify timing; implementation detail; both are valid).
- **Risk:** This is the largest slice — it spans registration, profile creation, catalog browsing, detail pages, status mutations, and progress score calculation. If too broad for one `/10x-plan` invocation, that skill will split it. Per speed goal, keeping it unified as the north star is acceptable; the PRD's US-01 Acceptance Criteria validate this as one coherent flow.
- **Status:** done

### S-02: User can share their profile link (enhanced)

- **Outcome:** User can share their profile via three methods: copy link to clipboard, display QR code for scanning, or open email with pre-filled profile link. Replaces existing copy button with accessible modal UI.
- **Change ID:** shareable-profile-link
- **PRD refs:** FR-005 (must-have: "User can generate and copy their own profile link" — already fully implemented via copy button in ProfileDisplay per research.md; this slice delivers enhancements for improved sharing UX)
- **Prerequisites:** S-01 (must have profile with unique login name first)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Medium scope (~2-3 focused sessions across 4 phases). Adds 2 new dependencies (~60KB gzipped: @radix-ui/react-dialog, qrcode.react). Enhancement is intentional — roadmap permits polish on core social feature before moving to follow relationships (S-04). Low implementation risk (well-understood patterns).
- **Status:** done

### S-03: User can view another user's profile and their trick progress

- **Outcome:** User can visit another user's profile via shared link and see their dog info, owner nickname, and tricks organized by status (favorite, in-progress, finished) with weighted progress score
- **Change ID:** public-profile-view
- **PRD refs:** FR-013 (visit profile via shared link), FR-017 (view followed users' trick progress — applies to any public profile), Success Criteria (primary: "another user can visit it … and see that user's trick progress")
- **Prerequisites:** S-02 (need shareable links to visit)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - What should happen if a user visits a profile link for a non-existent username? Owner: team. Block: no (standard 404 or "Profile not found" page; implementation detail).
- **Risk:** Privacy model is simple per PRD NFR ("any user with a profile link can view that profile; no public listing or search"). Low risk.
- **Status:** proposed

### S-04: User can follow users and see follow relationships

- **Outcome:** User can follow another user's profile (one-way, no reciprocation required), view list of profiles they follow in Friends tab, and view list of their followers in Friends tab
- **Change ID:** follow-relationships
- **PRD refs:** FR-014 (follow user), FR-015 (view followed list), FR-016 (view follower list), Access Control (one-way following like Twitter/Instagram)
- **Prerequisites:** S-03 (must be able to view profiles to follow them)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Should there be a limit on how many users you can follow? Owner: user. Block: no (no limit for MVP; add rate limiting if abuse surfaces post-launch).
- **Risk:** One-way following is well-understood domain pattern (Twitter/Instagram). PRD clarifies "no friend request needed", so mutual acceptance flow is out of scope. Low risk.
- **Status:** proposed

### S-05: Admin can manage trick catalog

- **Outcome:** Admin user can add tricks to catalog (with name, difficulty level, step-by-step teaching description), edit existing tricks, and remove tricks from catalog
- **Change ID:** admin-trick-crud
- **PRD refs:** FR-018 (admin add tricks), FR-019 (admin edit tricks), FR-020 (admin remove tricks), Access Control (Admin role)
- **Prerequisites:** F-01 (schema includes tricks table), F-02 (seed data exists to test edit/remove against)
- **Parallel with:** S-01, S-02, S-03, S-04 (shares only F-01, F-02; no user-slice dependencies — can execute in parallel with user-facing stream)
- **Blockers:** —
- **Unknowns:**
  - How is admin role assigned to users? PRD Access Control says "Admin" role exists and "Regular user (default)" implies admin is non-default, but doesn't specify assignment mechanism (database flag? hardcoded email? OAuth claim? manual SQL grant?). Owner: user/team. Block: yes (can't build admin UI without knowing who gets access and how to check it).
- **Risk:** Must-have per PRD, but blocked on role assignment unknown. If resolved quickly, this slice is low risk (standard CRUD interface). If unresolved, defers to post-MVP.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | database-schema | Database schema & migrations for users, profiles, tricks | yes | Run `/10x-plan database-schema` |
| F-02 | seed-trick-catalog | Seed starter trick catalog (10-15 tricks) | no | Blocked on F-01 |
| S-01 | first-trick-tracking | User can track their first trick (north star) | no | Blocked on F-01, F-02 |
| S-02 | shareable-profile-link | User can share their profile link | no | Blocked on S-01 |
| S-03 | public-profile-view | User can view another user's profile and progress | no | Blocked on S-02 |
| S-04 | follow-relationships | User can follow users and see relationships | no | Blocked on S-03 |
| S-05 | admin-trick-crud | Admin can manage trick catalog | no | Blocked on F-01, F-02, and admin role assignment unknown |

## GitHub Issues

Roadmap migrated to GitHub Issues on 2026-05-25.

- **Milestone**: [MVP](https://github.com/olkapolka/dog-trick-tracker/milestone/1)
- **Labels**: 7 custom labels created (`type: foundation`, `type: slice`, `type: admin`, `status: ready`, `status: blocked`, `status: proposed`, `priority: north-star`)

### Issue Mapping

| Roadmap ID | Issue | Title | Labels | Status |
|---|---|---|---|---|
| F-01 | [#6](https://github.com/olkapolka/dog-trick-tracker/issues/6) | Database schema & migrations for users, profiles, tricks | `type: foundation` `status: ready` | Ready for `/10x-plan database-schema` |
| F-02 | [#7](https://github.com/olkapolka/dog-trick-tracker/issues/7) | Seed starter trick catalog (10-15 tricks) | `type: foundation` `status: proposed` | Depends on #6 |
| S-01 | [#8](https://github.com/olkapolka/dog-trick-tracker/issues/8) | User can track their first trick (north star) | `type: slice` `status: proposed` `priority: north-star` | Depends on #6, #7 — North star 🌟 |
| S-02 | [#9](https://github.com/olkapolka/dog-trick-tracker/issues/9) | User can share their profile link | `type: slice` `status: proposed` | Depends on #8 |
| S-03 | [#10](https://github.com/olkapolka/dog-trick-tracker/issues/10) | User can view another user's profile and progress | `type: slice` `status: proposed` | Depends on #9 |
| S-04 | [#11](https://github.com/olkapolka/dog-trick-tracker/issues/11) | User can follow users and see relationships | `type: slice` `status: proposed` | Depends on #10 |
| S-05 | [#12](https://github.com/olkapolka/dog-trick-tracker/issues/12) | Admin can manage trick catalog | `type: admin` `status: blocked` | Depends on #6, #7 — Blocked on admin role assignment |

**Next steps**:
- Start with [#6 Database schema](https://github.com/olkapolka/dog-trick-tracker/issues/6) — ready for `/10x-plan database-schema`
- All issues include full roadmap context (outcome, prerequisites with clickable task lists, PRD references, unknowns, risk assessment)
- Dependencies are tracked via task lists in issue bodies (check boxes link to prerequisite issues)

## Open Roadmap Questions

1. **How is admin role assigned to users?** — Owner: user/team. Block: S-05 (admin UI can't be built without knowing who gets access and how to verify it at runtime). PRD Access Control declares the Admin role exists and Regular is default, but doesn't specify assignment flow. Options: database boolean flag `is_admin` set via SQL, hardcoded email allowlist, Supabase JWT claim, or separate admin auth flow. Requires decision before S-05 can be planned.

## Parked

- **Aggregated feed** — Why parked: PRD §Non-Goals. Users manually visit followed profiles to see progress. Auto-updating feed deferred to v2 per complexity vs validation value trade-off.
- **Leaderboards or competitive features** — Why parked: PRD §Non-Goals. Progress score is personal only. Competition deferred to 100x scale per PRD §Scale insight.
- **Observability (logging, error tracking, metrics)** — Why parked: Absent in baseline; not required by must-have FRs; speed goal + time constraint prioritize user-visible slices over operational tooling for MVP. Add post-launch when product is validated.

## Done

- **S-01: Create profile with dog info, browse trick catalog with detail pages, mark trick status, see weighted progress score** — Archived 2026-05-29 → `context/archive/2026-05-25-first-trick-tracking/`. Lesson: —.
- **S-02: User can share their profile via three methods: copy link to clipboard, display QR code for scanning, or open email with pre-filled profile link. Replaces existing copy button with accessible modal UI.** — Archived 2026-05-31 → `context/archive/2026-05-29-shareable-profile-link/`. Lesson: —.
