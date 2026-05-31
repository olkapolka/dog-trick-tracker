# Public Profile View with Following Functionality — Plan Brief

> Full plan: [context/changes/public-profile-view/plan.md](context/changes/public-profile-view/plan.md)

## What & Why

Add one-way following functionality to complete the social features outlined in the PRD (FR-013 through FR-017). Users can follow other users' profiles by clicking a Follow button on public profiles, view their following and followers lists in a new Friends page, and discover profiles through shared links. This implements "profile bookmarking" where users save profiles they want to check back on, with no aggregated feed needed for MVP per PRD simplification.

## Starting Point

The public profile route [/user/[username].astro](src/pages/user/[username].astro) already displays dog info and trick progress (FR-013 complete). ProfileDisplay component shows ShareModal for own profile or a generic "Back to Dashboard" link for other profiles. Database has profiles, tricks, and user_tricks tables. Auth middleware, toast notifications (Sonner), and API endpoint patterns are established. What's missing: follows table, follow/unfollow API endpoints, Follow button UI, Friends page, and navigation integration.

## Desired End State

Users viewing another user's profile see a Follow button below the training points display. Clicking it immediately toggles to "Following" with optimistic UI and toast confirmation. Clicking "Following" unfollows. Authenticated users navigate to `/friends` from the Topbar to see two sections: "Following" (profiles they follow) and "Followers" (who follows them), each showing dog names, usernames, and profile links. Unauthenticated users clicking Follow are redirected to signin with return URL preserved. Self-follow attempts return 400 error at database level.

## Key Decisions Made

| Decision                       | Choice                        | Why (1 sentence)                                                                                               | Source   |
| ------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Scope                          | Complete follow feature       | Users get the full FR-014 through FR-016 experience in one deployment, matches roadmap S-03+S-04 merge         | Plan     |
| Database constraint            | Composite unique constraint   | Database-level guarantee of no duplicate follows, matches standard social graph pattern                        | Plan     |
| Follow UX                      | Immediate toggle with toast   | Fast feedback, matches modern social UX and existing share modal toast pattern in ProfileDisplay              | Plan     |
| Button state                   | Text + style toggle           | Clear state, matches Twitter/Instagram pattern users recognize                                                 | Plan     |
| Friends page UI                | Single page, two sections     | Simple, all info in one scroll - matches small MVP scale (< 100 users)                                         | Plan     |
| Navigation                     | Add Friends to Topbar         | Discoverable, consistent with existing nav pattern                                                             | Plan     |
| Self-follow prevention         | Block via CHECK constraint    | Prevents illogical state at database level, matches social norms                                               | Plan     |
| Empty state                    | Prompt with Dashboard link    | Guides user to action - matches PRD note that profiles aren't publicly listed, so discovery happens via links  | Plan     |
| Auth boundary                  | Redirect to signin            | Standard auth gating, preserves profile URL so user can follow after signing in                                | Plan     |
| Following type                 | One-way (no mutual approval)  | Matches PRD Access Control specification and Twitter/Instagram pattern                                         | PRD      |

## Scope

**In scope:**
- Create `follows` database table with composite PK and RLS policies
- POST `/api/follow` and DELETE `/api/unfollow` endpoints
- FollowButton React component with optimistic UI
- Update ProfileDisplay to show Follow button when viewing others
- New `/friends` page showing Following and Followers lists
- Add "Friends" link to Topbar navigation
- Auth gating (redirect unauthenticated users to signin)
- Empty states for zero follows/followers
- Self-follow prevention via CHECK constraint
- Toast notifications for follow/unfollow actions

**Out of scope:**
- Aggregated activity feed showing friends' progress
- Follow request / mutual acceptance flow
- Follow limits or rate limiting
- Public user discovery or search
- Notifications when someone follows you
- Social share buttons for following
- Follow counts displayed on profiles

## Architecture / Approach

Database-first incremental approach: create the `follows` junction table with composite primary key `(follower_id, following_id)` to prevent duplicates, foreign keys to `auth.users` with cascade delete, and RLS policies (public read, auth-gated write). Add POST `/api/follow` and DELETE `/api/unfollow` endpoints following existing API patterns (JSON responses, manual validation, `context.locals.user` auth check). Integrate a new FollowButton React component into ProfileDisplay (replaces generic "Back to Dashboard" link when `isOwnProfile=false`) with `client:load` directive for optimistic UI updates and Sonner toast feedback. Build `/friends` page querying follows table with joins to profiles table, rendering two sections (Following/Followers) with empty states. Add Friends link to Topbar next to Dashboard and Profile.

## Phases at a Glance

| Phase          | What it delivers                                                   | Key risk                                             |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| 1. Database    | `follows` table with composite PK, RLS policies, TypeScript types | Migration conflicts or incorrect foreign key setup  |
| 2. API         | POST `/api/follow` and DELETE `/api/unfollow` endpoints           | Concurrent follow requests creating duplicate rows   |
| 3. Follow UI   | FollowButton in ProfileDisplay with optimistic updates            | Optimistic UI rollback on network errors             |
| 4. Friends     | `/friends` page showing Following/Followers lists                 | Query joins failing or incorrect relationship joins  |
| 5. Navigation  | Friends link in Topbar                                             | Accessibility or responsive layout issues            |

**Prerequisites:** Node 22+ (per AGENTS.md), Supabase local dev running (`npx supabase start`), clean npm install  
**Estimated effort:** ~3-4 focused sessions across 5 incremental phases

## Open Risks & Assumptions

- **Database composite key**: Relies on Supabase correctly enforcing `(follower_id, following_id)` uniqueness — validated in Phase 1 manual testing
- **Optimistic UI edge cases**: Rapid follow/unfollow clicks could create race conditions if API responses arrive out-of-order — mitigated by using `useState` to track in-flight requests
- **RLS policy performance**: Public read access to follows table could become slow at scale (10k+ users with thousands of follows each) — acceptable for MVP, consider pagination post-launch
- **Return URL preservation**: `/auth/signin?returnTo=/user/username` pattern assumes signin flow respects returnTo param — validate in Phase 3 manual testing
- **Friends page query joins**: Using Supabase's relationship syntax `profiles!follows_follower_id_fkey(...)` — test with actual data to confirm correct join behavior

## Success Criteria (Summary)

- User A can follow User B from User B's profile → see "Following" button state → visit `/friends` and see User B in "Following" list
- User B visits `/friends` → sees User A in "Followers" list  
- User A clicks "Following" on User B's profile → unfollows → button returns to "Follow" state with toast confirmation
- Unauthenticated user clicks Follow → redirected to `/auth/signin?returnTo=/user/username` → completes signin → can now follow
- Self-follow attempt (via direct API call) returns 400 error with constraint violation
- All phases pass automated verification (build, lint, type-check)
