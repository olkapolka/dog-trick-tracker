# Public Profile View with Following Functionality — Implementation Plan

## Overview

Add one-way following functionality to the existing public profile view. Users can follow other users' profiles (like Twitter/Instagram), view their following and followers lists in a new Friends page, and see a Follow/Unfollow button when visiting other profiles. This completes FR-013 through FR-017 from the PRD, implementing simplified "profile bookmarking" where users save profiles they want to check back on, with no aggregated feed needed for MVP.

## Current State Analysis

### What exists:
- Public profile route at [/user/[username].astro](src/pages/user/[username].astro#L1-L68) displaying dog info, progress score, and tricks organized by status (FR-013 ✓)
- ProfileDisplay component ([src/components/profile/ProfileDisplay.astro](src/components/profile/ProfileDisplay.astro#L1-L175)) with `isOwnProfile` prop controlling ShareModal vs "Back to Dashboard" link
- Database schema with profiles, tricks, user_tricks tables (see [database.types.ts](src/lib/database.types.ts#L22-L132))
- Auth middleware populating `context.locals.user` ([src/middleware.ts](src/middleware.ts#L3-L40))
- Toast notification system (Sonner) configured globally ([src/layouts/Layout.astro](src/layouts/Layout.astro#L22))
- API patterns established: JSON responses with status codes, inline validation ([src/pages/api/tricks/status.ts](src/pages/api/tricks/status.ts) example)

### What's missing:
- ❌ `follows` database table for tracking follower/following relationships
- ❌ Follow/Unfollow API endpoints
- ❌ Follow button UI in ProfileDisplay when viewing other users
- ❌ Friends page showing following and followers lists
- ❌ Navigation link to Friends in Topbar
- ❌ Logic to check if current user already follows a profile

### Key Discoveries:
- Migration pattern: `YYYYMMDDHHMMSS_description.sql` with composite PK for junction tables ([20260526132227_create_user_tricks_table.sql](supabase/migrations/20260526132227_create_user_tricks_table.sql#L5-L13))
- Foreign keys use `ON DELETE CASCADE` — when a user is deleted, their follow relationships are automatically cleaned up
- RLS policies always enabled: public read (`USING (true)`), auth-gated write (`WITH CHECK (auth.uid() = user_id)`)
- Page structure: Server-side auth check → Supabase client → data fetch → component delegation ([src/pages/profile.astro](src/pages/profile.astro#L7-L21))
- Toast API: `toast.success()` / `toast.error()` in React components with `client:load` directive ([src/components/profile/ShareModal.tsx](src/components/profile/ShareModal.tsx#L18-L20))

## Desired End State

When a user visits another user's profile (`/user/someuser`), they see a Follow button (or "Following" if already following) below the training points display. Clicking it immediately toggles the state with optimistic UI and shows a toast confirmation. Clicking "Following" unfollows with confirmation. 

Authenticated users can navigate to a new `/friends` page from the Topbar to see two sections: "Following" (profiles they follow) and "Followers" (who follows them). Each list shows dog names, usernames, and profile links. Empty states guide users to discover profiles via shared links.

Unauthenticated users viewing public profiles see the Follow button but get redirected to `/auth/signin?returnTo=/user/username` when clicking it, preserving their intent.

### Verification:
- User A can follow User B from `/user/userb` → see "Following" button state → visit `/friends` and see User B in "Following" list
- User B visits `/friends` → sees User A in "Followers" list
- User A clicks "Following" on `/user/userb` → unfollows → button returns to "Follow" state
- Anon user clicks Follow → redirected to signin with return URL preserved
- Self-follow attempt returns 400 error

## What We're NOT Doing

- Aggregated activity feed (explicitly deferred per PRD FR-013 note)
- Friend request / mutual acceptance flow (one-way following per PRD Access Control)
- Follow limits or rate limiting (defer until abuse surfaces post-launch)
- Public user discovery or search (PRD NFR: "profiles are not publicly listed or searchable")
- Notifications when someone follows you (v2 feature)
- Social share buttons for following (e.g., "Share on Twitter")
- Follow counts displayed on profiles (can add post-MVP if desired)

## Implementation Approach

Incremental database-first approach: create the follows junction table with proper constraints and RLS policies, add API endpoints for follow/unfollow actions, integrate a Follow button into the existing ProfileDisplay component (replacing the generic "Back to Dashboard" link when `isOwnProfile=false`), and build a new Friends page that queries the follows table. Each phase is independently testable and deployable.

## Phase 1: Database Schema & Type Generation

### Overview
Create the `follows` junction table to track follower/following relationships with composite primary key, foreign key constraints, and RLS policies. Regenerate TypeScript types.

### Changes Required:

#### 1. Follows Table Migration

**File**: `supabase/migrations/20260531000001_create_follows_table.sql`

**Intent**: Create the `follows` table with composite primary key `(follower_id, following_id)` to prevent duplicate follows, foreign keys to `auth.users` with cascade delete, and timestamp tracking. Enable RLS with public read access and auth-gated writes where users can only create/delete their own follow relationships.

**Contract**: 

```sql
-- Create follows table
CREATE TABLE follows (
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)  -- Prevent self-follow at DB level
);

-- Indexes for query performance
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Follows are publicly readable"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);
```

#### 2. TypeScript Type Regeneration

**File**: `src/lib/database.types.ts`

**Intent**: Regenerate TypeScript types to include the new `follows` table schema. This is an auto-generated file — run the Supabase CLI command after applying the migration.

**Contract**: Run `npx supabase gen types typescript --local > src/lib/database.types.ts` after migration. The generated types will include:

```typescript
follows: {
  Row: {
    follower_id: string;
    following_id: string;
    created_at: string;
  };
  Insert: {
    follower_id: string;
    following_id: string;
    created_at?: string;
  };
  Update: {
    follower_id?: string;
    following_id?: string;
    created_at?: string;
  };
  Relationships: [
    { foreignKeyName: "follows_follower_id_fkey"; ... },
    { foreignKeyName: "follows_following_id_fkey"; ... }
  ];
}
```

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (local)
- Type generation completes: `npx supabase gen types typescript --local`
- TypeScript compilation passes: `npm run build`
- No ESLint errors: `npm run lint`

#### Manual Verification:

- Query the follows table structure: `docker exec supabase_db_10x-astro-starter psql -U postgres -d postgres -c "\d follows"`
- Verify composite PK prevents duplicates: attempt `INSERT INTO follows (follower_id, following_id) VALUES ('uuid1', 'uuid2')` twice → second fails with constraint violation
- Verify CHECK constraint blocks self-follow: `INSERT INTO follows (follower_id, following_id) VALUES ('same-uuid', 'same-uuid')` → fails
- Verify cascade delete: delete a user from auth.users → their follow relationships automatically removed
- Inspect generated types in [database.types.ts](src/lib/database.types.ts) → `follows` table present with correct shape

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Follow/Unfollow API Endpoints

### Overview
Create REST API endpoints for follow and unfollow actions with auth gating, duplicate prevention, and self-follow blocking.

### Changes Required:

#### 1. Follow Endpoint

**File**: `src/pages/api/follow.ts`

**Intent**: POST endpoint to create a follow relationship. Validates that the user is authenticated, the target user exists, and prevents self-follows. Returns 400 for invalid input, 401 for unauthenticated, 409 if already following, 200 on success.

**Contract**: Export a `POST: APIRoute` handler. Accept JSON body `{ followingId: string }`. Query profiles table to verify target exists. Insert into follows table with `(follower_id: auth.uid(), following_id: followingId)`. Supabase will enforce the composite PK uniqueness constraint — catch error code `23505` and return 409. The CHECK constraint blocks self-follows — catch and return 400.

#### 2. Unfollow Endpoint

**File**: `src/pages/api/unfollow.ts`

**Intent**: DELETE endpoint to remove a follow relationship. Validates auth and deletes the matching row from follows table. Returns 200 on success or if the relationship didn't exist (idempotent).

**Contract**: Export a `DELETE: APIRoute` handler. Accept JSON body `{ followingId: string }`. Delete from follows table where `follower_id = auth.uid() AND following_id = followingId`. Return 200 regardless of whether a row was deleted (idempotent unfollow).

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification:

- **Follow flow**: Use curl or Postman to POST `/api/follow` with valid session cookie and `{ followingId: "valid-uuid" }` → returns 200, row inserted in DB
- **Duplicate follow**: Repeat the same POST → returns 409 with error message
- **Self-follow**: POST with `followingId` equal to current user's ID → returns 400
- **Invalid target**: POST with non-existent `followingId` → returns 400 (profile not found)
- **Unauth follow**: POST without session cookie → returns 401
- **Unfollow flow**: DELETE `/api/unfollow` with valid `followingId` → returns 200, row deleted
- **Idempotent unfollow**: DELETE again → still returns 200, no error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Follow Button in ProfileDisplay

### Overview
Add a Follow/Unfollow button to ProfileDisplay when viewing another user's profile. Implements optimistic UI updates with toast feedback and auth-gated access.

### Changes Required:

#### 1. Follow Button Component

**File**: `src/components/profile/FollowButton.tsx`

**Intent**: React component that displays "Follow" or "Following" button based on current follow state. On click, POSTs to `/api/follow` or DELETEs to `/api/unfollow`, updates local state optimistically, and shows toast confirmation. Handles errors with rollback and error toast. Redirects unauthenticated users to signin with return URL.

**Contract**: Accept props `{ followingId: string, initialIsFollowing: boolean, isAuthenticated: boolean, currentPath: string }`. Use `useState` to track follow state (initialized from `initialIsFollowing`). On click:
1. If not authenticated: `window.location.href = /auth/signin?returnTo=${currentPath}`
2. Otherwise: optimistically toggle state, call API, show toast on success, rollback on error

Button styling: "Follow" uses purple background (`bg-purple-500 hover:bg-purple-600`), "Following" uses white outline (`border-2 border-white/40 hover:border-white/60`) with hover text change to "Unfollow".

#### 2. Update ProfileDisplay Integration

**File**: `src/components/profile/ProfileDisplay.astro`

**Intent**: Replace the "Back to Dashboard" link (currently shown when `isOwnProfile=false`) with the new FollowButton component. Pass the necessary props including follow state.

**Contract**: At [line 140-154](src/components/profile/ProfileDisplay.astro#L140-L154), replace the conditional that shows ShareModal (own profile) vs generic link (other profile) with:
- `isOwnProfile=true` → ShareModal (unchanged)
- `isOwnProfile=false` → FollowButton with `client:load` directive

New props needed for ProfileDisplay:
```typescript
interface Props {
  // ... existing props
  isOwnProfile?: boolean;
  currentUserId?: string | null;  // For checking follow state
  isFollowing?: boolean;           // Server-determined follow state
  profileUserId: string;           // Target profile's user_id
}
```

#### 3. Update /user/[username] Page

**File**: `src/pages/user/[username].astro`

**Intent**: Query the follows table to determine if the current user (if authenticated) already follows the viewed profile. Pass this state and auth context to ProfileDisplay.

**Contract**: After fetching the profile ([line 16](src/pages/user/[username].astro#L16)), add:
1. Get current user from `Astro.locals.user` (may be null if not authenticated)
2. If user exists, query: `await supabase.from("follows").select("*").eq("follower_id", user.id).eq("following_id", profile.user_id).maybeSingle()`
3. Set `isFollowing = !!followRow`
4. Pass new props to ProfileDisplay: `currentUserId={user?.id}`, `isFollowing={isFollowing}`, `profileUserId={profile.user_id}`

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification:

- **Authenticated flow**: Sign in, visit another user's profile → see "Follow" button
- **Click Follow**: Button changes to "Following", toast shows "Now following [username]", DB row inserted
- **Click Following**: Hover shows "Unfollow", click unfollows, button reverts to "Follow", toast confirms
- **Unauthenticated flow**: Sign out, visit profile → see "Follow" button, click → redirected to `/auth/signin?returnTo=/user/username`
- **After signin**: Complete signin → redirected back to profile → can now follow
- **Own profile**: Visit your own profile → see ShareModal, no Follow button
- **Error handling**: Simulate API error (e.g., stop dev server mid-request) → optimistic UI rolls back, error toast appears

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Friends Page

### Overview
Create a new `/friends` page displaying two sections: Following (profiles the user follows) and Followers (who follows the user). Auth-gated with empty state messaging.

### Changes Required:

#### 1. Friends Page Route

**File**: `src/pages/friends.astro`

**Intent**: Auth-gated page that queries the follows table to get lists of users the current user follows and users who follow them. Passes data to a display component.

**Contract**: Follow standard page structure:
1. Auth check: redirect to `/auth/signin` if no `Astro.locals.user`
2. Create Supabase client
3. Query following: `supabase.from("follows").select("following_id, profiles!follows_following_id_fkey(login_name, dog_name)").eq("follower_id", user.id)`
4. Query followers: `supabase.from("follows").select("follower_id, profiles!follows_follower_id_fkey(login_name, dog_name)").eq("following_id", user.id)`
5. Render in Layout with Topbar, two sections, and links to profiles

#### 2. Friends Page Markup

**File**: `src/pages/friends.astro` (continued)

**Intent**: Display the following and followers lists in a clean two-section layout with empty states.

**Contract**: Use standard page container (`bg-cosmic min-h-screen p-4 pt-20` → `mx-auto max-w-4xl`). Two sections:

**Following section**:
- Header: "Following" with count
- List: Each item shows dog name, @username, link to `/user/[username]`
- Empty state: "You're not following anyone yet. Discover profiles via shared links!"

**Followers section**:
- Header: "Followers" with count
- List: Same format as following
- Empty state: "No one is following you yet. Share your profile to get followers!"

Styling: Use card style matching ProfileDisplay (`rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md`).

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification:

- **Auth gating**: Visit `/friends` while signed out → redirected to `/auth/signin`
- **Empty state**: Sign in with new user, visit `/friends` → see both empty state messages
- **Following list**: Follow another user (via profile), refresh `/friends` → see them in "Following" section with correct dog name and username
- **Followers list**: Have another user follow you, refresh `/friends` → see them in "Followers" section
- **Profile links**: Click a profile link in either list → navigates to that user's public profile
- **Counts**: Verify section headers show correct counts (e.g., "Following (2)")

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Navigation Integration

### Overview
Add a "Friends" link to the Topbar navigation, making the feature discoverable.

### Changes Required:

#### 1. Update Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Add a "Friends" link next to "Dashboard" and "Profile" in the authenticated nav section.

**Contract**: At [line 12-14](src/components/Topbar.astro#L12-L14), add a third link:
```astro
<a href="/dashboard" class="text-purple-300 transition-colors hover:text-purple-100 hover:underline">
  Dashboard
</a>
<a href="/profile" class="text-purple-300 transition-colors hover:text-purple-100 hover:underline">
  Profile
</a>
<a href="/friends" class="text-purple-300 transition-colors hover:text-purple-100 hover:underline">
  Friends
</a>
```

### Success Criteria:

#### Automated Verification:

- ESLint passes: `npm run lint`
- TypeScript compilation passes: `npm run build`

#### Manual Verification:

- **Visibility**: Sign in, visit any page with Topbar → see "Friends" link next to Dashboard and Profile
- **Navigation**: Click "Friends" → navigates to `/friends` page
- **Active state**: (Optional enhancement) Consider adding active state styling when on `/friends` route
- **Unauthenticated**: Sign out → "Friends" link should not appear (it's in the authenticated section)
- **Responsive**: Test on mobile viewport → links wrap gracefully or condense as needed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:
- FollowButton component: test state transitions, optimistic updates, error rollback
- API endpoints: test auth gating, duplicate prevention, self-follow blocking, error codes

### Integration Tests:
- End-to-end follow flow: User A follows User B → appears in A's Following list and B's Followers list
- Unfollow flow: User A unfollows User B → removed from both lists
- Cascade delete: Delete a user → their follow relationships cleaned up automatically

### Manual Testing Steps:
1. **Two-user flow**: Create two accounts (User A, User B)
2. User A visits User B's profile → clicks Follow → verify button state change and toast
3. User A visits `/friends` → verify User B appears in "Following" section
4. User B visits `/friends` → verify User A appears in "Followers" section
5. User A unfollows User B from profile → verify both lists update
6. **Unauthenticated flow**: Sign out, visit a profile, click Follow → redirected to signin with return URL
7. **Self-follow prevention**: Attempt to POST `/api/follow` with your own user ID → 400 error
8. **Edge case**: Rapidly click Follow/Unfollow → verify no duplicate rows created

## Performance Considerations

- **Query optimization**: Indexes on `follower_id` and `following_id` ensure fast lookups for following/followers lists even with thousands of relationships
- **Optimistic UI**: Follow/Unfollow actions feel instant by updating button state before API response
- **RLS policy efficiency**: Simple equality checks (`auth.uid() = follower_id`) are fast; Postgres can use indexes effectively
- **Friends page pagination**: Not needed for MVP (most users will have < 50 follows), but consider adding infinite scroll if median follows exceeds 100 post-launch

## Migration Notes

- The follows table uses `auth.users(id)` foreign keys — existing users can immediately start following without schema changes to the profiles table
- Composite primary key `(follower_id, following_id)` prevents duplicate follows at the database level, making the application logic simpler
- `CHECK (follower_id != following_id)` constraint blocks self-follows without needing application-level checks
- RLS policies allow public read access to follows data, supporting future features like "X people follow this profile" counts
- No data migration needed — this is a pure additive feature; existing profiles work unchanged

## References

- PRD: [context/foundation/prd.md](context/foundation/prd.md) — FR-013 through FR-017
- Roadmap: [context/foundation/roadmap.md](context/foundation/roadmap.md#L36-L46) — S-03 and S-04 slices
- Migration pattern: [supabase/migrations/20260526132227_create_user_tricks_table.sql](supabase/migrations/20260526132227_create_user_tricks_table.sql) — junction table example
- API pattern: [src/pages/api/tricks/status.ts](src/pages/api/tricks/status.ts) — auth gating and error handling
- Toast usage: [src/components/profile/ShareModal.tsx](src/components/profile/ShareModal.tsx#L18-L20) — Sonner API

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Schema & Type Generation

#### Automated

- [x] 1.1 Migration applies cleanly
- [x] 1.2 Type generation completes
- [x] 1.3 TypeScript compilation passes
- [x] 1.4 No ESLint errors

#### Manual

- [ ] 1.5 Verify follows table structure
- [ ] 1.6 Verify composite PK prevents duplicates
- [ ] 1.7 Verify CHECK constraint blocks self-follow
- [ ] 1.8 Verify cascade delete cleanup
- [ ] 1.9 Inspect generated types

### Phase 2: Follow/Unfollow API Endpoints

#### Automated

- [ ] 2.1 TypeScript compilation passes
- [ ] 2.2 ESLint passes

#### Manual

- [ ] 2.3 Test follow flow with curl/Postman
- [ ] 2.4 Test duplicate follow returns 409
- [ ] 2.5 Test self-follow returns 400
- [ ] 2.6 Test invalid target returns 400
- [ ] 2.7 Test unauthorized follow returns 401
- [ ] 2.8 Test unfollow flow
- [ ] 2.9 Test idempotent unfollow

### Phase 3: Follow Button in ProfileDisplay

#### Automated

- [ ] 3.1 TypeScript compilation passes
- [ ] 3.2 ESLint passes

#### Manual

- [ ] 3.3 Test authenticated Follow button
- [ ] 3.4 Test Follow click and state change
- [ ] 3.5 Test Unfollow with hover state
- [ ] 3.6 Test unauthenticated redirect
- [ ] 3.7 Test signin return flow
- [ ] 3.8 Verify own profile shows ShareModal
- [ ] 3.9 Test error handling with rollback

### Phase 4: Friends Page

#### Automated

- [ ] 4.1 TypeScript compilation passes
- [ ] 4.2 ESLint passes

#### Manual

- [ ] 4.3 Test auth gating
- [ ] 4.4 Test empty state displays
- [ ] 4.5 Test Following list population
- [ ] 4.6 Test Followers list population
- [ ] 4.7 Test profile links navigation
- [ ] 4.8 Verify section counts

### Phase 5: Navigation Integration

#### Automated

- [ ] 5.1 ESLint passes
- [ ] 5.2 TypeScript compilation passes

#### Manual

- [ ] 5.3 Verify Friends link visibility
- [ ] 5.4 Test navigation to Friends page
- [ ] 5.5 Test link hidden when signed out
- [ ] 5.6 Test responsive behavior
