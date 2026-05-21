# Repository Guidelines

Dog Trick Tracker is a web app for tracking dog trick training progress, built with Astro v6, React v19, TypeScript v5, Tailwind CSS v4, Supabase authentication, and deployed to Cloudflare Workers. See @context/foundation/prd.md for product requirements and domain model.

## Hard Rules

**Protected routes.** Add new protected paths to the `PROTECTED_ROUTES` array in @src/middleware.ts — do not implement auth checks inline in page components.

**Server secrets.** Environment variables `SUPABASE_URL` and `SUPABASE_KEY` are server-only (declared in `astro.config.mjs` env schema). Never reference them in client-side code or components without `server:` directive.

**React in JSX scope.** This project uses `jsxImportSource: "react"` — do not add `import React from "react"` to component files; it's automatic.

**Node.js version.** This project requires Node.js v22+ for Wrangler CLI compatibility. Before running any `npm` or `npx` commands, ensure the correct Node version is active: `nvm use 22` (or `nvm use` if `.nvmrc` exists). Verify current version with `node --version`.

## Project Structure

```
src/
├── layouts/          # Astro layouts
├── pages/            # Astro pages + /api/ endpoints
├── components/       # UI (Astro & React)
│   ├── auth/         # Auth-specific React forms
│   └── ui/           # Reusable UI primitives
├── lib/              # Shared utilities (Supabase client, utils)
├── styles/           # Global CSS
└── middleware.ts     # Auth & route protection
```

See @README.md for full stack details and Supabase setup instructions.

## Build, Test, and Development Commands

e.g., `npm run dev`, `npm run lint`. See @README.md for full list.

No test suite is configured yet.

## Coding Style & Naming Conventions

- **TypeScript strict mode** enforced via `tseslint.configs.strictTypeChecked`
- **React Compiler** enabled — `react-compiler/react-compiler` error fires on incompatible patterns
- **Unused variables** starting with `_` are allowed (e.g., `_req`, `_context`)
- **Console statements** trigger warning — use only for debugging, remove before commit
- **File naming:** React components use PascalCase (e.g., `SignInForm.tsx`), Astro components use PascalCase (e.g., `Layout.astro`), utilities use kebab-case (e.g., `config-status.ts`)
- **Path aliases:** `@/` maps to `./src/` (e.g., `import { createClient } from "@/lib/supabase"`)

Prettier and ESLint run in CI; ensure `npm run lint` and `npm run format` pass locally.

## Commit & Pull Request Guidelines

Target branch is `master`. CI runs on every push and PR: `npm ci`, `npx astro sync`, `npm run lint`, `npm run build`.

Recent commits follow "Module N (lesson M) - description" or standard present-tense style. No strict Conventional Commits enforcement observed.

Set `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step to pass.

## Security & Configuration

- `.dev.vars` — Local Cloudflare secrets (copy from `.env.example`), gitignored
- `.env` — Local Supabase credentials, gitignored
- Astro env schema validates presence of `SUPABASE_URL` and `SUPABASE_KEY` at build time

For Supabase local dev, run `npx supabase start` (requires Docker). See @README.md § Supabase Configuration for first-time setup and cloud project instructions.
