# User Can Track Their First Trick — Plan Brief

> Full plan: `context/changes/first-trick-tracking/plan.md`

## What & Why

Build the north star feature that validates the core product hypothesis: users can systematically track which tricks their dog knows, see meaningful weighted progress, and share their achievements. This proves that domain-specific tracking beats generic habit apps by showing step-by-step teaching instructions and calculating progress scores based on trick difficulty (beginner=1, intermediate=2, advanced=3 points).

## Starting Point

Auth infrastructure is complete (Supabase signup/signin/signout, middleware-based route protection, session management). UI component library exists (FormField, Button, cosmic glass theme). No profile management, catalog browsing, status tracking, or public sharing exists yet. Codebase uses server-side form submissions with page redirects; no client-side data fetching.

**Database schema will be created in Phase 0** — this plan is self-contained and creates `profiles`, `tricks`, and `user_tricks` tables with 12 seeded tricks rather than depending on external F-01/F-02 work.

## Desired End State

User registers → completes profile creation wizard (unique username, dog info, photo upload to Supabase Storage) → lands on dashboard showing trick catalog grouped by difficulty → clicks trick card to see detail page with step-by-step teaching description → marks status (favorite/in-progress/finished) with instant optimistic UI update → sees weighted progress score on profile → copies profile link → another user visits `/user/username` and sees public read-only profile with trick progress.

## Key Decisions Made

| Decision                     | Choice                                                               | Why (1 sentence)                                                                                                   | Source    |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| Profile creation timing      | Immediate wizard after signup                                        | Ensures every user has a profile before accessing features; no empty-state handling needed                         | Plan      |
| Catalog organization         | Grouped by difficulty with cards                                     | Clear progression path matches weighted scoring model; easy to scan on mobile                                      | Plan      |
| Status mutation UX           | Icon buttons with optimistic updates                                 | Meets "single click, no confirmation" UX requirement and instant feedback expectation                              | Plan      |
| Breed data source            | Hardcoded TypeScript constant (~50 breeds)                           | Zero database overhead; easy to extend by editing code; acceptable for finite list                                 | Plan      |
| Photo upload timing          | After profile creation (optional)                                    | Prevents orphaned Storage files if profile creation fails; profile created first, then photo updates it            | Plan      |
| Photo upload                 | Full Supabase Storage integration                                    | User chose complete feature over deferring; requires bucket setup and RLS policies                                 | Plan      |
| Detail page structure        | Dedicated page per trick                                             | Focused content, shareable URLs, mobile-friendly; 10-15 tricks small enough for page loads                         | Plan      |
| Progress score calculation   | On-demand query from user_tricks                                     | Always accurate; fast with indexed user_id; no denormalization complexity                                          | Plan      |
| Username uniqueness          | Check before save + schema constraint                                | Application-level feedback ("Username taken") with database-level enforcement prevents races                       | Plan      |
| Reserved username validation | Blocklist ["dashboard", "profile", "api", "auth", "tricks", "admin"] | Prevents route conflicts where user profiles collide with static routes; shows "Username reserved by system" error | Review F4 |
| Edge case handling           | Helpful empty states                                                 | Graceful degradation (placeholder avatar, "No tricks yet" message) guides users                                    | Plan      |
| Testing approach             | Focused unit + integration + manual                                  | Balances coverage on business logic and critical paths; manual for mobile responsiveness                           | Plan      |
| Performance target           | Optimize for 10-15 tricks                                            | Meets <2s catalog load guardrail; simple implementation; scales to hundreds without refactor needed                | Plan      |
| Error handling               | Toast notifications + rollback + field errors                        | Matches existing auth pattern; non-blocking UX; clear user recovery path                                           | Plan      |
| Dashboard route              | Shows catalog directly                                               | Users land on core feature immediately; no extra navigation layer                                                  | Plan      |
| Profile URLs                 | `/user/username` for public, `/profile` for own                      | Clean shareable URLs; separates public view from editing                                                           | Plan      |
| Navigation                   | Top bar (Catalog, Profile, Sign out)                                 | Consistent with existing Topbar; mobile-friendly; authenticated-only links                                         | Plan      |
| Client-side mutations        | Add SWR (4KB) + sonner for toasts                                    | Enables optimistic UX and error feedback without reinventing; minimal bundle increase                              | Plan      |
| Trick catalog visibility     | Public catalog + details, protected mutations                        | SEO-friendly, content marketing, users preview before signup; status toggles require auth                          | Plan      |

## Scope

**In scope:**

- Profile creation (username, dog name, breed, DOB, sex, photo upload to Storage)
- Trick catalog browsing (public, grouped by difficulty: beginner/intermediate/advanced)
- Trick detail pages (step-by-step teaching descriptions)
- Status tracking (favorite/in-progress/finished) with icon buttons + optimistic updates
- Weighted progress score (sum of finished tricks × difficulty weight)
- Public profile sharing (`/user/username` URLs, read-only view)
- Copy profile link functionality
- Empty states (no profile, no photo, no tricks)
- Mobile-first responsive design
- Toast error notifications + rollback on mutation failures

**Out of scope:**

- Following relationships (deferred to S-04: no follow button, no Friends tab, no follower list)
- Profile editing (create-once only; editing username or dog info deferred to post-MVP)
- Admin trick management (no CRUD for tricks; deferred to S-05)
- Email confirmations (dev mode only; production setup separate)
- Advanced photo features (no cropping, filters, or galleries; single 2MB photo only)
- Pagination or search (10-15 tricks fit on one page; deferred to 100x scale)
- Real-time updates (no WebSocket; optimistic updates are client-only)
- Leaderboards or competition (progress score is personal; no public rankings)
- Accessibility audit (semantic HTML + keyboard nav, but no ARIA labels or WCAG cert)

## Architecture / Approach

**Data flow:**

1. Profile creation: Client form → `POST /api/profile/create` → Supabase `profiles` insert (photo_url = null) → redirect to dashboard
2. Photo upload (optional, after profile exists): Client file picker → `POST /api/profile/upload-photo` → verify profile exists → Supabase Storage bucket `dog-photos` → UPDATE `profiles.photo_url`
3. Catalog display: Server-side fetch all tricks in `.astro` frontmatter → render grouped by difficulty
4. Status mutation: Client click → SWR optimistic update → `POST /api/tricks/status` → Supabase `user_tricks` upsert → revalidate on error (rollback + toast)
5. Progress score: On-demand query `SUM(tricks.difficulty_weight)` for finished tricks

**Key components:**

- `CreateProfileForm.tsx` — React form with validation (username uniqueness check, breed dropdown, DOB, sex, photo upload)
- `PhotoUpload.tsx` — File input with preview and 2MB validation
- `TrickCard.astro` — Catalog card (title, difficulty badge, description preview, link to detail)
- `StatusToggle.tsx` — Three icon buttons (Star/Clock/Check) with SWR mutation + optimistic state
- `user/[username].astro` — Dynamic route for public profiles
- `tricks/[slug].astro` — Dynamic route for trick details

**Libraries added:**

- **SWR** (4KB) — Client-side data fetching with optimistic updates and automatic revalidation
- **sonner** — Toast notifications for error feedback

**Progressive enhancement:**

- Auth flows stay server-side (form POST → redirect)
- Trick status tracking adds client-side mutations for optimistic UX
- Catalog and detail pages are public (work without JavaScript), status toggles require auth and JS

## Phases at a Glance

| Phase                   | What it delivers                                                                                       | Key risk                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 0. Database Schema      | Tables (profiles, tricks, user_tricks), RLS policies, seed 12 tricks, generate TypeScript types        | Schema design errors cascade to all phases; SQL syntax errors block progress                           |
| 1. Foundation Setup     | SWR + sonner installed, breeds constant created                                                        | Minimal risk; straightforward npm install and constant file                                            |
| 2. Profile Creation     | Profile form, API route, username uniqueness check, wizard redirect from signup, signin profile checks | Username uniqueness race condition if two users submit simultaneously (mitigated by schema constraint) |
| 3. Photo Upload         | Supabase Storage bucket migration, RLS policies, upload component that updates existing profile        | RLS policy syntax tricky; photo upload requires profile to exist first (new flow prevents orphans)     |
| 4. Catalog on Dashboard | Dashboard shows tricks grouped by difficulty, trick cards, empty state, profile existence check        | Phase 0 seed data must exist; implementer sees empty dashboard until this phase completes              |
| 5. Trick Detail Pages   | Dynamic `/tricks/[slug]` route, step-by-step description, 404 handling                                 | Slug collisions if two tricks have same name (mitigated by Phase 0 seed data design)                   |
| 6. Status Tracking      | Icon buttons, optimistic updates, API mutation, toast errors, rollback                                 | SWR mutation complexity; optimistic rollback logic must handle all error cases                         |
| 7. Progress Score       | Score calculation utility, display on profile, auto-update on status change                            | Score query performance (acceptable for 12 tricks, may need denormalization at scale)                  |
| 8. Public Profiles      | `/user/username` dynamic route, public view, copy link button, 404 for missing users                   | Simple nested dynamic route (`user/[username].astro`) with straightforward username extraction         |
| 9. Navigation & Polish  | Topbar links, protected routes, mobile responsiveness                                                  | Mobile testing requires real devices or thorough emulator testing; edge cases may slip through         |

**Prerequisites:**

- Local Supabase running (`npx supabase start`) or production Supabase project configured
- Supabase env vars (`SUPABASE_URL`, `SUPABASE_KEY`) set in `.env` and `.dev.vars`
- Node.js v22+ active (`nvm use 22`)

**Estimated effort:** ~6-8 sessions across 10 phases (Phase 0 adds schema creation; assuming 1-2 phases per session, each phase 30-60 minutes; total 7-12 hours)

## Open Risks & Assumptions

- **Supabase Storage API shape unverified** — Phase 3 uses `getPublicUrl()` destructuring based on docs but codebase has never used Storage API. Manual verification step added to confirm return structure.
- **Username uniqueness race condition** — Application-level check + schema constraint mitigates, but two simultaneous submits could both pass check and hit constraint. Acceptable for MVP scale.
- **SWR optimistic rollback complexity** — If mutation fails mid-flight and user navigates away, state may be stale. SWR revalidation should fix on next visit, but edge case exists.
- **Mobile testing coverage** — Manual testing required; no automated mobile responsiveness tests. Touch targets and scroll behavior must be verified on real devices.
- **Photo upload file size enforcement** — Client validation (2MB) enforced; Supabase Storage bucket migration includes file_size_limit and allowed_mime_types for server-side enforcement.
- **Score calculation performance** — On-demand query is fast for 12 tricks but may slow down at 100+ tricks per user. Denormalization (store score in `profiles` table) deferred to post-MVP.
- **Public profile privacy** — Any user with a `/user/username` link can view profile and progress. No privacy controls in MVP. If user wants private profile, feature doesn't exist yet.
- **Signin bypass** — Users who signed up before this feature could bypass profile creation. Mitigated by profile existence checks in signin route and dashboard frontmatter.

## Success Criteria (Summary)

- User can register → create profile → upload photo → browse catalog → mark trick status → see progress score → share profile link
- Another user can visit shared `/user/username` link and see public read-only profile with trick progress
- Status changes reflect instantly in UI (optimistic update) and persist after page reload
- Progress score updates immediately when trick marked finished
- All pages responsive on mobile (320px+ width, no horizontal scroll, touch targets ≥44px)
