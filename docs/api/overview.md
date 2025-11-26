# API Overview

The DocCov API provides programmatic access to coverage badges, widgets, scanning, and more.

## Base URL

```
https://api.doccov.com
```

## Technology

- **Framework**: [Hono](https://hono.dev)
- **Hosting**: Vercel (Edge + Node.js functions)
- **Sandbox**: Vercel Sandbox for code execution

## Endpoints

| Endpoint | Description |
|----------|-------------|
| [GET /badge/:owner/:repo](./endpoints/badge.md) | Coverage badge SVG |
| [GET /widget/:owner/:repo](./endpoints/widget.md) | Signal breakdown widget |
| [GET /leaderboard](./endpoints/leaderboard.md) | Public rankings |
| [GET /scan-stream](./endpoints/scan-stream.md) | SSE streaming scan |
| [GET /spec/:owner/:repo](./endpoints/spec.md) | Fetch spec from GitHub |
| [POST /api/examples/run](./endpoints/examples-run.md) | Execute code |

## Health Check

```bash
curl https://api.doccov.com/health
```

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Root Endpoint

```bash
curl https://api.doccov.com/
```

```json
{
  "name": "DocCov API",
  "version": "0.2.0",
  "endpoints": {
    "badge": "/badge/:owner/:repo",
    "widget": "/widget/:owner/:repo",
    "leaderboard": "/leaderboard",
    "scan": "/scan",
    "health": "/health"
  }
}
```

## CORS

All endpoints have CORS enabled for browser access.

## Rate Limits

Currently no rate limits. May be introduced for scan/examples endpoints.

## Edge vs Node.js

| Type | Endpoints | Runtime |
|------|-----------|---------|
| Edge | badge, widget, spec, leaderboard | Vercel Edge |
| Node.js | scan-stream, examples/run | Node.js 22 |

Edge functions are faster but can't use Node.js APIs. Scan and example execution require Node.js for Vercel Sandbox.

## Authentication

No authentication required for public endpoints. Rate-limited endpoints may require API keys in the future.

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Not found",
  "message": "No openpkg.json found for owner/repo"
}
```

HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 404 | Resource not found |
| 405 | Method not allowed |
| 500 | Internal error |

## Local Development

```bash
cd packages/api

# Hono dev server (fast, no sandbox)
bun run dev

# Vercel dev (full simulation)
vercel dev
```

## See Also

- [Self-Hosting](./self-hosting.md) - Deploy your own instance
- [Badges & Widgets](../integrations/badges-widgets.md) - README embeds

