---
project: "Dog Trick Tracker"
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# Dog Trick Tracker — Product Requirements Document

## Vision & Problem Statement

Dog owners training their own pets at home can't systematically track which tricks they're working on and how the dog is progressing. They want to track progress but have no good tool for it. The knowledge they need for training (how to teach tricks, what to work on next) is scattered across different sources — videos, blogs, forums. When they need to decide what trick to work on next or check how far they've come, they're faced with too many options and no clear starting point. Today they wing it without tracking, pulling information from memory and different sources each time.

Existing pet or habit-tracking apps are too complex or too generic — they don't understand the domain of dog trick training. This product will offer a focused catalog of tricks curated for the domain, with progress tracking that dog owners actually want to use.

## User & Persona

**Primary persona:** Dog owners training their own pets at home. Broad consumer market — anyone with a dog who wants to teach tricks. They're not professional trainers; they're people who want to bond with their dog, teach basic obedience or fun tricks, and see progress over time. They might be first-time dog owners or experienced, but they all share the same moment: sitting down with the dog, asking "what should we work on today?", and having no good answer.

## Success Criteria

### Primary

- User can track which tricks their dog knows (favorite / in-progress / finished) and successfully change status on any trick in the catalog
- User can share their profile link and another user can visit it, click "follow", and see that user's trick progress

### Secondary

- (None for MVP — scoped down to prove core tracking works first)

### Guardrails

- **UX:** Changing trick status (favorite → in-progress → finished) is immediate with a single click; no multi-step confirmation flow
- **Performance:** Catalog loads and displays all 10-15 starter tricks without noticeable delay (< 2 seconds on average connection)
- **Data integrity:** User's trick progress persists correctly across sessions; no accidental status resets or data loss

## User Stories

### US-01: User tracks their first trick

- **Given** a new user who has registered and created their profile with dog info
- **When** they browse the catalog, select a trick, and mark it as "in-progress"
- **Then** they see that trick listed under "in-progress" on their profile page, in the catalog, and in the trick's detail page

#### Acceptance Criteria

- Status change is immediate (no page refresh or confirmation dialog required)
- In-progress badge/indicator is visible in all three locations within 1 second of marking
- User can change the status again (e.g., from in-progress to finished) without navigating away

## Functional Requirements

### Authentication

- FR-001: User can register with email and password. Priority: must-have

  > Socrates: Counter-argument considered: "Email registration adds friction; magic link or OAuth-only would be faster." Resolution: kept; email/password is familiar to broad consumer market and doesn't require external OAuth dependencies for MVP.

- FR-002: User can log in with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "If we used magic links, traditional login becomes redundant." Resolution: kept; consistent with registration method; no magic link infrastructure needed for MVP.

### Profile Management

- FR-003: User can create their profile with unique login name and dog info (name, breed from dropdown, date of birth, sex, optional photo). Priority: must-have

  > Socrates: Counter-argument considered: "Unique login name creates namespace conflicts; email should be the identity." Resolution: kept; unique login name allows friendly sharing (example.com/@username) and gives users control over their public identity separate from email.

- FR-004: User can view their own profile showing dog info, owner nickname, and tricks organized by status (favorite, in-progress, finished). Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-005: User can generate and copy their own profile link to share with others. Priority: must-have
  > Socrates: Counter-argument considered: "If usernames are unique, couldn't users just type example.com/@username? Link generation is redundant." Resolution: kept with clarification; show the profile URL and allow copying to clipboard for easy sharing.

### Trick Catalog

- FR-006: User can browse the trick catalog as a flat list. Priority: must-have

  > Socrates: Counter-argument considered: "With only 10-15 tricks, detail pages are over-engineering." Resolution: kept; detail pages are essential because they contain step-by-step teaching descriptions that users need to learn the trick.

- FR-007: User can view trick detail pages. Priority: must-have

  > Socrates: Detail pages must have step-by-step descriptions of the trick — this is where users learn how to teach it. Essential to product value.

- FR-008: User can mark a trick as favorite. Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-009: User can mark a trick as in-progress. Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-010: User can mark a trick as finished. Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-011: User can change trick status directly from catalog preview. Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-012: User can change trick status from trick detail page. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Following & Social

- FR-013: User can visit another user's profile via a shared link. Priority: must-have

  > Socrates: Counter-argument considered: "Following without a feed means users manually visit profiles — limited value." Resolution: kept with clarification; following in MVP is simplified to profile bookmarks (users save profiles they want to check back on). Feed aggregation comes in v2.

- FR-014: User can follow another user's profile. Priority: must-have

  > Socrates: See FR-013; following is profile bookmarking for MVP.

- FR-015: User can view list of profiles they follow in Friends tab. Priority: must-have

  > Socrates: See FR-013; this is the bookmark list.

- FR-016: User can view list of their followers in Friends tab. Priority: must-have

  > Socrates: See FR-013; knowing who follows you creates reciprocity even without a feed.

- FR-017: User can view followed users' trick progress on their profiles. Priority: must-have
  > Socrates: See FR-013; users manually visit bookmarked profiles to see progress.

### Admin Capabilities

- FR-018: Admin can add tricks to the catalog (with step-by-step teaching descriptions). Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-019: Admin can edit tricks in the catalog. Priority: must-have

  > Socrates: No counter-argument; it stands as written.

- FR-020: Admin can remove tricks from the catalog. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Non-Functional Requirements

- **Response timing**: Trick status changes (favorite/in-progress/finished) appear reflected in the UI within 500 milliseconds of user action, without requiring page refresh. Catalog sections load progressively without blocking user interaction.

- **Privacy**: Any user with a profile link can view that profile and its trick progress. Profiles are not publicly listed or searchable, but shared links grant full read access.

- **Accessibility**: The app must be usable on all modern browsers (latest 2 major versions of Chrome, Firefox, Safari, Edge) and is optimized for mobile devices first — touch targets, readable text, responsive layout.

- **Data persistence**: User's trick progress (status changes, progress score) persists immediately upon update and remains indefinitely until the user explicitly changes or deletes it. No automatic resets or data expiration.

## Business Logic

**The app calculates a weighted training progress score where each finished trick contributes points based on its difficulty (beginner = 1, intermediate = 2, advanced = 3).**

The catalog is organized into three static difficulty sections (⭐ beginner, ⭐⭐ intermediate, ⭐⭐⭐ advanced) curated by Admin. Each trick is assigned to exactly one section based on its difficulty level. The progress score aggregates the user's finished tricks: every trick marked "finished" adds its difficulty weight to the user's total score. The score is displayed on the user's profile and updates immediately when a trick status changes to "finished".

Users encounter the score on their profile page as a single number representing their accumulated training progress. The score does not decay, reset, or expire — it only increases as the user completes more tricks.

## Access Control

Users authenticate via login (email/password or OAuth). Three roles:

- **Admin** — can manage the trick catalog (create, edit, remove tricks available to all users)
- **Regular user** (default) — can track their own dog's trick progress, follow other users (one-way, no friend request needed), and see followed users' progress by visiting their profiles
- Following is one-way (like Twitter/Instagram) — User A can follow User B without reciprocation

The smallest MVP access model: regular users track progress and can optionally follow others to see their progress by visiting their profiles. Admin role exists to curate the trick catalog, keeping it high-quality and domain-focused.

## Non-Goals

This MVP explicitly avoids the following to keep scope tight:

- **Aggregated feed**: Users manually visit followed profiles to see progress. An auto-updating feed that surfaces friends' activity is deferred to v2. Rationale: feed generation adds complexity (filtering, ordering, pagination) that isn't needed to prove tracking + following works.

- **Leaderboards or competitive features**: The progress score is personal only; no rankings, no public leaderboards, no comparison with other users. Rationale: competition can add engagement at scale (10k+ users noted as future direction), but MVP focuses on personal tracking motivation first.

### Scale insight

At 100x scale (10,000 users instead of 100), the product would need a larger trick catalog and leaderboards/competitive features to maintain engagement. The core weighted scoring rule would remain, but social competition becomes load-bearing.

## Open Questions

(None — all required signals present in input)
