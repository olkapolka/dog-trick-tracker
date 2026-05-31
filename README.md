# Dog Trick Tracker

[![CI](https://github.com/olkapolka/dog-trick-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/olkapolka/dog-trick-tracker/actions/workflows/ci.yml)
[![Deploy](https://github.com/olkapolka/dog-trick-tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/olkapolka/dog-trick-tracker/actions/workflows/deploy.yml)

A web application for tracking dog trick training progress online.

**Production:** https://dog-trick-tracker.oliwia-achyna.workers.dev

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) with automated CI/CD.

### Automated Deployment (Recommended)

Every push to `main` branch automatically:

1. Runs lint and build checks (CI workflow)
2. Deploys to production (Deploy workflow)
3. Updates https://dog-trick-tracker.oliwia-achyna.workers.dev

**Required GitHub Secrets:**

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers write access
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Manual Deployment

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

3. Set secrets (first-time only):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

### Rollback Procedure

If a deployment introduces issues:

1. List recent deployments:

```bash
npx wrangler deployments list
```

2. Find the last known-good deployment ID from the list

3. Rollback to that version:

```bash
npx wrangler rollback --message "Rollback to stable version"
```

4. Verify rollback at https://dog-trick-tracker.oliwia-achyna.workers.dev (takes ~10 seconds)

5. If the bad deployment included database changes, check Supabase dashboard for schema state

**Alternative:** Revert the Git commit and push to `main` - automated deployment will restore the previous version.

## Known Constraints

**Cloudflare Workers limitations:**

- Runtime logs accessible only via Cloudflare dashboard (no `wrangler tail` for deployed Workers)
- No in-memory session stores - use Supabase cookies or KV
- Cold starts can take 1-2 seconds on first request

**Supabase:**

- Must use external Supabase (cloud or self-hosted) - Cloudflare D1 is SQLite, not Postgres-compatible
- Email confirmations disabled for development - enable in production via Supabase dashboard

## CI

GitHub Actions runs lint + build on every push and PR to `main`. Successful builds on `main` trigger automatic deployment to production.

## License

MIT

# dog-trick-tracker
