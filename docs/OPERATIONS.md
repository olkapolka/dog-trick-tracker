# Operations Guide

## Quick Reference

- **Production URL:** https://dog-trick-tracker.oliwia-achyna.workers.dev
- **Cloudflare Dashboard:** https://dash.cloudflare.com → Workers & Pages → dog-trick-tracker
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Actions:** https://github.com/olkapolka/dog-trick-tracker/actions

## Daily Operations

### Check Application Health

1. **Visit production URL** - Verify homepage loads
2. **Test auth flow** - Sign up/sign in should work
3. **Check GitHub Actions** - Recent deployments should show green checkmarks

### View Logs

**Cloudflare Workers logs** (dashboard-only):
1. Go to https://dash.cloudflare.com
2. Workers & Pages → dog-trick-tracker
3. Logs tab → Real-time logs (shows last 200 requests)

**Deployment logs:**
- GitHub Actions → Deploy workflow → Click latest run → View detailed logs

### Common Issues

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Auth errors on production | Supabase secrets missing/wrong | Verify `wrangler secret list` shows both secrets, re-add if needed |
| 500 errors after deploy | Check Cloudflare logs for stack trace | Rollback using procedure below |
| Build failures on CI | Check GitHub Actions logs | Verify GitHub secrets are set correctly |
| Sign-in redirect loop | Cookie/session issue | Check browser DevTools → Application → Cookies for `sb-*` cookies |

## Deployment Procedures

### Standard Deployment (Automated)

1. Merge PR or push to `main` branch
2. GitHub Actions automatically runs CI + Deploy workflows
3. Monitor at https://github.com/olkapolka/dog-trick-tracker/actions
4. Verify deployment at production URL within 2-3 minutes

### Emergency Rollback

**Option 1: Wrangler CLI (fastest)**
```bash
# List recent deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback --message "Emergency rollback"
```

**Option 2: Git revert + auto-deploy**
```bash
# Revert the problematic commit
git revert <commit-hash>
git push origin main

# GitHub Actions will automatically deploy the reverted version
```

**Option 3: Cloudflare Dashboard (slowest)**
1. Go to Workers & Pages → dog-trick-tracker
2. Deployments tab
3. Find last known-good deployment
4. Click "Rollback to this deployment"

## Monitoring Recommendations

### Uptime Monitoring (Optional)

Set up external monitoring with free tier services:

**Option 1: UptimeRobot (https://uptimerobot.com)**
- Free tier: 50 monitors, 5-minute checks
- Monitor: https://dog-trick-tracker.oliwia-achyna.workers.dev
- Alert via: Email or Slack

**Option 2: Better Stack Uptime (https://betterstack.com)**
- Free tier: 10 monitors, 30-second checks
- Includes status page
- Alert via: Email, SMS, Slack, PagerDuty

**Recommended setup:**
1. Create HTTP(s) monitor for production URL
2. Check interval: 5 minutes
3. Alert after: 3 consecutive failures
4. Notification: Email to your address

### Synthetic Testing (Optional)

For deeper health checks beyond "URL responds 200":

**Checkly (https://www.checklyhq.com)**
- Free tier: 10k check runs/month
- Can test full auth flow: signup → signin → dashboard access
- Playwright-based browser checks
- Alert on broken user flows, not just downtime

### Log Aggregation (Optional)

Cloudflare dashboard logs are limited to last 200 requests. For historical analysis:

**Logtail / Better Stack Logs (https://betterstack.com/logtail)**
- Free tier: 1GB logs/month, 3-day retention
- Requires Cloudflare Logpush (Workers Paid plan) or app-level integration
- **Defer until**: You need > 3 days of log history or querying across deployments

### Performance Monitoring (Optional)

Track real user performance:

**Cloudflare Web Analytics** (free, built-in):
1. Cloudflare dashboard → Analytics & Logs → Web Analytics
2. Add site: dog-trick-tracker.oliwia-achyna.workers.dev
3. Install JS snippet in `<head>` of Layout.astro
4. Privacy-friendly, no cookies

## Secrets Management

### Rotate Supabase Keys

If Supabase keys are compromised:

1. **Generate new keys** in Supabase dashboard → Settings → API
2. **Update Cloudflare secrets:**
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```
3. **Update GitHub secrets:**
   - GitHub → Settings → Secrets → Actions
   - Update `SUPABASE_URL` and `SUPABASE_KEY`
4. **Deploy** to pick up new secrets:
   ```bash
   git commit --allow-empty -m "Rotate Supabase secrets"
   git push origin main
   ```

### Rotate Cloudflare API Token

If `CLOUDFLARE_API_TOKEN` is compromised:

1. **Revoke old token:** https://dash.cloudflare.com/profile/api-tokens
2. **Create new token:** Use "Edit Cloudflare Workers" template
3. **Update GitHub secret:**
   - GitHub → Settings → Secrets → Actions
   - Update `CLOUDFLARE_API_TOKEN`
4. **Test:** Push a trivial change to verify auto-deploy works

## Disaster Recovery

### Full Application Restore

If entire Worker is deleted:

1. **Code:** Clone from GitHub (source of truth)
2. **Secrets:** Re-add via `wrangler secret put` (keep backup in password manager)
3. **Deploy:** `npm run build && npx wrangler deploy`
4. **KV Namespace:** Check `wrangler.jsonc` for `SESSION` binding ID, recreate if needed
5. **Database:** Supabase data is independent, not affected by Worker deletion

### Data Backup

**Supabase:**
- Automatic backups on paid plan (daily)
- Manual export: Supabase dashboard → Database → Backups
- For critical data: Set up periodic `pg_dump` via cron

**Cloudflare KV (session storage):**
- Sessions are ephemeral, no backup needed
- Users re-authenticate if sessions lost

## Maintenance Windows

### Planned Downtime

If you need to take the app offline temporarily:

1. **Deploy maintenance page:**
   - Create minimal `maintenance.html` in `public/`
   - Temporarily replace `src/pages/index.astro` with redirect to maintenance page
   - Deploy via `git push origin main`

2. **Perform maintenance** (database migrations, etc.)

3. **Restore normal operation:**
   - Revert maintenance page commit
   - Deploy via `git push origin main`

### Database Migrations (Future)

When you add Supabase tables/schemas:

1. **Test locally first** with `npx supabase start`
2. **Apply to production** via Supabase dashboard or migration scripts
3. **Deploy code changes** that depend on new schema
4. **Rollback plan:** Keep migration reversals ready (`DOWN` migrations)

## Cost Tracking

### Cloudflare Workers

**Free tier limits:**
- 100k requests/day
- 10ms CPU time per request
- Check usage: Cloudflare dashboard → Workers & Pages → dog-trick-tracker → Metrics

**What triggers paid plan:**
- Exceeding 100k requests/day → $5/month base + $0.50 per million requests
- Using Logpush, Analytics Engine, Durable Objects

### Supabase

**Free tier limits:**
- 500MB database
- 2GB bandwidth
- Check usage: Supabase dashboard → Settings → Usage

**What triggers paid plan ($25/month):**
- > 500MB database
- > 2GB bandwidth
- Need daily backups or PITR (point-in-time recovery)

### GitHub Actions

**Free tier (public repos):**
- Unlimited minutes for public repositories
- 2000 minutes/month for private repositories

**Current usage:**
- CI workflow: ~2 minutes per run
- Deploy workflow: ~3 minutes per run
- Typical month with 50 deploys: ~250 minutes (well within limit)
