# Deployment Plan: Cloudflare Pages Integration & First Deployment

This plan deploys Dog Trick Tracker to Cloudflare Pages with Supabase authentication. The project is 95% ready — all code is edge-compatible, auth flows are correct, and the Cloudflare adapter is configured. The main work is renaming inherited template names, configuring secrets, and executing the first deploy. After manual verification, we'll add automated deployments via Cloudflare's native GitHub integration.

## Context from Research

- `wrangler.jsonc` and `package.json` still have `"10x-astro-starter"` from the template (needs rename to `"dog-trick-tracker"`)
- Secrets (`SUPABASE_URL`, `SUPABASE_KEY`) are GitHub Actions secrets for CI but not yet configured in Cloudflare Pages
- Edge runtime compatibility is ✅ verified (no Node.js filesystem APIs, uses `@supabase/ssr`, server-only env vars)
- Known constraints documented in `context/foundation/infrastructure.md`: dashboard-only logs, 500 builds/month cap, D1 not Postgres-compatible

## Phase 1: Pre-Flight Configuration

**Goal:** Fix naming and verify local build before touching Cloudflare

- [ ] **1.1** Update project name in `wrangler.jsonc` line 3 from `"10x-astro-starter"` to `"dog-trick-tracker"`
- [ ] **1.2** Update project name in `package.json` line 2 to `"dog-trick-tracker"` for consistency
- [ ] **1.3** Run `npm run build` locally to verify build succeeds with current configuration
  - Expected output: `dist/` directory with static assets + SSR functions
  - If build fails on missing env vars, verify `.env` exists with Supabase credentials (copy from `.env.example`)
- [ ] **1.4** (Optional) Test local Cloudflare Pages environment: `npx wrangler pages dev ./dist`
  - Validates edge runtime compatibility before deploying
  - If Supabase calls fail, check `.dev.vars` has `SUPABASE_URL` and `SUPABASE_KEY` (not `.env` — Wrangler reads `.dev.vars` only)

### Edge Case Support

- **If `npm run build` fails with "SUPABASE_URL is not set"**: This is expected if `.env` is missing. Copy `.env.example` to `.env` and fill in actual Supabase project URL + anon key from Supabase dashboard
- **If `wrangler pages dev` shows "Cannot find module @astrojs/cloudflare"**: Run `npm install` to ensure all dependencies installed
- **If auth fails in `wrangler pages dev`**: Ensure `.dev.vars` exists (create from `.env.example`) and contains same Supabase credentials as `.env`

---

## Phase 2: Cloudflare Authentication

**Goal:** Authenticate Wrangler CLI for deployment 

- [ ] **2.1** Install Wrangler globally (if not already): `npm install -g wrangler`
  - Wrangler is already in `devDependencies`, but global install allows `wrangler` command outside npm scripts
- [ ] **2.2** Authenticate with Cloudflare: `wrangler login`
  - Opens browser for OAuth flow
  - Grants access to Cloudflare account
- [ ] **2.3** Verify authentication: `wrangler whoami`
  - Expected output: `"You are logged in with an OAuth Token..."` + email + account ID
  - **Copy the Account ID** — needed for reference later

### Edge Case Support

- **If `wrangler login` fails with "Could not open browser"**: Manually visit the URL printed in terminal
- **If no Cloudflare account exists**: Create free account at https://dash.cloudflare.com/sign-up before running `wrangler login`
- **If authentication succeeds but `wrangler whoami` shows wrong account**: Run `wrangler logout` then `wrangler login` again

---

## Phase 3: First Manual Deployment

**Goal:** Create Cloudflare Pages project and deploy initial version

- [ ] **3.1** Build production bundle: `npm run build`
  - Outputs to `./dist` (verified in Phase 1)
- [ ] **3.2** Deploy to Cloudflare Pages: `npx wrangler pages deploy ./dist --project-name dog-trick-tracker`
  - First deploy creates the Pages project automatically
  - Prompts for confirmation: production branch = `main` or `master` (choose `master` per `.github/workflows/ci.yml`)
  - Outputs deployment URL: `https://dog-trick-tracker.pages.dev` (or auto-generated subdomain if name taken)
- [ ] **3.3** **Copy the deployment URL** from terminal output for testing in Phase 4

### Edge Case Support

- **If project name `dog-trick-tracker` is already taken**: Cloudflare assigns random suffix like `dog-trick-tracker-abc.pages.dev`. Accept this for MVP or choose different project name in `wrangler.jsonc` (e.g., `dog-trick-tracker-oliwia`)
- **If deploy fails with "Missing required field: compatibility_date"**: This shouldn't happen (already set in `wrangler.jsonc`), but if it does, add `--compatibility-date=2026-05-08` to deploy command
- **If deploy succeeds but Pages project doesn't appear in Cloudflare dashboard**: Wait 30 seconds for propagation, then refresh dashboard under Workers & Pages → Overview

---

## Phase 4: Configure Production Secrets

**Goal:** Add Supabase credentials to Cloudflare Pages environment variables

**⚠️ Critical:** The deployment from Phase 3 will be live but non-functional until these secrets are set. Auth will fail because the app can't connect to Supabase.

### Option A (Dashboard — recommended for first-time)

- [ ] **4.1** Go to Cloudflare dashboard → Pages → `dog-trick-tracker` project
- [ ] **4.2** Navigate to Settings → Environment variables
- [ ] **4.3** Under **Production** tab, add:
  - Variable name: `SUPABASE_URL`, Value: `<your-supabase-project-url>` (e.g., `https://abcdefgh.supabase.co`)
  - Variable name: `SUPABASE_KEY`, Value: `<your-supabase-anon-key>`
- [ ] **4.4** Under **Preview** tab, add the same two variables (so PR previews work)
- [ ] **4.5** Redeploy to apply secrets: `npx wrangler pages deploy ./dist --project-name dog-trick-tracker`
  - Secrets only take effect on next deployment after being set

### Option B (CLI — faster for subsequent updates)

- [ ] **4.1** Set production secrets via Wrangler:
  ```bash
  npx wrangler pages secret put SUPABASE_URL --project-name dog-trick-tracker
  # Paste Supabase URL when prompted, press Enter
  npx wrangler pages secret put SUPABASE_KEY --project-name dog-trick-tracker
  # Paste Supabase anon key when prompted, press Enter
  ```
- [ ] **4.2** Repeat for preview environment if needed: add `--env preview` flag to each command
- [ ] **4.3** Redeploy: `npx wrangler pages deploy ./dist --project-name dog-trick-tracker`

### Edge Case Support

- **If you don't have Supabase credentials**: Go to Supabase dashboard → Project Settings → API → copy "URL" and "anon public" key
- **If Supabase project doesn't exist**: Run `npx supabase start` locally (requires Docker) to spin up local Supabase, or create cloud project at https://supabase.com/dashboard
- **If redeploy after setting secrets still shows auth errors**: Verify secrets were saved by checking Cloudflare dashboard → Pages → Settings → Environment variables (values are hidden but names should appear)
- **If "secret put" fails with "Project not found"**: Ensure you deployed at least once in Phase 3 (secrets can only be set on existing projects)

---

## Phase 5: Production Verification

**Goal:** Test deployed app to confirm auth, routing, and Supabase integration work

- [ ] **5.1** Open deployed URL in browser: `https://dog-trick-tracker.pages.dev` (from Phase 3.3 output)
- [ ] **5.2** Test public routes:
  - Homepage `/` loads (Welcome banner visible)
  - Sign-up page `/auth/signup` loads
  - Sign-in page `/auth/signin` loads
- [ ] **5.3** Test auth flow:
  - Create new account via `/auth/signup` with test email + password
  - Check email for Supabase confirmation link (or check Supabase dashboard → Authentication → Users if email confirmation disabled)
  - Sign in via `/auth/signin` with same credentials
  - Verify redirect to `/dashboard` succeeds (protected route)
- [ ] **5.4** Test protected route access:
  - While signed out, navigate to `/dashboard` directly
  - Verify redirect to `/auth/signin` (middleware protection working)
- [ ] **5.5** Test sign-out:
  - Click sign-out button on dashboard (if implemented) or call `/api/auth/signout` manually
  - Verify redirect to homepage and `/dashboard` becomes inaccessible

### Edge Case Support

- **If homepage loads but shows "Config Error" banner**: Secrets not set or misspelled. Re-check Phase 4 steps
- **If signup succeeds but user doesn't appear in Supabase dashboard**: Verify `SUPABASE_URL` points to correct project (not local `http://127.0.0.1:54321`)
- **If email confirmation link doesn't arrive**: Check Supabase → Authentication → Settings → Email Auth → "Enable email confirmations" (may be disabled for local dev)
- **If `/dashboard` redirect fails with 500 error**: Check Cloudflare dashboard → Pages → `dog-trick-tracker` → Logs → Real-time logs for error details (note: this is **manual dashboard step**, no CLI equivalent per `infrastructure.md`)
- **If sign-in succeeds but middleware still redirects to `/auth/signin`**: Session cookie may not be set. Check browser DevTools → Application → Cookies for `sb-*` cookies. If missing, Supabase client setup issue (unlikely given code review, but verify `SUPABASE_KEY` is **anon key**, not service role key)

---

## Phase 6: Deployment Hardening

**Goal:** Lock down preview deployments and prevent quota exhaustion

These are security + operational best practices from `infrastructure.md` Risk Register. Not required for functional deploy, but strongly recommended before opening repo to external contributors.

- [ ] **6.1** Enable preview deployment protection:
  - Cloudflare dashboard → Pages → `dog-trick-tracker` → Settings → Builds & deployments
  - Toggle **"Require access token for preview deployments"** to ON
  - Effect: PR preview URLs require auth token appended (e.g., `?token=xyz`), preventing public access to work-in-progress features
- [ ] **6.2** Disable fork deployments (prevents untrusted code from consuming build quota):
  - Same settings page → **"Deploy pull requests from forks"** → toggle OFF
  - Effect: Forks can't trigger automatic preview deploys (reduces risk of secret exposure if contributor commits `.env`)
- [ ] **6.3** Verify build quota settings:
  - Check current usage: Cloudflare dashboard → Pages → `dog-trick-tracker` → Analytics → Builds
  - Free tier: 500 builds/month (documented limit per `infrastructure.md`)
  - Current CI triggers on every push + PR (could hit 300+ builds/month with active dev)
  - **Note for Phase 7:** GitHub integration will limit deploys to `push` on `master` only to conserve quota

### Edge Case Support

- **If "Require access token" setting not available**: Feature may be account-tier-gated. Proceed without it for MVP (low risk if repo is private)
- **If build quota exceeds 500/month during development**: Either upgrade to Cloudflare Pages Paid plan ($20/month unlimited builds) or switch to manual deploys only (run `wrangler pages deploy` on-demand)
- **If preview deployments are needed for external review**: Temporarily re-enable public previews, share URL, then re-disable after review complete

---

## Phase 7: Automated CI/CD via Cloudflare GitHub Integration

**Goal:** Connect GitHub repo to Cloudflare Pages for auto-deploy on push to `master`

**Prerequisites:** Phases 1-5 complete, manual deploy verified working

- [ ] **7.1** Connect GitHub repository to Cloudflare Pages:
  - Cloudflare dashboard → Pages → `dog-trick-tracker` project
  - Settings → Builds & deployments → **"Connect to Git"** (or if project was created manually, delete and recreate via "Create application" → "Connect to Git")
  - Alternative path if project doesn't exist yet: Pages → Create application → Connect to Git
  - Authorize Cloudflare to access your GitHub account (one-time OAuth)
  - Select repository: `oliwia.achyna/dog-trick-tracker` (or your GitHub username/org)
  
- [ ] **7.2** Configure build settings:
  - **Production branch**: `master` (must match your default branch)
  - **Framework preset**: Astro (auto-detected)
  - **Build command**: `npm run build` (auto-populated)
  - **Build output directory**: `dist` (auto-populated)
  - **Root directory**: `/` (leave default unless monorepo)
  - Click **"Save and Deploy"**

- [ ] **7.3** Set environment variables for Cloudflare builds:
  - During setup wizard OR later via Settings → Environment variables
  - Add **Production** environment variables:
    - `SUPABASE_URL` = your Supabase project URL
    - `SUPABASE_KEY` = your Supabase anon key
  - Add same variables to **Preview** environment (for PR previews)
  - **Note:** These are separate from GitHub Actions secrets - Cloudflare builds need their own copy

- [ ] **7.4** Verify initial auto-deploy:
  - Cloudflare triggers automatic build immediately after connecting
  - Monitor: Pages → `dog-trick-tracker` → Deployments (shows build logs in real-time)
  - Wait for "Success" status (~2-3 minutes)
  - Deployment creates/updates `https://dog-trick-tracker.pages.dev`

- [ ] **7.5** Configure deployment branches (optional):
  - Settings → Builds & deployments → **"Configure Production deployments"**
  - Production branch: `master` only (already set in 7.2)
  - Preview deployments: Enable for **all other branches** (or disable to conserve quota)
  - Preview deployments for **pull requests**: Enable (or disable per Phase 6 security guidance)

- [ ] **7.6** Test auto-deploy workflow:
  - Make trivial change to `src/pages/index.astro` (e.g., edit welcome text)
  - Commit and push to `master`:
    ```bash
    git add src/pages/index.astro
    git commit -m "Test Cloudflare auto-deploy"
    git push origin master
    ```
  - Cloudflare dashboard → Pages → Deployments should show new build starting within seconds
  - Wait for completion, verify change appears at deployed URL

### Edge Case Support

- **If repository not visible during GitHub connection**: Click "Add account" to expand GitHub org/account permissions, or check Cloudflare GitHub App permissions at https://github.com/settings/installations (ensure Cloudflare Pages has access to the repo)

- **If build fails with "SUPABASE_URL is not set"**: Environment variables from Step 7.3 are missing. Go to Settings → Environment variables, verify both variables exist under **Production** tab (not just Preview)

- **If deployment succeeds but site shows old version**: Wait 30-60 seconds for CDN propagation, then hard refresh (Cmd+Shift+R). If still old, check Pages → Deployments → latest deployment → "Visit site" link to bypass DNS cache

- **If you want to keep manual deploys via `wrangler pages deploy` AND GitHub auto-deploy**: They're compatible! GitHub integration handles commits pushed to GitHub, `wrangler` handles manual deploys. Both update the same Pages project. Just ensure project name in `wrangler.jsonc` matches Cloudflare project name.

- **If build quota concerns (500/month cap)**: 
  - Option A: Disable preview deployments for branches (only deploy `master`)
  - Option B: Disable "Deploy pull requests from forks" (Phase 6.2)
  - Option C: Monitor usage at Pages → `dog-trick-tracker` → Analytics → Builds
  - With `master`-only deploys + no fork PRs, typical usage is 50-100 builds/month (well under cap)

- **If you need build secrets different from runtime secrets**: Cloudflare Pages environment variables in Step 7.3 are available during **both** build time (npm run build) and runtime (SSR requests). If you need build-only secrets (e.g., `GITHUB_TOKEN` for fetching private dependencies), add them as environment variables but don't reference in server code.

- **If auto-deploy stops working**: Check GitHub webhook health at GitHub repo → Settings → Webhooks → `https://api.cloudflare.com/webhooks/...` should have green checkmarks for recent deliveries. If webhook is broken, reconnect GitHub integration via Cloudflare dashboard → Pages → Settings → Builds & deployments → "Reconnect repository"

---

## Phase 8: Operational Readiness (Optional)

**Goal:** Set up monitoring and rollback procedures for production operation

These are post-MVP improvements. Deploy works without them, but they reduce mean-time-to-recovery for production incidents.

- [ ] **8.1** Document rollback procedure for team:
  - Create `docs/runbook.md` or add to `README.md`:
    ```markdown
    ## Rollback Procedure
    1. List recent deployments: `npx wrangler pages deployment list dog-trick-tracker`
    2. Copy deployment ID of last known-good version
    3. Rollback: `npx wrangler pages deployment rollback dog-trick-tracker --deployment-id <id>`
    4. Verify rollback at https://dog-trick-tracker.pages.dev (takes ~10 seconds)
    5. If database migration was included in bad deploy, check Supabase dashboard for schema state
    ```
- [ ] **8.2** (Optional) Configure log drain for agent-accessible logs:
  - Cloudflare Pages logs are **dashboard-only** per `infrastructure.md`
  - For agent-driven debugging, integrate third-party log service:
    - Logtail (https://betterstack.com/logtail) — free tier 1GB logs/month
    - Better Stack (same company, full observability suite)
    - Cloudflare Logpush (requires Workers Paid plan, pushes logs to S3/R2/HTTP endpoint)
  - Webhook integration: Cloudflare dashboard → Pages → `dog-trick-tracker` → Settings → Webhooks → Add webhook (if supported; verify availability)
  - Alternative: Accept manual log checks for MVP, revisit if debugging frequency > 1x/week
- [ ] **8.3** Set up uptime monitoring:
  - Use free tier of UptimeRobot, Checkly, or Better Stack Uptime
  - Monitor URL: `https://dog-trick-tracker.pages.dev/` (ping every 5 minutes)
  - Alert on 3+ consecutive failures via email or Slack
  - Optional: Add synthetic test for full auth flow (signup → signin → dashboard access)
- [ ] **8.4** Document known Cloudflare Pages constraints for team:
  - Add to `README.md` or `docs/constraints.md`:
    - Runtime logs accessible only via dashboard (no `wrangler tail` for Pages)
    - 500 builds/month cap on free tier (CI limited to `master` pushes)
    - No managed Postgres (Supabase must remain external, D1 is SQLite)
    - Middleware runs on edge (no in-memory session stores, use Supabase cookies or KV)
    - Preview deployments public by default (Phase 6 hardens this)

### Edge Case Support

- **If rollback command fails with "Deployment not found"**: Verify project name matches and deployment ID is from correct project (check via `wrangler pages deployment list`)
- **If log drain setup not available in free tier**: Accept dashboard-only logs for MVP. Cloudflare Pages → Logs → Real-time logs shows last 200 entries, sufficient for most debugging
- **If uptime monitor shows false positives (site up but alert fires)**: Check monitor request timeout (Cloudflare edge response typically < 200ms, but cold starts on Workers can take 1-2 seconds)

---

## Verification Checklist

After completing all phases:

- [ ] Project deployed to Cloudflare Pages at `https://dog-trick-tracker.pages.dev`
- [ ] Auth flow works end-to-end (signup → email confirm → signin → dashboard access)
- [ ] Protected routes redirect unauthenticated users to `/auth/signin`
- [ ] Secrets configured in Cloudflare Pages (production + preview environments)
- [ ] GitHub auto-deploy triggers on push to `master`
- [ ] Rollback procedure documented and tested (optional but recommended)

**Test the full CI/CD loop:**
1. Make trivial change to `src/pages/index.astro` (e.g., edit welcome text)
2. Commit and push to `master`
3. Verify Cloudflare Pages builds and deploys automatically
4. Visit deployed URL — change should appear within 2-3 minutes
5. Run rollback command to previous deployment, verify site reverts

---

## Decisions

- **Chose manual first deploy then automated CD** over "GitHub integration from start" — Manual deploy with `wrangler pages deploy` provides faster feedback loop and validates configuration before adding CI/CD complexity. Once manual deploy works, GitHub integration is low-risk.

- **Chose Cloudflare native GitHub integration** over "GitHub Actions + Wrangler Action" — Simpler setup, fewer secrets to manage, native integration in Cloudflare dashboard for logs and rollback UI. Existing `.github/workflows/ci.yml` continues to run lint + build checks; Cloudflare handles deployment separately.

- **Chose dashboard for initial secret configuration** over CLI — Dashboard UI provides clearer separation between Production and Preview environments, reducing risk of setting secrets in wrong environment. CLI (`wrangler pages secret put`) is documented as faster option for subsequent updates.

- **Chose to conserve build quota by limiting CD to `master` pushes** — The 500 builds/month cap and active development pace (10+ pushes/day possible) create quota risk. Deploy-on-merge policy balances automation with quota conservation. PR previews can be enabled/disabled as needed.

- **Chose to defer log drain setup to Phase 8 (optional)** — Dashboard-only logs are acceptable for 3-week MVP timeline per `infrastructure.md` recommendation ("accept manual log checks for MVP"). Log drain adds operational complexity without immediate value unless debugging frequency > 1x/week.

---

## Reference Documentation

- `context/foundation/infrastructure.md` — Platform research, anti-bias cross-check, risk register
- `context/foundation/tech-stack.md` — Stack decisions (Astro + Supabase + Cloudflare)
- `README.md` — Local development setup, Supabase configuration
- `.github/workflows/ci.yml` — Existing CI pipeline (lint + build, no deploy)
