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

## Why this stack

A web app for tracking dog trick progress with auth and a 3-week after-hours MVP timeline needs a battle-tested, agent-friendly starter that handles auth + database + edge deploy out of the box. The 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for (web-app, js) and includes PostgreSQL, auth via Supabase, and TypeScript end-to-end. Bootstrapper confidence is first-class, so scaffolding should be mostly smooth with occasional manual steps. Auth is in scope per PRD FRs; payments, realtime, AI, and background jobs are out of scope. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages.
