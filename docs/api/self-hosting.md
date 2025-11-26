# Self-Hosting

Deploy your own DocCov API instance.

## Vercel Deployment

The API is designed for Vercel deployment.

### 1. Fork/Clone

```bash
git clone https://github.com/doccov/doccov
cd doccov/packages/api
```

### 2. Install Vercel CLI

```bash
npm install -g vercel
```

### 3. Deploy

```bash
vercel
```

Follow prompts to link to your Vercel account.

### 4. Production Deploy

```bash
vercel --prod
```

## Configuration

### vercel.json

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
    "api/examples/run.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 30
    }
  }
}
```

## Function Runtimes

| Endpoint | Runtime | Reason |
|----------|---------|--------|
| `/api/index.ts` | Edge | Fast, stateless |
| `/api/scan-stream.ts` | Node.js | Vercel Sandbox |
| `/api/examples/run.ts` | Node.js | Vercel Sandbox |
| `/api/scan/detect.ts` | Node.js | Vercel Sandbox |

## Environment Variables

Currently none required. Future versions may need:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | LLM fallback for entry detection |
| `DATABASE_URL` | Persistent leaderboard storage |

## Edge vs Node.js

### Edge Functions

Used for:
- Badge generation
- Widget generation  
- Spec fetching
- Leaderboard queries

Benefits:
- Lower latency
- Global distribution
- Lower cost

### Node.js Functions

Used for:
- Repository scanning (Vercel Sandbox)
- Example execution (Vercel Sandbox)

Requirements:
- Vercel Sandbox access
- Node.js 22 for `--experimental-strip-types`

## Vercel Sandbox

The scan and examples endpoints use Vercel Sandbox for isolated code execution.

Sandbox provides:
- Ephemeral file system
- npm/pnpm/bun installation
- Git clone capability
- Process isolation

## Custom Domain

1. Add domain in Vercel dashboard
2. Update DNS records
3. Update any hardcoded URLs

```bash
# Example: api.yourcompany.com
vercel domains add api.yourcompany.com
```

## Scaling

Vercel auto-scales based on traffic. No manual configuration needed.

### Limits (Hobby Plan)

- Edge: 100ms CPU time
- Node.js: 10s default, 300s max
- Bandwidth: 100GB/month

### Limits (Pro Plan)

- Edge: 1000ms CPU time
- Node.js: 60s default, 900s max
- Bandwidth: 1TB/month

## Monitoring

Use Vercel Analytics and Logs:

```bash
vercel logs
vercel logs --follow
```

## Local Development

### Hono Dev Server

Fast iteration, no Sandbox:

```bash
cd packages/api
bun run dev
```

### Vercel Dev

Full Vercel simulation:

```bash
vercel dev
```

## Alternative Hosting

### Bun/Node.js Server

The Hono app can run standalone:

```typescript
import app from './src/index';

Bun.serve({
  port: 3000,
  fetch: app.fetch,
});
```

Note: Scan/examples endpoints require Vercel Sandbox, so they won't work outside Vercel.

### Docker

```dockerfile
FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
```

Note: Docker deployment won't have Vercel Sandbox access.

## See Also

- [API Overview](./overview.md) - Endpoint reference
- [Local Testing](../development/local-testing.md) - Development setup

