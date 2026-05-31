---
bootstrapped_at: 2026-05-20T15:26:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: dog-trick-tracker
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: dog-trick-tracker
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

### Why this stack

A web app for tracking dog trick progress with auth and a 3-week after-hours MVP timeline needs a battle-tested, agent-friendly starter that handles auth + database + edge deploy out of the box. The 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for (web-app, js) and includes PostgreSQL, auth via Supabase, and TypeScript end-to-end. Bootstrapper confidence is first-class, so scaffolding should be mostly smooth with occasional manual steps. Auth is in scope per PRD FRs; payments, realtime, AI, and background jobs are out of scope. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages.

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                                       |
| ----------- | ------- | -------- | ------------------------------------------- |
| npm package | not run | —        | git-clone strategy; no npm package resolved |
| GitHub repo | not run | —        | gh CLI unavailable; network check skipped   |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 20 (including directories)
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold, .nvmrc.scaffold
**.gitignore handling**: moved silently (no existing .gitignore in cwd)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 1 HIGH, 10 MODERATE, 0 LOW
**Direct vs transitive**: 0/3/7/0 direct of total 0/1/10/0

#### HIGH findings

**devalue** (transitive)

- Version range: 5.6.3 - 5.8.0
- Advisory: GHSA-77vg-94rm-hx3p (CVE via Svelte; DoS via sparse array deserialization)
- CVSS: 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
- Fix: available (update devalue)

#### MODERATE findings (direct)

**@astrojs/check** (direct via @astrojs/language-server)

- Transitive dependency vulnerability chain; fix available via semver-major downgrade to 0.9.2

**@astrojs/cloudflare** (direct via @cloudflare/vite-plugin, wrangler)

- Transitive dependency vulnerability chain; fix available via semver-major downgrade to 12.6.13

**wrangler** (direct via miniflare)

- Version range: >=3.108.0
- Fix: available (downgrade to 3.107.3, semver-major)

#### MODERATE findings (transitive)

**@astrojs/language-server** (via volar-service-yaml)
**@cloudflare/vite-plugin** (via miniflare, wrangler, ws)
**miniflare** (via ws)
**volar-service-yaml** (via yaml-language-server)
**ws** (uninitialized memory disclosure)

- Advisory: GHSA-58qx-3vcg-4xpx
- Version range: 8.0.0 - 8.20.0
- CVSS: 4.4 (CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N)
- Fix: available (update to 8.20.1+)

**yaml** (stack overflow via deeply nested collections)

- Advisory: GHSA-48c2-rrv3-qjmp
- Version range: 2.0.0 - 2.8.2
- CVSS: 4.3 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)
- Fix: available (update to 2.8.3+)

**yaml-language-server** (via yaml)

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review [CLAUDE.md.scaffold](../../../CLAUDE.md.scaffold) and [.nvmrc.scaffold](../../../.nvmrc.scaffold) — the conflict policy preserved your existing versions; decide which to keep.
- Address audit findings per your project's risk tolerance. The 1 HIGH finding (devalue) is transitive; `npm audit fix` may resolve some. The full breakdown is in this log.
