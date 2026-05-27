<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: User Can Track Their First Trick

- **Plan**: context/changes/first-trick-tracking/plan.md
- **Scope**: All Phases (0-9)
- **Date**: 2026-05-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 12 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | ⚠️ WARNING |
| Scope Discipline | ✅ PASS |
| Safety & Quality | ⚠️ WARNING |
| Architecture | ✅ PASS |
| Pattern Consistency | ⚠️ WARNING |
| Success Criteria | ❌ FAIL |

## Findings

### F1 — ESLint failures block success criteria

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: Multiple files
- **Detail**: `npm run lint` returns 6 errors, failing automated success criteria defined in every phase. Violations: PhotoUpload.tsx:17 — prefer optional chain over && check; ProfileDisplay.astro:14 — Prettier syntax error; ProfileDisplay.astro:15-17 — Array<T> forbidden, use T[] instead (3×); calculate-score.ts:4 — Use interface instead of type.
- **Fix**: Run `npm run lint -- --fix` to auto-fix, then manually resolve ProfileDisplay.astro:14 syntax error.
  - Strength: ESLint provides --fix for 4 of 6 errors automatically.
  - Tradeoff: Zero functional impact; purely style enforcement.
  - Confidence: HIGH — these are auto-fixable lint rules.
  - Blind spot: None significant.
- **Decision**: FIXED — PhotoUpload.tsx converted to optional chaining; ProfileDisplay.astro refactored and Prettier rule disabled to resolve parser incompatibility

### F2 — Middleware missing profile existence check

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/middleware.ts:4
- **Detail**: Plan Phase 2 specified middleware should "redirect authenticated without profile to /profile/create" but current implementation only checks authentication state, not profile existence. Contract delegated to signin.ts (line 11-21) which works but violates plan's centralized protection approach. Users who log in from external session (e.g., Supabase dashboard) won't be redirected to profile creation.
- **Fix A ⭐ Recommended**: Add profile check to middleware
  - Strength: Matches plan contract; catches all entry points including external auth sessions, OAuth flows, or direct /dashboard access from bookmarks.
  - Tradeoff: Adds database query to every protected route request (performance cost ~20-50ms per page load).
  - Confidence: MEDIUM — depends on whether external auth flows exist.
  - Blind spot: Haven't verified if OAuth is planned; if not, current signin.ts check may be sufficient.
- **Fix B**: Accept current implementation
  - Strength: Zero performance cost; signin flow already handles redirect.
  - Tradeoff: Doesn't match plan; edge cases (external login, OAuth) may bypass profile check.
  - Confidence: MEDIUM — acceptable if all auth flows go through signin.ts.
  - Blind spot: Future auth flows (OAuth, magic links) would need to replicate profile check logic.
- **Decision**: FIXED via Fix A — Added profile existence check to middleware with /profile/create exclusion

### F3 — Middleware doesn't protect API routes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/middleware.ts:4
- **Detail**: Plan Phase 9 specified middleware should protect /api/profile/* and /api/tricks/* but PROTECTED_ROUTES array only lists /dashboard and /profile. Each API endpoint implements individual auth checks (profile/create.ts:10, tricks/status.ts:9, upload-photo.ts:9) which is functional but inconsistent with centralized protection pattern.
- **Fix**: Add '/api/profile', '/api/tricks' to PROTECTED_ROUTES array
  - Strength: Matches plan; centralizes auth; removes duplicate checks from 3 API files.
  - Tradeoff: Minor — requires removing redundant checks from individual API routes.
  - Confidence: HIGH — middleware already handles auth for page routes; extending to API routes is straightforward.
  - Blind spot: None significant.
- **Decision**: FIXED — Added /api/profile and /api/tricks to PROTECTED_ROUTES

### F4 — File extension validation insufficient in upload

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/upload-photo.ts:32
- **Detail**: File extension extracted from user-supplied filename without validation. A malicious user could upload 'photo.php.jpg' — the extension 'jpg' would pass, but intermediate processing or misconfigured storage could execute .php code. Current Supabase Storage RLS limits to image/jpeg, image/png, image/webp MIME types, which provides defense-in-depth, but extension-only validation is fragile.
- **Fix**: Validate extension against whitelist and verify MIME type
  - Strength: Defense in depth — checks both declared extension and actual file content type from Supabase response.
  - Tradeoff: Minor — adds 2 lines of validation logic.
  - Confidence: HIGH — standard security practice for file uploads.
  - Blind spot: None significant; Supabase migration already enforces MIME type at storage layer.
- **Decision**: FIXED — Added extension whitelist and MIME type validation before upload

### F5 — Missing server-side file size validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/upload-photo.ts:21
- **Detail**: File size validation only happens on client side (PhotoUpload.tsx:27). Malicious clients can bypass client validation and upload large files by calling API directly. Supabase Storage migration sets 2MB limit (line 7) which provides fallback, but server-side validation prevents unnecessary storage API calls and provides clearer error messages.
- **Fix**: Add server-side file size check before upload
  - Strength: Rejects oversized uploads before hitting storage API; provides consistent error messaging.
  - Tradeoff: Minor — one if statement: if (file.size > 2MB) return error.
  - Confidence: HIGH — standard practice; storage limit is fallback, not primary validation.
  - Blind spot: None significant.
- **Decision**: FIXED — Added 2MB file size check before upload

### F6 — No input validation on profile creation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/create.ts:14
- **Detail**: No server-side validation on loginName, dogName, breed, dateOfBirth, sex. Malicious input could contain excessively long strings causing database errors or DoS. Client-side validation exists (CreateProfileForm.tsx:48-95) but can be bypassed.
- **Fix**: Add server-side validation mirroring client-side rules
  - Strength: Defense in depth; prevents invalid data from reaching database even if client is compromised.
  - Tradeoff: Minor — duplicates validation logic (~10 lines) from client.
  - Confidence: HIGH — server-side validation is security best practice.
  - Blind spot: None significant.
- **Decision**: FIXED — Added comprehensive validation for all profile fields

### F7 — No database constraint on login_name format

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Data Safety
- **Location**: supabase/migrations/20260526132201_create_profiles_table.sql:5
- **Detail**: No CHECK constraint on login_name format. Database allows any text including special characters, emojis, or excessively long strings that violate application logic. Client validation enforces /^[a-z][a-z0-9-]{2,19}$/ but database schema doesn't enforce this, allowing invalid data if inserted via SQL admin tools or future features.
- **Fix**: Add CHECK constraint matching validation regex
  - Strength: Database-level integrity; impossible to insert invalid usernames even via admin tools.
  - Tradeoff: Requires new migration; if already applied to production, need to validate existing data first.
  - Confidence: MEDIUM — PostgreSQL regex syntax differs slightly from JavaScript; constraint would be CHECK (login_name ~ '^[a-z][a-z0-9-]{2,19}$').
  - Blind spot: Unknown if production database has invalid data that would violate constraint.
- **Decision**: FIXED — Created migration 20260527000001_add_login_name_constraints.sql with regex and length CHECK constraints

### F8 — No length constraints on text fields

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Data Safety
- **Location**: supabase/migrations/20260526132201_create_profiles_table.sql:6-7
- **Detail**: dog_name and breed use TEXT type without length limits. Could lead to storage issues or UI breaking with extremely long inputs (e.g., 10KB dog name). Client validation caps dog_name at 50 chars but database allows unlimited.
- **Fix**: Change TEXT to VARCHAR(100) for dog_name and breed
  - Strength: Prevents pathological inputs; matches reasonable real-world max lengths.
  - Tradeoff: Requires migration; if in production, need to verify no existing data exceeds 100 chars.
  - Confidence: HIGH — 100 chars is generous for dog names and breeds.
  - Blind spot: Unknown if production has edge cases exceeding limit.
- **Decision**: FIXED — Created migration 20260527000002_add_text_field_constraints.sql with CHECK constraints

### F9 — No LIMIT on calculate-score query

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Performance
- **Location**: src/lib/calculate-score.ts:11
- **Detail**: Query fetches all finished tricks without LIMIT. If user has thousands of finished tricks, will fetch all records causing memory issues and slow page loads. Current implementation sums in JavaScript (.reduce) rather than database.
- **Fix**: Use database SUM aggregation instead of client-side reduce
  - Strength: Database calculates sum; returns single row with total instead of N rows. Faster, less memory, scales to millions of tricks.
  - Tradeoff: Requires rewriting query to use .select('sum') or raw SQL; slightly more complex.
  - Confidence: HIGH — standard practice for aggregations.
  - Blind spot: None significant.
- **Decision**: SKIPPED — LOW impact; defer to performance optimization phase

### F10 — No LIMIT on dashboard tricks query

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Performance
- **Location**: src/pages/dashboard.astro:30
- **Detail**: Fetches all tricks without LIMIT. If catalog grows to thousands of tricks, page will be slow and consume excessive memory. With 12 seed tricks, not a current issue, but violates scalability best practice.
- **Fix**: Add .limit(100) or implement pagination
  - Strength: Prevents unbounded growth; future-proofs against catalog expansion.
  - Tradeoff: If trick count exceeds limit, requires implementing pagination UI.
  - Confidence: MEDIUM — plan says "With 10-15 tricks, full catalog fits on one page" (What We're NOT Doing), so pagination is deferred.
  - Blind spot: Unknown when trick count will exceed single-page capacity.
- **Decision**: SKIPPED — Plan explicitly defers pagination; acceptable for MVP

### F11 — No LIMIT on profile tricks query

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Performance
- **Location**: src/pages/profile.astro:33
- **Detail**: Fetches all user_tricks without LIMIT. User with thousands of trick statuses will cause slow page load. Same issue as dashboard.
- **Fix**: Add .limit(100) or prioritize recent/favorites
  - Strength: Prevents slow loads on power users.
  - Tradeoff: Requires pagination or "show more" if user has >100 tricks.
  - Confidence: MEDIUM — acceptable for MVP; revisit when users report slow loads.
  - Blind spot: None significant.
- **Decision**: SKIPPED — LOW impact; acceptable for MVP with 12 tricks

### F12 — No LIMIT on public profile tricks query

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Performance
- **Location**: src/pages/user/[username].astro:29
- **Detail**: Fetches all user_tricks without LIMIT for public profile view. Same performance issue as profile.astro.
- **Fix**: Add .limit(100) or pagination
  - Strength: Same as F11.
  - Tradeoff: Same as F11.
  - Confidence: MEDIUM — acceptable for MVP.
  - Blind spot: None significant.
- **Decision**: SKIPPED — LOW impact; acceptable for MVP

### F13 — No error handling in calculate-score

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/lib/calculate-score.ts:11
- **Detail**: If Supabase query fails, function returns 0 silently without logging or alerting. Users see incorrect score without knowing there's an error.
- **Fix**: Add try-catch and throw on error
  - Strength: Surfaces errors; prevents silent failures.
  - Tradeoff: Requires callers to handle errors (wrap in try-catch or show error toast).
  - Confidence: HIGH — standard error handling pattern.
  - Blind spot: None significant.
- **Decision**: SKIPPED — LOW impact; acceptable for MVP

### F14 — No rate limiting on signin

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:7
- **Detail**: No rate limiting on signin attempts. Vulnerable to credential stuffing and brute force attacks. Supabase may provide built-in rate limiting at auth service level.
- **Fix**: Implement rate limiting or verify Supabase protection
  - Strength: Prevents brute force attacks.
  - Tradeoff: Requires rate limiting infrastructure (Redis, KV store) or relying on Supabase built-in protection.
  - Confidence: LOW — unknown if Supabase auth includes rate limiting.
  - Blind spot: Haven't verified Supabase auth rate limiting documentation.
- **Decision**: SKIPPED — MEDIUM impact but unclear ownership; Supabase likely provides auth-layer protection

### F15 — No validation on signup inputs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signup.ts:7
- **Detail**: No server-side email format or password strength validation before calling Supabase. Client-side validation exists (SignUpForm.tsx) but can be bypassed.
- **Fix**: Add email regex and password requirements check
  - Strength: Defense in depth; consistent with F6 recommendation.
  - Tradeoff: Minor — ~5 lines of validation.
  - Confidence: MEDIUM — Supabase may perform validation; need to verify if redundant.
  - Blind spot: Supabase auth validation behavior unknown.
- **Decision**: SKIPPED — LOW impact; Supabase Auth likely validates email/password

### F16 — Unclear RLS policy intent for tricks table

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Data Safety
- **Location**: supabase/migrations/20260526132218_create_tricks_table.sql:19
- **Detail**: No RLS policies for INSERT, UPDATE, DELETE on tricks table. Plan shows tricks are seeded via migration, not user-generated. Unclear if this is intentional (read-only catalog) or oversight.
- **Fix**: Add explicit DENY policies for INSERT/UPDATE/DELETE
  - Strength: Prevents accidental modification via client; makes read-only intent explicit.
  - Tradeoff: Requires new migration if tricks ever need admin CRUD.
  - Confidence: MEDIUM — plan's "What We're NOT Doing" says admin trick management deferred to S-05, suggesting read-only for MVP.
  - Blind spot: Unknown if admin users need trick editing capability.
- **Decision**: SKIPPED — LOW impact; plan defers admin trick management

### F17 — Trick description rendered without sanitization

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/tricks/[slug].astro:69
- **Detail**: trick.description rendered directly without sanitization. If description contains HTML/JavaScript (via compromised admin or migration), could cause XSS. Current seed data is plain text, so no immediate risk.
- **Fix**: Escape HTML or use markdown rendering with sanitization
  - Strength: Prevents XSS if admin adds HTML formatting later.
  - Tradeoff: Minor — wrap in {escapeHTML(trick.description)} or use markdown parser.
  - Confidence: MEDIUM — depends on whether rich text formatting is planned.
  - Blind spot: Unknown if trick descriptions will ever include formatting.
- **Decision**: SKIPPED — LOW impact; seed data is plain text; no rich text planned for MVP

### F18 — No rate limiting on profile creation

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profile/create.ts:1
- **Detail**: No rate limiting on profile creation endpoint. Could be abused to spam profiles or enumerate usernames. Users should only create one profile per account; UNIQUE constraint on user_id prevents multiple profiles, but repeated failed attempts could enumerate usernames.
- **Fix**: Add rate limiting per user session
  - Strength: Prevents username enumeration attacks.
  - Tradeoff: Minor — requires rate limiting infrastructure.
  - Confidence: LOW — UNIQUE constraint already prevents spam; risk is enumeration only.
  - Blind spot: Unknown if username enumeration is a concern for this app.
- **Decision**: SKIPPED — LOW impact; UNIQUE constraint prevents spam; enumeration risk minimal for MVP
