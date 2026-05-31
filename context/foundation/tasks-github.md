---
title: GitHub Issues - Task Management Summary
project: Dog Trick Tracker
created: 2026-05-25
source: context/foundation/roadmap.md
milestone: MVP
---

# GitHub Issues Summary

Roadmap migrated to GitHub Issues on 2026-05-25. All 7 roadmap items (F-01, F-02, S-01–S-05) are now tracked as GitHub issues under the [MVP milestone](https://github.com/olkapolka/dog-trick-tracker/milestone/1).

## Quick Links

- **Repository**: https://github.com/olkapolka/dog-trick-tracker
- **Milestone**: [MVP](https://github.com/olkapolka/dog-trick-tracker/milestone/1)
- **All Issues**: https://github.com/olkapolka/dog-trick-tracker/issues

## Issue Mapping

| Roadmap ID | Issue                                                           | Title                                                    | Labels                                                  | Status                                | Ready?     |
| ---------- | --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- | ---------- |
| F-01       | [#6](https://github.com/olkapolka/dog-trick-tracker/issues/6)   | Database schema & migrations for users, profiles, tricks | `type: foundation` `status: ready`                      | No blockers                           | ✅ Yes     |
| F-02       | [#7](https://github.com/olkapolka/dog-trick-tracker/issues/7)   | Seed starter trick catalog (10-15 tricks)                | `type: foundation` `status: proposed`                   | Depends on #6                         | ⏳ No      |
| S-01       | [#8](https://github.com/olkapolka/dog-trick-tracker/issues/8)   | User can track their first trick (north star)            | `type: slice` `status: proposed` `priority: north-star` | Depends on #6, #7                     | ⏳ No      |
| S-02       | [#9](https://github.com/olkapolka/dog-trick-tracker/issues/9)   | User can share their profile link                        | `type: slice` `status: proposed`                        | Depends on #8                         | ⏳ No      |
| S-03       | [#10](https://github.com/olkapolka/dog-trick-tracker/issues/10) | User can view another user's profile and progress        | `type: slice` `status: proposed`                        | Depends on #9                         | ⏳ No      |
| S-04       | [#11](https://github.com/olkapolka/dog-trick-tracker/issues/11) | User can follow users and see relationships              | `type: slice` `status: proposed`                        | Depends on #10                        | ⏳ No      |
| S-05       | [#12](https://github.com/olkapolka/dog-trick-tracker/issues/12) | Admin can manage trick catalog                           | `type: admin` `status: blocked`                         | Depends on #6, #7 + admin role design | 🚧 Blocked |

## Labels

### Type Labels

- **`type: foundation`** (green #0E8A16) — Foundational schema/data work (F-01, F-02)
- **`type: slice`** (blue #1D76DB) — User-facing vertical slices (S-01–S-04)
- **`type: admin`** (purple #5319E7) — Admin/management features (S-05)

### Status Labels

- **`status: ready`** (green #0E8A16) — Ready for `/10x-plan` (F-01)
- **`status: proposed`** (yellow #FBCA04) — From roadmap, not yet started (F-02, S-01–S-04)
- **`status: blocked`** (red #D93F0B) — Blocked by unknowns or dependencies (S-05)

### Priority Labels

- **`priority: north-star`** (red #B60205) — North star slice (S-01 only)

## Dependency Graph

```
F-01 (Database schema)
  ├─► F-02 (Seed catalog)
  │     ├─► S-01 (Track first trick) 🌟
  │     │     └─► S-02 (Share profile link)
  │     │           └─► S-03 (View other profiles)
  │     │                 └─► S-04 (Follow relationships)
  │     │
  │     └─► S-05 (Admin catalog CRUD) 🚧 BLOCKED
  │
  └─► S-01 (Track first trick) 🌟
        └─► (continues as above)
```

## Execution Order

### Stream A: User Tracking & Social (Priority)

1. **[#6 F-01](https://github.com/olkapolka/dog-trick-tracker/issues/6)** — Database schema ✅ **START HERE**
2. **[#7 F-02](https://github.com/olkapolka/dog-trick-tracker/issues/7)** — Seed catalog
3. **[#8 S-01](https://github.com/olkapolka/dog-trick-tracker/issues/8)** — Track first trick 🌟 (North star)
4. **[#9 S-02](https://github.com/olkapolka/dog-trick-tracker/issues/9)** — Share profile link
5. **[#10 S-03](https://github.com/olkapolka/dog-trick-tracker/issues/10)** — View other profiles
6. **[#11 S-04](https://github.com/olkapolka/dog-trick-tracker/issues/11)** — Follow relationships

### Stream B: Admin Features (Parallel after F-02)

- **[#12 S-05](https://github.com/olkapolka/dog-trick-tracker/issues/12)** — Admin catalog CRUD
  - 🚧 **BLOCKED**: Requires decision on admin role assignment mechanism
  - Can run in parallel with Stream A after F-01, F-02 complete

## Next Steps

### Immediate Action

1. **Start with [#6 Database schema](https://github.com/olkapolka/dog-trick-tracker/issues/6)**
   ```bash
   /10x-plan database-schema
   ```
2. Issue includes full context (outcome, PRD refs, unknowns, risk)
3. No blockers — ready to implement

### After #6 Complete

- Close issue #6
- Update dependencies in #7 (uncheck `- [ ] #6` task)
- Move to #7 (seed catalog)

### Tracking Progress

- **Milestone view**: https://github.com/olkapolka/dog-trick-tracker/milestone/1
- **Task lists in issues**: Check boxes in Prerequisites section link to dependencies
- **Labels**: Filter by `status: ready` to see unblocked work

## Issue Structure

Each issue contains:

1. **Outcome** — User-facing result from roadmap
2. **Prerequisites** — Clickable task list linking to prerequisite issues (e.g., `- [ ] #6 Database schema`)
3. **PRD References** — FR-XXX and other PRD section references
4. **Unknowns** — Open questions with owner and blocking status
5. **Risk** — Risk assessment from roadmap
6. **Implementation Notes** — Roadmap ID and Change ID for `/10x-plan` handoff

## Blockers & Unknowns

### S-05 (Issue #12) — BLOCKED

**Unknown**: How is admin role assigned to users?

- PRD declares Admin role exists but doesn't specify assignment mechanism
- Options: database boolean flag, hardcoded email allowlist, Supabase JWT claim, manual SQL
- **Owner**: User/team decision required
- **Impact**: Can't build admin UI without knowing who gets access and how to verify it

### Other Unknowns (Non-blocking)

- **F-01**: Breed as dropdown enum vs. user text → **Resolved** (PRD says dropdown, use fixed enum)
- **F-02**: Which 10-15 tricks to include → **Non-blocking** (any common tricks work for MVP)
- **S-01**: Profile creation timing (wizard vs. separate step) → **Non-blocking** (implementation detail)
- **S-03**: 404 handling for non-existent usernames → **Non-blocking** (standard 404 page)
- **S-04**: Limit on follow count → **Non-blocking** (no limit for MVP)

## GitHub CLI Commands

### View Issues

```bash
# List all open issues
gh issue list --repo olkapolka/dog-trick-tracker

# View specific issue
gh issue view 6 --repo olkapolka/dog-trick-tracker --web

# Filter by label
gh issue list --repo olkapolka/dog-trick-tracker --label "status: ready"

# View milestone progress
gh issue list --repo olkapolka/dog-trick-tracker --milestone "MVP"
```

### Update Issues

```bash
# Close completed issue
gh issue close 6 --repo olkapolka/dog-trick-tracker --comment "Completed via #PR_NUMBER"

# Add comment
gh issue comment 6 --repo olkapolka/dog-trick-tracker --body "Starting implementation"

# Change labels
gh issue edit 7 --repo olkapolka/dog-trick-tracker --remove-label "status: proposed" --add-label "status: ready"
```

## Integration with 10x Workflow

1. **Issue → Implementation Plan**
   - Each issue includes `Change ID` (e.g., `database-schema`)
   - Run `/10x-plan <change-id>` to generate implementation plan
   - Implementation plan lands in `context/changes/<change-id>/`

2. **Track in Both Places**
   - GitHub Issues = external backlog (team visibility, dependency tracking)
   - `context/foundation/roadmap.md` = source of truth for product sequencing
   - `context/changes/` = implementation artifacts per change

3. **Completion Workflow**
   - Complete implementation in `context/changes/<change-id>/`
   - Archive change with `/10x-archive <change-id>`
   - Close corresponding GitHub issue
   - Uncheck or close dependent issue task lists

## Historical Context

**Issues #1-5**: Closed issues from earlier project work (May 20-21, 2026)

- Module 1 course work: bootstrap, config, deployment setup
- Not related to current roadmap
- New roadmap issues start at #6

**Issues #6-12**: Current MVP roadmap (created May 25, 2026)

- Derived from `context/foundation/roadmap.md` v1
- Aligned with PRD v1
- All assigned to MVP milestone
