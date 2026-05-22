---
project: dog-trick-tracker
created_at: 2026-05-21
completed_at: 2026-05-22
plan_type: deployment
status: completed
deployment_target: Cloudflare Workers
deployment_method: GitHub Actions + Wrangler CLI
production_url: https://dog-trick-tracker.oliwia-achyna.workers.dev
context_type: change
---

# Deployment Plan: Cloudflare Pages Integration & First Deployment

This plan deploys Dog Trick Tracker to Cloudflare Pages with Supabase authentication. The project is 95% ready — all code is edge-compatible, auth flows are correct, and the Cloudflare adapter is configured. The main work is renaming inherited template names, configuring secrets, and executing the first deploy. After manual verification, we'll add automated deployments via Cloudflare's native GitHub integration.

## Context from Research

- `wrangler.jsonc` and `package.json` still have `"10x-astro-starter"` from the template (needs rename to `"dog-trick-tracker"`)
- Secrets (`SUPABASE_URL`, `SUPABASE_KEY`) are GitHub Actions secrets for CI but not yet configured in Cloudflare Pages
- Edge runtime compatibility is ✅ verified (no Node.js filesystem APIs, uses `@supabase/ssr`, server-only env vars)
- Known constraints documented in `context/foundation/infrastructure.md`: dashboard-only logs, 500 builds/month cap, D1 not Postgres-compatible
- **Node.js v22+ required** for Wrangler CLI compatibility — run `nvm use 22` (or `nvm use` if `.nvmrc` exists) before any `npm`/`npx` command

## Phase Overview

**Required Phases (0-7):**
- **Phase 0**: Prerequisites & Environment Setup — Supabase project, local `.env`/`.dev.vars`, verify local dev works
- **Phase 1**: Pre-Flight Configuration — Fix project naming, verify production build
- **Phase 2**: Cloudflare Authentication — Wrangler CLI login
- **Phase 3**: First Manual Deployment — Deploy to Cloudflare Pages via CLI
- **Phase 4**: Configure Production Secrets — Add Supabase credentials to Cloudflare
- **Phase 5**: Production Verification — Test deployed app auth flow
- **Phase 6**: Deployment Hardening — Lock down preview deploys, configure quota limits
- **Phase 7**: Automated CI/CD — Connect GitHub for auto-deploy on push to `master`

**Optional Phase:**
- **Phase 8**: Operational Readiness — Rollback procedures, monitoring, log drains

**Estimated Time:**
- Phases 0-7 (first-time): ~2-3 hours (includes account creation, waiting for builds)
- Phases 0-7 (if accounts exist): ~45-60 minutes
- Phase 8: ~30-60 minutes (depends on monitoring service chosen)

---

## Phase 0: Prerequisites & Environment Setup

**Goal:** Set up Supabase project and local development environment before deployment

### Part A: Supabase Project Setup

Choose **Option 1** (Cloud) for production deployment or **Option 2** (Local) for development-only.

#### Option 1: Supabase Cloud Project (Recommended for Production)

- [x] **0.1** Create Supabase cloud project:
  - Visit https://supabase.com/dashboard
  - Sign in or create free account
  - Click **"New Project"**
  - Fill in:
    - **Organization**: Select or create
    - **Project Name**: `dog-trick-tracker` (or your choice)
    - **Database Password**: Generate strong password (save this securely)
    - **Region**: Choose closest to your users (e.g., `us-east-1`, `eu-central-1`)
  - Click **"Create new project"**
  - Wait 2-3 minutes for provisioning

- [x] **0.2** Get Supabase credentials:
  - In Supabase dashboard, go to **Project Settings** (gear icon)
  - Navigate to **API** section
  - Copy the following:
    - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
    - **anon public** key (long JWT token starting with `eyJ...`)
  - **Important**: Use the **anon** key, NOT the service_role key (service_role bypasses Row Level Security)

- [x] **0.3** Configure authentication settings:
  - Project Settings → **Authentication** → **Email Auth**
  - Enable **"Enable email confirmations"** for production (disable for quick testing)
  - Enable **"Enable email signup"**
  - Configure email templates (optional, can use defaults)
  - For testing without email: disable confirmations, or use Supabase dashboard → Authentication → Users to manually verify users

#### Option 2: Supabase Local Development (Docker Required)

- [ ] **0.1** Verify Docker is running:
  ```bash
  docker --version
  # Should output: Docker version 20.x or higher
  docker ps
  # Should connect without errors
  ```
  - If Docker not installed: Download from https://www.docker.com/products/docker-desktop

- [ ] **0.2** Start local Supabase:
  ```bash
  npx supabase start
  ```
  - First run downloads Docker images (~2-3 minutes)
  - Outputs local credentials to terminal:
    - **API URL**: `http://127.0.0.1:54321`
    - **anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long token)
    - **service_role key**: (don't use for client code)
  - **Copy these credentials** for next step

- [ ] **0.3** Access local Supabase Studio:
  - Open browser to `http://127.0.0.1:54323`
  - Local dashboard for managing users, tables, auth settings
  - **Note**: Local Supabase resets on `npx supabase stop` — use `npx supabase db dump` to preserve data

### Part B: Local Environment Configuration

- [x] **0.4** Create `.env` file for local development:
  ```bash
  cp .env.example .env
  ```
  - Open `.env` in editor
  - Fill in Supabase credentials from 0.2 or 0.2 (local):
    ```bash
    SUPABASE_URL=https://your-project.supabase.co  # or http://127.0.0.1:54321 for local
    SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # anon key
    ```
  - Save file
  - **Verify `.env` is in `.gitignore`** (should already be gitignored)

- [x] **0.5** Create `.dev.vars` file for Cloudflare local testing:
  ```bash
  cp .env.example .dev.vars
  ```
  - Open `.dev.vars` in editor
  - Fill in same Supabase credentials:
    ```bash
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    ```
  - **Why separate files?** Astro reads `.env`, Wrangler reads `.dev.vars`
  - **Verify `.dev.vars` is in `.gitignore`** (should already be gitignored)

### Part C: Dependencies & Cloudflare CLI Setup

**⚠️ Node.js Requirement:** This project requires Node.js v22+ for Wrangler CLI compatibility. Before running any `npm` or `npx` commands below, ensure the correct Node version is active:
```bash
nvm use 22
# or if .nvmrc exists:
nvm use
# Verify version:
node --version  # Should show v22.x.x or higher
```

- [x] **0.6** Install project dependencies:
  - ```bash
  npm install
  ```
  - Installs Astro, Supabase client, Cloudflare adapter, and Wrangler CLI
  - Expected output: `added XXX packages` with no errors
  - This includes `wrangler` as devDependency

- [x] **0.7** Verify Wrangler CLI is available:
  ```bash
  npx wrangler --version
  ```
  - Should output: `⛅️ wrangler 4.90.0` (or similar)
  - If not available: run `npm install` again

- [ ] **0.8** (Optional) Install Wrangler globally for convenience:
  ```bash
  npm install -g wrangler
  ```
  - Allows running `wrangler` instead of `npx wrangler`
  - Not required, but makes commands shorter

### Part D: Verify Local Development Works

- [x] **0.9** Test Astro dev server:
  ```bash
  npm run dev
  ```
  - Expected output: `🚀 astro  v6.0.0-beta.11 started in XXXms`
  - Open browser to `http://localhost:4321`
  - Homepage should load without "Config Error" banner
  - If config error shows: re-check `.env` file has correct credentials
  - Stop server: `Ctrl+C`

- [x] **0.10** Test authentication flow locally:
  - Start dev server: `npm run dev`
  - Navigate to `http://localhost:4321/auth/signup`
  - Create test account with email + password
  - For **cloud Supabase**: check email for confirmation link (or disable confirmations in settings)
  - For **local Supabase**: user auto-confirmed, open `http://127.0.0.1:54323` → Authentication → Users to verify
  - Sign in at `http://localhost:4321/auth/signin`
  - Verify redirect to `/dashboard` succeeds
  - If this works, Supabase integration is correctly configured ✅

### Edge Case Support

- **If any `npm` or `npx` command fails with module errors**: Ensure Node.js v22+ is active by running `nvm use 22` first, then retry the command
- **If `npx supabase start` fails with "Docker daemon not running"**: Start Docker Desktop application, wait for it to fully load, then retry
- **If port 54321 already in use**: Another Supabase instance is running. Run `npx supabase stop` then `npx supabase start` again
- **If `.env` exists but `npm run dev` shows config error**: Check for typos in variable names (must be exactly `SUPABASE_URL` and `SUPABASE_KEY`), ensure no quotes around values, ensure file is saved
- **If signup succeeds but user can't sign in**: Check Supabase dashboard → Authentication → Users → verify user exists and `email_confirmed_at` is set (if confirmations enabled, user must click email link first)
- **If sign-in redirects to `/auth/signin` in a loop**: Cookie issue. Clear browser cookies for localhost, ensure `SUPABASE_KEY` is the **anon** key (not service_role)
- **If you need to switch from local to cloud Supabase later**: Just update `.env` and `.dev.vars` with cloud credentials, restart dev server. Database schema changes require migration (see `supabase/` folder)
- **If Cloudflare deploy will use different Supabase than local dev**: Acceptable pattern — use local Supabase for dev, cloud Supabase for production. Set cloud credentials in Cloudflare Pages environment variables (Phase 4)

---

## Phase 1: Pre-Flight Configuration

**Goal:** Fix naming and verify local build before touching Cloudflare

**Prerequisites:** Phase 0 complete (Supabase configured, `.env` and `.dev.vars` exist, `npm install` run)

- [x] **1.1** Update project name in `wrangler.jsonc` line 3 from `"10x-astro-starter"` to `"dog-trick-tracker"`
- [x] **1.2** Update project name in `package.json` line 2 to `"dog-trick-tracker"` for consistency
- [x] **1.3** Run `npm run build` locally to verify build succeeds with current configuration
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
- [x] **2.2** Authenticate with Cloudflare: `wrangler login`
  - Opens browser for OAuth flow
  - Grants access to Cloudflare account
- [x] **2.3** Verify authentication: `wrangler whoami`
  - Expected output: `"You are logged in with an OAuth Token..."` + email + account ID
  - **Copy the Account ID** — needed for reference later

### Edge Case Support

- **If `wrangler login` fails with "Could not open browser"**: Manually visit the URL printed in terminal
- **If no Cloudflare account exists**: Create free account at https://dash.cloudflare.com/sign-up before running `wrangler login`
- **If authentication succeeds but `wrangler whoami` shows wrong account**: Run `wrangler logout` then `wrangler login` again

---

## Phase 3: First Manual Deployment

**Goal:** Create Cloudflare Pages project and deploy initial version

- [x] **3.1** Build production bundle: `npm run build`
  - Outputs to `./dist` (verified in Phase 1)
- [x] **3.2** Deploy to Cloudflare Pages: `npx wrangler pages deploy ./dist --project-name dog-trick-tracker`
  - First deploy creates the Pages project automatically
  - Prompts for confirmation: production branch = `main` or `master` (choose `master` per `.github/workflows/ci.yml`)
  - Outputs deployment URL: `https://dog-trick-tracker.pages.dev` (or auto-generated subdomain if name taken)
- [x] **3.3** **Copy the deployment URL** from terminal output for testing in Phase 4
  - **Deployed at**: https://b862f1e6.dog-trick-tracker.pages.dev

### Edge Case Support

- **If project name `dog-trick-tracker` is already taken**: Cloudflare assigns random suffix like `dog-trick-tracker-abc.pages.dev`. Accept this for MVP or choose different project name in `wrangler.jsonc` (e.g., `dog-trick-tracker-oliwia`)
- **If deploy fails with "Missing required field: compatibility_date"**: This shouldn't happen (already set in `wrangler.jsonc`), but if it does, add `--compatibility-date=2026-05-08` to deploy command
- **If deploy succeeds but Pages project doesn't appear in Cloudflare dashboard**: Wait 30 seconds for propagation, then refresh dashboard under Workers & Pages → Overview

---

## Phase 4: Configure Production Secrets

**Goal:** Add Supabase credentials to Cloudflare Pages environment variables

**⚠️ Critical:** The deployment from Phase 3 will be live but non-functional until these secrets are set. Auth will fail because the app can't connect to Supabase.

**⚠️ Production Note:** If you used local Supabase (Phase 0 Option 2) for development, you MUST create a cloud Supabase project for production deployment. Local Supabase (`http://127.0.0.1:54321`) is not accessible from Cloudflare's edge network. Use Phase 0 Option 1 to create a cloud project and get production credentials.

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

- [x] **4.1** Set production secrets via Wrangler:
  ```bash
  npx wrangler pages secret put SUPABASE_URL --project-name dog-trick-tracker
  # Paste Supabase URL when prompted, press Enter
  npx wrangler pages secret put SUPABASE_KEY --project-name dog-trick-tracker
  # Paste Supabase anon key when prompted, press Enter
  ```
- [ ] **4.2** Repeat for preview environment if needed: add `--env preview` flag to each command
- [x] **4.3** Redeploy: `npx wrangler pages deploy ./dist --project-name dog-trick-tracker`
  - **New deployment URL**: https://f49d57ff.dog-trick-tracker.pages.dev

### Edge Case Support

- **If you don't have Supabase credentials**: Go to Supabase dashboard → Project Settings → API → copy "URL" and "anon public" key
- **If Supabase project doesn't exist**: Run `npx supabase start` locally (requires Docker) to spin up local Supabase, or create cloud project at https://supabase.com/dashboard
- **If redeploy after setting secrets still shows auth errors**: Verify secrets were saved by checking Cloudflare dashboard → Pages → Settings → Environment variables (values are hidden but names should appear)
- **If "secret put" fails with "Project not found"**: Ensure you deployed at least once in Phase 3 (secrets can only be set on existing projects)

---

## Phase 5: Production Verification

**Goal:** Test deployed app to confirm auth, routing, and Supabase integration work

- [x] **5.1** Open deployed URL in browser: `https://dog-trick-tracker.oliwia-achyna.workers.dev`
- [x] **5.2** Test public routes:
  - Homepage `/` loads (Welcome banner visible)
  - Sign-up page `/auth/signup` loads
  - Sign-in page `/auth/signin` loads
- [x] **5.3** Test auth flow:
  - Create new account via `/auth/signup` with test email + password
  - Check email for Supabase confirmation link (or check Supabase dashboard → Authentication → Users if email confirmation disabled)
  - Sign in via `/auth/signin` with same credentials
  - Verify redirect to `/dashboard` succeeds (protected route)
- [x] **5.4** Test protected route access:
  - While signed out, navigate to `/dashboard` directly
  - Verify redirect to `/auth/signin` (middleware protection working)
- [x] **5.5** Test sign-out:
  - Call `/api/auth/signout` endpoint (GET handler added for testing)
  - Verify redirect to homepage and `/dashboard` becomes inaccessible

### Edge Case Support

- **If homepage loads but shows "Config Error" banner**: Secrets not set or misspelled. Re-check Phase 4 steps
- **If signup succeeds but user doesn't appear in Supabase dashboard**: Verify `SUPABASE_URL` points to correct project (not local `http://127.0.0.1:54321`)
- **If email confirmation link doesn't arrive**: Check Supabase → Authentication → Settings → Email Auth → "Enable email confirmations" (may be disabled for local dev)
- **If `/dashboard` redirect fails with 500 error**: Check Cloudflare dashboard → Pages → `dog-trick-tracker` → Logs → Real-time logs for error details (note: this is **manual dashboard step**, no CLI equivalent per `infrastructure.md`)
- **If sign-in succeeds but middleware still redirects to `/auth/signin`**: Session cookie may not be set. Check browser DevTools → Application → Cookies for `sb-*` cookies. If missing, Supabase client setup issue (unlikely given code review, but verify `SUPABASE_KEY` is **anon key**, not service role key)

---

## Phase 6: Deployment Hardening (Adapted for Workers)

**Goal:** Verify security configuration and deployment protection

**Note:** This phase was adapted for Cloudflare Workers deployment instead of Pages. Workers-specific security measures applied.

- [x] **6.1** Verify production secrets configured:
  - Ran `npx wrangler secret list` - confirmed `SUPABASE_URL` and `SUPABASE_KEY` present
  - Secrets are server-side only, not exposed to client
- [x] **6.2** Verify sensitive files protected:
  - Confirmed `.env`, `.dev.vars`, and `.wrangler/` in `.gitignore`
  - Verified no sensitive files tracked by git
- [x] **6.3** Configure GitHub Actions secrets:
  - Added `SUPABASE_URL` and `SUPABASE_KEY` for CI builds
  - Added `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for automated deployments
  - All 4 secrets verified in GitHub repository settings

### Edge Case Support

- **If "Require access token" setting not available**: Feature may be account-tier-gated. Proceed without it for MVP (low risk if repo is private)
- **If build quota exceeds 500/month during development**: Either upgrade to Cloudflare Pages Paid plan ($20/month unlimited builds) or switch to manual deploys only (run `wrangler pages deploy` on-demand)
- **If preview deployments are needed for external review**: Temporarily re-enable public previews, share URL, then re-disable after review complete

---

## Phase 7: Automated CI/CD via GitHub Actions

**Goal:** Set up automated deployment to Cloudflare Workers on push to `main`

**Note:** Implemented using GitHub Actions + Wrangler CLI instead of Cloudflare GitHub integration (simpler for Workers deployment).

**Prerequisites:** Phases 1-6 complete, manual deploy verified working

- [x] **7.1** Create Cloudflare API token:
  - Created scoped API token at https://dash.cloudflare.com/profile/api-tokens
  - Used "Edit Cloudflare Workers" template
  - Token permissions: Workers Scripts → Edit
  
- [x] **7.2** Add GitHub secrets for deployment:
  - Added `CLOUDFLARE_API_TOKEN` - API token from step 7.1
  - Added `CLOUDFLARE_ACCOUNT_ID` - Account ID from `wrangler whoami`
  - Secrets configured at repository settings → Secrets and variables → Actions

- [x] **7.3** Create deployment workflow:
  - Created `.github/workflows/deploy.yml`
  - Workflow triggers on push to `main` branch
  - Steps: checkout → setup Node.js → install deps → build → deploy with Wrangler
  - Uses `cloudflare/wrangler-action@v3` for deployment
  - Fixed `.gitignore` to allow `.github/workflows/` to be committed

- [x] **7.4** Verify automated deployment:
  - Pushed workflow file to GitHub
  - GitHub Actions triggered Deploy workflow automatically
  - Deployment completed successfully (green checkmark)
  - Production URL updated: https://dog-trick-tracker.oliwia-achyna.workers.dev
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

## Phase 8: Operational Readiness

**Goal:** Set up monitoring and rollback procedures for production operation

- [x] **8.1** Document rollback and deployment procedures:
  - Updated `README.md` with:
    - Deployment badges (CI and Deploy workflows)
    - Production URL
    - Automated and manual deployment instructions
    - Rollback procedure using `wrangler rollback`
    - Known constraints for Cloudflare Workers
  - Created `docs/OPERATIONS.md` with comprehensive operations guide:
    - Quick reference (URLs, dashboards)
    - Daily operations procedures
    - Common issues and fixes
    - Deployment and rollback procedures
    - Secrets rotation procedures
    - Disaster recovery plan
    - Cost tracking information
- [x] **8.2** Document monitoring recommendations:
  - Included uptime monitoring setup (UptimeRobot, Better Stack)
  - Documented synthetic testing options (Checkly)
  - Log aggregation guidance (Logtail, deferred until needed)
  - Performance monitoring (Cloudflare Web Analytics)
- [x] **8.3** Fix CI workflow branch configuration:
  - Updated `.github/workflows/ci.yml` to use `main` instead of `master`
  - Ensures CI triggers correctly on repository default branch
- [x] **8.4** Document known constraints:
  - Added Cloudflare Workers limitations to README
  - Documented Supabase requirements
  - Included cost tracking and quota information in OPERATIONS.md

### Edge Case Support

- **If rollback command fails with "Deployment not found"**: Verify project name matches and deployment ID is from correct project (check via `wrangler pages deployment list`)
- **If log drain setup not available in free tier**: Accept dashboard-only logs for MVP. Cloudflare Pages → Logs → Real-time logs shows last 200 entries, sufficient for most debugging
- **If uptime monitor shows false positives (site up but alert fires)**: Check monitor request timeout (Cloudflare edge response typically < 200ms, but cold starts on Workers can take 1-2 seconds)

---

## Verification Checklist

✅ **All phases completed successfully!**

- [x] **Phase 0**: Supabase cloud project configured, `.env` and `.dev.vars` files created, local dev server works with auth
- [x] **Phases 1-7**: Project deployed to Cloudflare Workers at `https://dog-trick-tracker.oliwia-achyna.workers.dev`
- [x] Auth flow works end-to-end (signup → signin → dashboard access, email confirmations disabled for testing)
- [x] Protected routes redirect unauthenticated users to `/auth/signin`
- [x] Secrets configured in Cloudflare Workers (`SUPABASE_URL`, `SUPABASE_KEY`)
- [x] GitHub auto-deploy triggers on push to `main` (both CI and Deploy workflows)
- [x] Rollback procedure documented in README.md and docs/OPERATIONS.md
- [x] **Phase 8**: Operational documentation created, monitoring recommendations documented

**CI/CD Pipeline Verified:**
- CI workflow runs on every push/PR to `main`
- Deploy workflow automatically deploys to production on push to `main`
- Both workflows tested and passing
- Deployment badges added to README.md

---

## Decisions

- **Chose manual first deploy then automated CD** over "GitHub integration from start" — Manual deploy with `wrangler deploy` provides faster feedback loop and validates configuration before adding CI/CD complexity. Once manual deploy works, automated workflow is low-risk.

- **Chose GitHub Actions + Wrangler Action** over "Cloudflare native GitHub integration" — GitHub Actions provides more control over deployment workflow and better fits Workers deployment pattern. Cloudflare GitHub integration is primarily designed for Pages. With GitHub Actions we have explicit control over build environment, can run tests before deploy, and use the same secrets management as CI workflow.

- **Chose CLI for secret configuration** (`wrangler secret put`) over dashboard — CLI provides faster secret updates and better fits automation workflow. Secrets configured via CLI are immediately available and can be scripted for rotation procedures.

- **Chose to deploy to Cloudflare Workers** instead of "Cloudflare Pages" — While the original plan targeted Pages, Workers proved simpler for this stack (Astro SSR + Supabase). Workers deploy directly via `wrangler deploy`, have clearer secret management, and avoid Pages-specific preview deployment quota concerns.

- **Chose to defer log drain setup to Phase 8 (optional)** — Dashboard-only logs are acceptable for MVP. Cloudflare dashboard provides real-time logs for the last 200 requests, sufficient for debugging. Log drain adds operational complexity without immediate value unless debugging frequency > 1x/week.

---

## Reference Documentation

- `context/foundation/infrastructure.md` — Platform research, anti-bias cross-check, risk register
- `context/foundation/tech-stack.md` — Stack decisions (Astro + Supabase + Cloudflare)
- `README.md` — Local development setup, Supabase configuration
- `.github/workflows/ci.yml` — Existing CI pipeline (lint + build, no deploy)
