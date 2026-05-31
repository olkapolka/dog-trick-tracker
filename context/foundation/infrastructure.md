---
project: dog-trick-tracker
researched_at: 2026-05-21
recommended_platform: Cloudflare Pages
runner_up: Railway
context_type: mvp
tech_stack:
  language: JavaScript
  framework: Astro
  runtime: Node.js + Edge
  database: PostgreSQL (Supabase)
---

## Recommendation

**Deploy on Cloudflare Pages.**

Cloudflare Pages offers a truly free tier (100k requests/day) that eliminates monthly hosting costs for this 3-week after-hours MVP, addressing the "minimize cost" priority from interview Q2. The project is already scaffolded with `@astrojs/cloudflare` adapter and `wrangler.jsonc` configuration, making Cloudflare the path of least resistance. The platform is fully managed/serverless (no OS patching, automatic TLS, edge CDN), and the `wrangler` CLI provides stable deploy, rollback, and local dev workflows. While Pages lacks CLI log tailing and an official MCP server, the cost savings and existing project setup outweigh these gaps for an MVP targeting low-to-medium traffic with external Supabase handling auth and database.

## Platform Comparison

### Full Scoring Matrix

| Platform             | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Cost (10k-100k req/month)  |
| -------------------- | --------- | ------------------ | ------------------- | ----------------- | ----------------- | -------------------------- |
| **Cloudflare Pages** | Pass\*    | Pass               | Partial             | Pass              | Partial           | **$0 (free tier)**         |
| Vercel               | Pass      | Pass               | Partial             | Pass              | Partial           | $0 (free tier)             |
| Netlify              | Partial†  | Pass               | Partial             | Pass              | Partial           | $0 (free tier, spins down) |
| Fly.io               | Pass      | Pass               | Pass                | Pass              | Pass              | $5-15                      |
| Railway              | Pass      | Pass               | Pass                | Pass              | Pass              | $5-30                      |
| Render               | Pass      | Pass               | Pass                | Pass              | Pass              | $32-55 (always-on)         |

**Key:**

- \*Cloudflare Pages: Logs are dashboard-only (no `wrangler tail` for Pages); Workers support CLI logs but Astro SSR runs on Pages context
- †Netlify: Rollback requires UI navigation; function logs accessible only via dashboard

**Hard filters applied:**

- **Persistent connections (Q1: No)** — No platforms dropped; stateless request/response architecture is compatible with all candidates
- **Tech stack (Astro + Supabase)** — All platforms support Node.js/TypeScript and Astro via official adapters; no incompatibilities found

**Soft weights applied:**

- **Cost minimization (Q2)** — Free-tier platforms (Cloudflare, Vercel, Netlify) heavily favored; paid platforms (Fly.io, Railway, Render) scored lower despite perfect agent-friendliness
- **No platform familiarity (Q3)** — No tie-breaking preference applied
- **Single-region deployment (Q4)** — Edge-native platforms (Cloudflare, Vercel, Netlify) not penalized, but global CDN benefit considered neutral
- **External providers acceptable (Q5)** — Platforms without managed Postgres (Cloudflare, Vercel, Netlify) not penalized; Supabase remains external for all candidates

### Shortlisted Platforms

#### 1. Cloudflare Pages (Recommended)

**Why it won:** Zero monthly cost at MVP scale (free tier: 100k requests/day, unlimited builds capped at 500/month), project already configured with Cloudflare adapter and `wrangler.jsonc`, fully managed edge deployment with automatic global CDN, stable `wrangler` CLI for deploy/rollback/local dev. Supabase (external) handles auth and PostgreSQL; Cloudflare focuses purely on static/SSR hosting. The cost constraint (Q2: minimize cost) and pre-existing scaffolding make this the path of least friction.

**Scoring gaps:** Pages-specific log streaming requires dashboard access (no CLI equivalent to `wrangler tail` for Workers); no official MCP server as of April 2024 (third-party community tools may exist but are unsupported). Docs available as markdown on GitHub but no `llms.txt` endpoint. These are operational inconveniences, not blockers—logs are accessible, just not via CLI, and the agent can still deploy/rollback/manage via `wrangler`.

**Known risks (detailed in Anti-Bias section):** Dashboard-dependent logging, no managed Postgres (D1 is SQLite, not a Postgres replacement), middleware must be stateless or use KV/D1 for session storage, Node.js compatibility is partial (`nodejs_compat` flag enables subset of APIs but not full filesystem access), outbound WebSocket API is beta (Durable Objects workaround is GA).

#### 2. Railway

**Why it scored second:** Perfect 5/5 on agent-friendly criteria—`railway` CLI covers full lifecycle (deploy, logs, rollback, redeploy), official Railway MCP Server (GA) with IDE integrations, docs published as markdown on GitHub with `llms.txt`, stable non-interactive deployment via `RAILWAY_TOKEN` env var, managed infrastructure with optional serverless mode and co-located PostgreSQL. The cost estimate ($5-30/month) is reasonable but non-zero, placing it behind Cloudflare's free tier when cost minimization is the top priority.

**When to choose Railway over Cloudflare:** If the anti-bias risks for Cloudflare (especially dashboard-dependent logs or Node.js compatibility gaps) prove blocking in practice, Railway offers a cleaner agent-driven experience at low monthly cost. The MCP server enables structured tool-use (project management, log queries, deployment diffs) without parsing CLI output. If the project later needs co-located Postgres (to drop Supabase), Railway provides one-click templates; Cloudflare requires external migration.

#### 3. Fly.io

**Why it scored third:** Also perfect 5/5 on agent-friendly criteria—`flyctl` CLI is comprehensive (deploy with rolling/canary/bluegreen strategies, real-time log streaming, release management for rollback), official MCP server (GA), docs on GitHub as markdown, full WebSocket and persistent connection support (GA). Estimated cost ($5-15/month) is slightly lower than Railway. Fly.io's strength is runtime flexibility (full Node.js, not edge constraints) and co-located managed Postgres (starting $29/month for production).

**When to choose Fly.io over Cloudflare or Railway:** If the app later requires long-lived server processes (e.g., background job queue, scheduled workers, WebSocket server for realtime features independent of Supabase), Fly.io's infrastructure supports it natively. The lower cost than Railway and stronger VM-based runtime make it the best "grow into production" option if the MVP proves the product and needs to scale beyond serverless constraints.

## Anti-Bias Cross-Check: Cloudflare Pages

### Devil's Advocate — Weaknesses

1. **Pages log tailing is dashboard-only** — No `wrangler tail` equivalent for Pages deployments. Debugging runtime issues (slow requests, unhandled exceptions, auth failures) requires clicking into the Cloudflare dashboard. An agent cannot autonomously investigate production logs; a human must navigate the UI, filter by time range, and export if needed. Workers have CLI log streaming, but Astro SSR runs in the Pages context, not Workers.

2. **No managed PostgreSQL** — Cloudflare offers D1 (SQLite), not Postgres. The project is locked into external Supabase indefinitely, or must undertake a breaking migration to D1 (which is not Postgres-compatible). ORM queries relying on Postgres-specific features (JSON operators, full-text search, PostGIS, foreign key cascades) won't translate to SQLite. If Supabase becomes a cost bottleneck or the team wants to consolidate infrastructure, Cloudflare cannot absorb the database layer.

3. **Middleware runs in worker context, not Node.js** — Cloudflare Workers are V8 isolates, not full Node.js environments. Session stores must use KV (key-value store, paid beyond free tier) or D1 (SQLite); in-memory session management fails because isolates are ephemeral and stateless across requests. The current middleware (`src/middleware.ts`) performs auth checks but cannot store session state in memory—it must delegate to Supabase or Cloudflare KV. Any third-party middleware assuming Node.js `global` or `process` state will break.

4. **No Node.js file system APIs** — Workers run in V8 isolates with no access to `fs`, `path.resolve()` on runtime data, or temp file writes. Static assets work only via imports or bindings (`wrangler.jsonc` `assets` config), not dynamic file creation. If a future feature requires generating PDFs, resizing images server-side, or writing logs to disk before uploading to S3, it's incompatible. The agent cannot work around this—it's a hard platform constraint.

5. **Outbound WebSocket support via native API is beta** (as of April 2024) — If the app later adds realtime features (e.g., live trick completion notifications via Supabase Realtime over WebSocket), the outbound WebSocket connection API is not GA. The Durable Objects workaround is GA but adds complexity (separate service, additional billing). This is a soft risk—Supabase client handles connections internally—but it surfaces a platform maturity gap.

### Pre-Mortem — How This Could Fail

Six months after deploying to Cloudflare Pages, the decision turned out to be a disaster. The team underestimated three critical factors:

**First, debugging production issues became a time sink.** Every user-reported bug (slow trick status updates, intermittent auth failures) required a developer to log into the Cloudflare dashboard, navigate to the Pages project, filter logs by timestamp, and export if the issue spanned hours. The agent couldn't investigate autonomously because `wrangler tail` doesn't work for Pages—only Workers. What should have been a 5-minute agent-driven log query ("show me all 5xx errors in the last hour") became a 30-minute manual dashboard trawl. Over six months, the team lost 40+ hours to clicking through UIs instead of asking the agent to fetch logs via CLI.

**Second, the "free forever" promise collapsed when the app needed operational features beyond hosting.** Cloudflare Queues (for batch operations like sending follow notifications) cost $0.40/million operations, and KV (for session storage) cost $0.50/million reads after the free tier. The MVP's charm—zero monthly hosting fees—became a pay-per-use trap that scaled costs faster than revenue. By month four, Cloudflare's bill reached $25/month (still low, but psychologically breaking the "free" promise), while Railway would have been a predictable $20/month flat with Postgres and Redis included.

**Third, the team assumed D1 (SQLite) was "good enough" if they ever dropped Supabase to consolidate infrastructure.** When Supabase's bill hit $50/month and the team considered migrating to Cloudflare D1 to stay "all-in-one," they discovered that 40% of their Postgres queries were incompatible with SQLite. JSON operators (`->`, `->>`, `@>`), full-text search (`to_tsvector`, `@@`), and foreign key cascades all failed silently in local testing and loudly in production. The cost of maintaining two database dialects (Postgres for rich queries, SQLite for caching) killed the MVP's velocity. Railway's co-located Postgres would have been $6/month and zero migration risk.

**In hindsight**, the $20/month Railway would have cost after six months is trivial compared to the 40 hours lost to dashboard-driven debugging and the engineering weeks burned on a failed D1 migration. Cloudflare Pages was the right choice for "prove the product in 3 weeks," but the wrong foundation for "operate this product for 6 months."

### Unknown Unknowns

1. **Preview deployments on forks are PUBLIC by default** — When an external contributor forks the repo and opens a pull request, Cloudflare Pages automatically deploys the PR to a public preview URL with no authentication. Secrets in `wrangler.jsonc` or environment variables **are not** exposed (Cloudflare isolates build-time secrets from public previews), but if a developer accidentally commits `.env` or hardcodes API keys in source, fork previews leak them to the internet. Mitigation: enable "Require access token for preview deployments" in Pages settings, and guard Supabase keys with server-only env schema (already configured in `astro.config.mjs`).

2. **`nodejs_compat` flag doesn't mean full Node.js** — Enabling `nodejs_compat` in `wrangler.jsonc` provides `Buffer`, `crypto`, and a subset of Node.js APIs, but many npm packages that "work in Node" fail on Workers. Packages using `process.cwd()`, `__dirname`, synchronous I/O (`fs.readFileSync`), or native modules break silently—they install without error but throw at runtime. Example: popular ORMs, PDF generators, or server-side rendering libraries may assume a full Node.js environment. Validation strategy: test every third-party dependency in `wrangler pages dev` locally before deploying, and prefer packages explicitly marked "edge-compatible" or "Cloudflare Workers compatible."

3. **Cloudflare's "unlimited" Pages builds actually cap at 500/month** — The free tier allows "unlimited builds," but the fine print caps this at 500 deployments per month per account. For solo development with 10 pushes/day, this is 300/month (safe). But if CI runs on every branch push, the team has multiple developers, or staging/preview environments each trigger builds, the cap hits without warning and builds queue indefinitely. Deployments don't fail—they just stall, and the dashboard shows "queued" with no ETA. Mitigation: configure GitHub Actions to deploy only on `push` to `main` and `pull_request` (not on every commit), and use `wrangler pages dev` for local testing instead of pushing to CI.

4. **Workers Secrets (`wrangler secret put`) don't auto-sync to Pages environment variables** — If you set a secret using `wrangler secret put SUPABASE_KEY <value>`, it writes to Workers KV, not Pages environment variables. Pages deployments read env vars from the dashboard under Pages > Settings > Environment variables (or from `.dev.vars` locally, or from `wrangler.jsonc` bindings). The two systems are separate. Easy mistake: run `wrangler secret put` assuming it propagates to Pages, then wonder why the app can't read `import.meta.env.SUPABASE_KEY` in production. Correct workflow: set secrets in Pages dashboard (Production and Preview tabs), or use `wrangler pages secret put` (not `wrangler secret put`).

5. **Regional data residency isn't guaranteed** — Cloudflare's edge network runs globally across 300+ data centers. A request from Warsaw may execute in Frankfurt, Amsterdam, or Warsaw depending on routing logic. You cannot force a deployment to stay within one jurisdiction (e.g., "EU-only for GDPR compliance"). If data residency becomes a requirement later (user records must not leave the EU), Cloudflare Pages is incompatible and the app must migrate to a platform with region-pinning (Fly.io regions, Railway EU-West, AWS eu-central-1). For this MVP (dog trick tracking, no PII beyond email handled by Supabase), it's low-risk. But it's an unknown constraint that may surface if the product scales or targets regulated industries.

## Operational Story

How Cloudflare Pages operates day-to-day for this Astro + Supabase MVP. Every answer is concrete, not categorical.

- **Preview deploys**: Every PR opened against `main` triggers an automatic preview deployment to `<branch-name>.<project-name>.pages.dev` (or custom preview subdomain if configured). Previews are public by default; enable "Require access token" in Pages dashboard settings to protect them. Fork PRs (from external contributors) deploy if "Deploy pull requests from forks" is enabled; disable this to prevent untrusted code from consuming build quota. Previews persist until the PR is closed, then Cloudflare garbage-collects them after ~30 days. No authentication required to view previews unless access token protection is toggled on.

- **Secrets**: Environment variables (Supabase URL, Supabase Anon Key) are set in Cloudflare Pages dashboard under Settings > Environment variables, with separate values for Production and Preview environments. `.dev.vars` holds local secrets (gitignored); `wrangler pages dev` reads from it automatically. Secrets defined in `astro.config.mjs` env schema (`SUPABASE_URL`, `SUPABASE_KEY`) are server-only and never exposed to client bundles. Rotation: update the secret in Pages dashboard, redeploy (Cloudflare picks up new value immediately, no deployment lag). Who can read secrets: Cloudflare account admins and members with "Edit" access to the Pages project. Agents cannot read secret values via `wrangler` CLI (no `wrangler pages secret get` command exists); secrets are write-only via dashboard or `wrangler pages secret put`.

- **Rollback**: Run `wrangler pages deployment list <project-name>` to see recent deployments with IDs and timestamps. Copy the target deployment ID, then run `wrangler pages deployment rollback <project-name> --deployment-id <id>` to revert production traffic to that version. Rollback is near-instant (Cloudflare switches edge routing within seconds). Caveat: database migrations (Supabase schema changes) don't roll back automatically—if a deploy included a breaking migration, rolling back the app code may surface compatibility errors (e.g., app expects a column that the rolled-back migration removed). Safe rollback workflow: keep Supabase migrations backward-compatible for at least one deployment cycle, or roll back the database separately via `supabase db reset --db-url <prod-url>` (destructive, requires snapshot restore).

- **Approval**: Deployments to production (`wrangler pages deploy ./dist` or GitHub Actions push to `main`) are automatic—no human gate unless configured via branch protection rules in GitHub. Destructive actions requiring human confirmation: deleting the Pages project (dashboard only), rotating Cloudflare API tokens (dashboard only), dropping a D1 database (dashboard, irreversible), purging cache globally (`wrangler pages purge-cache`, safe but invalidates CDN). Agents may deploy, redeploy, and rollback unattended. Agents should NOT delete projects, rotate primary secrets (Cloudflare API token, Supabase service role key), or execute destructive database commands without explicit human approval in chat.

- **Logs**: **Production runtime logs** (request/response, unhandled errors, console output from SSR) are accessible only via Cloudflare dashboard: Pages project > Logs > Real-time logs (stream) or Logs > Analytics (historical). No CLI equivalent (`wrangler tail` works for Workers, not Pages). To make logs agent-readable, configure a log drain (Pages supports webhook integrations to external log aggregators like Logtail, Better Stack, or AWS CloudWatch). Build logs (from CI or `wrangler pages deploy`) print to stdout/stderr and are visible in GitHub Actions logs or terminal. To fetch build logs via CLI, check Actions output: `gh run view <run-id> --log`. For runtime errors, the agent must ask the user to check Cloudflare dashboard logs, screenshot the error, or configure a third-party log integration that provides an API.

## Risk Register

For each identified risk: name, the cross-check lens that surfaced it, likelihood, impact, and a concrete mitigation step. Every risk ties back to a lens or research finding for auditability.

| Risk                                                                    | Source                             | Likelihood | Impact | Mitigation                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard-only log access blocks agent autonomy**                     | Devil's advocate                   | High       | Medium | Configure third-party log drain (e.g., Logtail, Better Stack) with API access for agent queries. Alternative: accept manual log checks for MVP; revisit if debugging frequency exceeds 1x/week.                        |
| **D1 (SQLite) not a Postgres replacement if Supabase migration needed** | Devil's advocate, Pre-mortem       | Medium     | High   | Keep Supabase as the permanent database layer, or budget for Railway/Fly.io migration if consolidation becomes necessary. Do not assume D1 is a drop-in replacement for Postgres.                                      |
| **Middleware cannot use in-memory session state**                       | Devil's advocate                   | Low        | Medium | Use Supabase auth sessions (already implemented) or Cloudflare KV for server-side session storage. Avoid third-party middleware that assumes Node.js `global` or in-process memory.                                    |
| **Node.js compatibility gaps for edge runtime**                         | Devil's advocate, Unknown unknowns | Medium     | Medium | Test all third-party dependencies in `wrangler pages dev` locally before deploying. Prefer packages marked "edge-compatible" or "Cloudflare Workers compatible." Avoid packages using `fs`, `path`, or native modules. |
| **Outbound WebSocket API is beta**                                      | Devil's advocate, Research finding | Low        | Low    | Supabase client handles WebSocket connections internally (no developer action needed). If custom WebSocket client is added later, use Durable Objects (GA) as workaround until native API reaches GA.                  |
| **Preview deployments on forks are public by default**                  | Unknown unknowns                   | Medium     | High   | Enable "Require access token for preview deployments" in Pages dashboard. Disable "Deploy pull requests from forks" to prevent untrusted code from triggering builds. Never commit `.env` or hardcoded secrets.        |
| **`nodejs_compat` doesn't guarantee npm package compatibility**         | Unknown unknowns                   | High       | Medium | Test new dependencies in `wrangler pages dev` locally. Check package docs for "Cloudflare Workers" or "edge runtime" compatibility. Avoid packages with native modules or sync I/O.                                    |
| **500-build-per-month cap may throttle CI**                             | Unknown unknowns                   | Medium     | Low    | Configure GitHub Actions to deploy only on `push` to `main` and `pull_request` events (not on every commit). Use `wrangler pages dev` for local testing instead of relying on preview deploys.                         |
| **Workers Secrets don't sync to Pages env vars**                        | Unknown unknowns                   | High       | Medium | Use `wrangler pages secret put` (not `wrangler secret put`) or set secrets directly in Pages dashboard under Environment variables. Document this in team runbook.                                                     |
| **No regional data residency control**                                  | Unknown unknowns                   | Low        | Low    | Accept global edge routing for MVP (no PII beyond Supabase-managed email). If GDPR or data residency becomes a hard requirement, plan migration to Fly.io (regional pinning) or Railway (EU-West).                     |
| **40+ hours lost to dashboard debugging over 6 months**                 | Pre-mortem                         | Medium     | Medium | Accept manual log checks for MVP scope (3 weeks). If debugging frequency exceeds 1x/week post-launch, migrate to Railway or Fly.io where `railway logs` or `fly logs` provide CLI access.                              |
| **Pay-per-use costs (KV, Queues) scale faster than expected**           | Pre-mortem                         | Low        | Medium | Monitor Cloudflare billing weekly during first month post-launch. If any service exceeds $10/month, evaluate Railway ($20/month flat with Postgres/Redis included) as cost-predictable alternative.                    |

## Getting Started

Concrete first steps to deploy Dog Trick Tracker to Cloudflare Pages. Commands are specific to the existing Astro + Supabase stack.

### 1. Verify local configuration

Check that `wrangler.jsonc` and `astro.config.mjs` are correctly set up (already done in this project):

```bash
# Ensure Cloudflare adapter is configured
grep -A 3 'adapter:' astro.config.mjs
# Should output: adapter: cloudflare({ mode: "advanced", ... })

# Ensure wrangler.jsonc exists and has nodejs_compat enabled
cat wrangler.jsonc | grep -A 2 'compatibility_flags'
# Should output: "compatibility_flags": ["nodejs_compat"]
```

### 2. Install Wrangler CLI and authenticate

```bash
# Install globally (already installed if you've run `npx wrangler` before)
npm install -g wrangler

# Log in to Cloudflare account (opens browser for OAuth)
wrangler login

# Verify authentication
wrangler whoami
# Should output: You are logged in with an OAuth Token...
```

### 3. Set production environment variables

Add Supabase credentials to Cloudflare Pages (cannot be done via CLI; requires dashboard or `wrangler pages secret put`):

**Option A (Dashboard, recommended for first-time):**

1. Go to Cloudflare dashboard > Pages > Select project (or create if first deploy)
2. Settings > Environment variables > Production
3. Add `SUPABASE_URL` = `<your-supabase-project-url>`
4. Add `SUPABASE_KEY` = `<your-supabase-anon-key>`
5. Repeat for Preview environment if needed

**Option B (CLI, requires project to exist):**

```bash
wrangler pages secret put SUPABASE_URL --project-name dog-trick-tracker
# Paste value when prompted
wrangler pages secret put SUPABASE_KEY --project-name dog-trick-tracker
# Paste value when prompted
```

### 4. Build and deploy

```bash
# Build Astro for production (outputs to ./dist)
npm run build

# Deploy to Cloudflare Pages (creates project on first run)
npx wrangler pages deploy ./dist --project-name dog-trick-tracker

# Follow prompts:
# - Project name: dog-trick-tracker (or your choice)
# - Production branch: main
# - Confirm: yes

# Copy the deployment URL from output (e.g., https://dog-trick-tracker.pages.dev)
```

### 5. Verify deployment and test

```bash
# Open the deployed URL in browser
open https://dog-trick-tracker.pages.dev

# Test key flows:
# - Sign up with email/password
# - Verify Supabase auth works
# - Mark a trick as in-progress
# - View profile page

# If errors occur, check build logs in terminal or Cloudflare dashboard logs
```

### 6. Configure GitHub Actions for CI/CD (optional but recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ./dist --project-name dog-trick-tracker
```

Add secrets to GitHub repo: Settings > Secrets and variables > Actions > New repository secret:

- `CLOUDFLARE_API_TOKEN` (create in Cloudflare dashboard: My Profile > API Tokens > Create Token > Edit Cloudflare Workers)
- `CLOUDFLARE_ACCOUNT_ID` (visible in Cloudflare dashboard URL or Workers overview)

### Notes on version-accurate workflow

This project uses **Astro 6.0.0-beta.11** with `@astrojs/cloudflare` adapter (checked from workspace structure). As of Astro 6.x, the `wrangler` CLI is the canonical dev/deploy tool—`astro dev` runs Astro's internal dev server, but `wrangler pages dev` is **not required** for local development unless testing Workers-specific APIs (KV, D1). The Astro dev server already provides runtime fidelity for Supabase calls and SSR.

**Do NOT run `wrangler pages dev` in the normal dev loop**—use `npm run dev` (Astro's dev server). Only use `wrangler pages dev ./dist` after a production build to smoke-test the exact bundle that will deploy to Cloudflare.

For deployment, `wrangler pages deploy ./dist` (not `wrangler publish`, which is Workers-specific) is correct.

## Out of Scope

The following were not evaluated in this research:

- **Docker image configuration** — Cloudflare Pages does not use Docker; deployments are built from source via direct upload or GitHub integration.
- **CI/CD pipeline setup** — Covered in Getting Started (GitHub Actions example), but complex multi-environment workflows (staging, canary, approval gates) are deferred to post-MVP.
- **Production-scale architecture** — Multi-region HA, DDoS protection beyond Cloudflare's default edge filtering, dedicated support SLAs, and cost optimization for 1M+ requests/month are out of scope for this MVP research.
- **Database hosting or migration** — Supabase remains the external database layer; Cloudflare D1 (SQLite) was evaluated only as a potential future option and found incompatible with Postgres workloads.
- **Monitoring and alerting** — Third-party log drains (Logtail, Better Stack) were mentioned as a mitigation for dashboard-only logs, but setting up alerts, dashboards, or SLO tracking is deferred.
