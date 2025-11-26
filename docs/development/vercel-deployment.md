# Vercel Deployment

Deploy the DocCov API to Vercel.

## Prerequisites

- [Vercel CLI](https://vercel.com/cli): `npm install -g vercel`
- Vercel account

## Quick Deploy

```bash
cd packages/api
vercel
```

Follow prompts to link to your Vercel account and project.

## Production Deploy

```bash
vercel --prod
```

## Project Structure

```
packages/api/
├── api/                    # Vercel serverless functions
│   ├── index.ts           # Edge: badge, widget, spec, leaderboard
│   ├── scan-stream.ts     # Node.js: SSE scanning
│   ├── scan.ts            # Node.js: scan endpoint
│   ├── examples/
│   │   └── run.ts         # Node.js: example execution
│   └── scan/
│       └── detect.ts      # Node.js: monorepo detection
├── src/                   # Shared code
│   ├── index.ts          # Hono app (for local dev)
│   ├── routes/           # Route handlers
│   └── utils/            # Utilities
└── vercel.json           # Vercel config
```

## vercel.json

```json
{
  "framework": null,
  "installCommand": "bun install",
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/api" }
  ],
  "functions": {
    "api/scan-stream.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 300
    },
    "api/scan.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 300
    },
    "api/examples/run.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 30
    },
    "api/scan/detect.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 60
    }
  }
}
```

## Function Runtimes

| Function | Runtime | Duration | Purpose |
|----------|---------|----------|---------|
| `api/index.ts` | Edge | Default | Badge, widget, spec, leaderboard |
| `api/scan-stream.ts` | Node.js 22 | 300s | SSE repo scanning |
| `api/scan.ts` | Node.js 22 | 300s | Sync repo scanning |
| `api/examples/run.ts` | Node.js 22 | 30s | Example execution |
| `api/scan/detect.ts` | Node.js 22 | 60s | Monorepo detection |

## Edge vs Node.js

### Edge Functions

- `api/index.ts` runs on Vercel Edge
- Lower latency, global distribution
- Cannot use Node.js-specific APIs
- Cannot use Vercel Sandbox

Used for:
- Badge generation
- Widget generation
- Spec fetching from GitHub
- Leaderboard queries

### Node.js Functions

- Specific files configured in `vercel.json`
- Required for Vercel Sandbox
- Node.js 22 for `--experimental-strip-types`

Used for:
- Repository scanning
- Example execution
- Monorepo detection

## Environment Variables

### Currently Used

None required for basic operation.

### Optional

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | LLM fallback for entry detection |

Set in Vercel dashboard or CLI:

```bash
vercel env add OPENAI_API_KEY
```

## Custom Domain

1. Add domain in Vercel dashboard
2. Configure DNS:
   - CNAME: `api.yourdomain.com` → `cname.vercel-dns.com`
3. Wait for SSL provisioning

```bash
vercel domains add api.yourdomain.com
```

## Monitoring

### Logs

```bash
# Recent logs
vercel logs

# Follow logs
vercel logs --follow

# Specific function
vercel logs --scope api/scan-stream.ts
```

### Analytics

Enable in Vercel dashboard:
- **Speed Insights**: Performance metrics
- **Web Analytics**: Request volumes

## Scaling

Vercel auto-scales based on traffic. No manual configuration needed.

### Limits by Plan

| Plan | Edge CPU | Node.js Duration | Bandwidth |
|------|----------|------------------|-----------|
| Hobby | 100ms | 10s (300s max) | 100GB |
| Pro | 1000ms | 60s (900s max) | 1TB |
| Enterprise | Custom | Custom | Custom |

## Troubleshooting

### Function Timeout

If scan times out:
1. Check `maxDuration` in `vercel.json`
2. Large repos may need Pro plan
3. Consider `--skip-install` for faster scans

### Sandbox Errors

Vercel Sandbox requires:
- Node.js 22 runtime
- Sufficient function duration
- Available resources

### Cold Starts

First request after idle may be slow. Use:
- Edge functions where possible
- Vercel's "Always On" (Pro plan)

## Development vs Production

### Local Development

```bash
# Fast iteration (no Sandbox)
bun run dev

# Full Vercel simulation
vercel dev
```

### Differences

| Feature | Local (bun dev) | Local (vercel dev) | Production |
|---------|-----------------|---------------------|------------|
| Edge functions | Simulated | Simulated | Real Edge |
| Node.js functions | Bun | Node.js | Node.js |
| Vercel Sandbox | ❌ | ✅ | ✅ |
| Speed | Fast | Slower | Fast |

## CI/CD

Auto-deploy on push:

1. Connect repo in Vercel dashboard
2. Configure:
   - Production branch: `main`
   - Root directory: `packages/api`
3. Push triggers deploy

Or use GitHub Action:

```yaml
- uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    working-directory: packages/api
```

## See Also

- [API Overview](../api/overview.md) - Endpoint reference
- [Self-Hosting](../api/self-hosting.md) - Full deployment guide
- [Local Testing](./local-testing.md) - Development setup

