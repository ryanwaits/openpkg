# @doccov/api

DocCov API server for badge generation and coverage services.

## Endpoints

### Badge Endpoint

```
GET /badge/:owner/:repo
```

Returns an SVG badge showing the documentation coverage percentage.

**Query Parameters:**
- `branch` - Git branch to fetch from (default: `main`)

**Example:**
```
https://api.doccov.com/badge/tanstack/query
```

**Embed in README:**
```markdown
![DocCov](https://api.doccov.com/badge/your-org/your-repo)
```

### Scan Endpoint

```
POST /scan
```

Scans a public GitHub repository for documentation coverage.

**Request Body:**
```json
{
  "url": "https://github.com/owner/repo",
  "ref": "main",
  "package": "@scope/package-name"
}
```

**Response:**
```json
{
  "jobId": "scan-123456-abc",
  "status": "pending",
  "pollUrl": "/scan/scan-123456-abc"
}
```

Poll the `pollUrl` to get results when the scan completes.

### Health Check

```
GET /health
```

Returns API health status.

## Development

```bash
# Install dependencies
bun install

# Run in development mode (uses local CLI spawn)
bun run dev

# Start production server
bun run start
```

### Local Development

In local development, the scan endpoint spawns the `doccov` CLI directly. No additional setup required.

### Production (Vercel Sandbox)

In production on Vercel, scans run in isolated [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) VMs for security and consistency.

**Setup:**

1. Link to your Vercel project:
   ```bash
   cd packages/api
   vercel link
   ```

2. Pull environment variables (includes OIDC token):
   ```bash
   vercel env pull
   ```

The SDK automatically uses the `VERCEL_OIDC_TOKEN` when available. When deployed to Vercel, tokens are provided automatically.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `VERCEL_OIDC_TOKEN` - Vercel OIDC token for sandbox authentication (auto-provided on Vercel)

## Deployment

### Deploy to Vercel

1. **Link the project** (first time only):
   ```bash
   cd packages/api
   vercel link
   ```

2. **Deploy to preview**:
   ```bash
   vercel deploy
   ```

3. **Deploy to production**:
   ```bash
   vercel deploy --prod
   ```

### Vercel Project Settings

When linking, use these settings:
- **Framework Preset**: Other
- **Build Command**: (leave empty, no build needed)
- **Output Directory**: (leave empty)
- **Install Command**: `bun install`

### Vercel Sandbox

The `/scan` endpoint uses [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) for isolated execution:
- Automatic OIDC authentication when deployed to Vercel
- Each scan runs in a fresh `node22` VM
- 4 vCPUs, 5-minute timeout per scan
- ~$0.01-0.05 per scan (see [pricing](https://vercel.com/docs/vercel-sandbox/pricing))

### Requirements for Sandbox

Before sandbox scans work, `@doccov/cli` must be published to npm:
```bash
npm publish --access public
```

The sandbox installs the CLI via `npm install -g @doccov/cli`.

## License

MIT

