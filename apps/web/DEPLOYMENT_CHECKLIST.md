# Deployment Checklist

## apps/web (Next.js)

### Required
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `GITHUB_CLIENT_ID` - GitHub OAuth app
- [ ] `GITHUB_CLIENT_SECRET` - GitHub OAuth app
- [ ] `BETTER_AUTH_SECRET` - Session encryption key
- [ ] `SITE_URL` - Frontend URL (e.g., `https://app.doccov.com`)
- [ ] `SANDBOX_URL` - Sandbox deployment URL
- [ ] `SANDBOX_SECRET` - Internal auth token (shared with sandbox)

### GitHub App (for diff/webhooks)
- [ ] `GITHUB_APP_ID`
- [ ] `GITHUB_APP_PRIVATE_KEY`
- [ ] `GITHUB_APP_WEBHOOK_SECRET`

### Billing (Polar.sh)
- [ ] `POLAR_ACCESS_TOKEN`
- [ ] `POLAR_WEBHOOK_SECRET`
- [ ] `POLAR_PRODUCT_TEAM`
- [ ] `POLAR_PRODUCT_PRO`

### AI Features
- [ ] `ANTHROPIC_API_KEY`
- [ ] `OPENAI_API_KEY` (optional alternative)

## packages/sandbox (Vercel Functions)

- [ ] `ANTHROPIC_API_KEY`
- [ ] `SANDBOX_SECRET` - Must match apps/web value

## Deployment Order

1. Deploy `packages/sandbox` first → get URL
2. Set `SANDBOX_URL` in apps/web to sandbox URL
3. Deploy `apps/web`
