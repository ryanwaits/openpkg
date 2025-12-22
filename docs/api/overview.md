# API Overview

`@doccov/api` - REST API for documentation coverage analysis.

## Base URL

```
https://api.doccov.dev
```

## Authentication

Three auth methods depending on endpoint:

| Method | Used For |
|--------|----------|
| None | Public endpoints (badge, demo) |
| Session | Dashboard (browser cookies) |
| API Key | Programmatic access (`/v1/*`) |

See [Authentication](./authentication.md) for details.

## Endpoints

### Public

| Endpoint | Description |
|----------|-------------|
| [`GET /badge/:owner/:repo`](./endpoints/badge.md) | Coverage badge SVG |
| [`GET /demo/analyze`](./endpoints/demo.md) | Analyze npm package |

### Organizations

| Endpoint | Description |
|----------|-------------|
| [`GET /orgs/`](./endpoints/orgs.md) | List organizations |
| [`GET /orgs/:slug`](./endpoints/orgs.md#get-organization) | Get organization |
| [`GET /orgs/:slug/members`](./endpoints/orgs.md#members) | List members |
| [`POST /orgs/:slug/invites`](./endpoints/orgs.md#invites) | Create invite |

### Coverage

| Endpoint | Description |
|----------|-------------|
| [`GET /coverage/projects/:id/history`](./endpoints/coverage.md) | Coverage history |
| [`POST /coverage/projects/:id/snapshots`](./endpoints/coverage.md#record) | Record snapshot |

### Billing

| Endpoint | Description |
|----------|-------------|
| [`GET /billing/checkout`](./endpoints/billing.md) | Start checkout |
| [`GET /billing/status`](./endpoints/billing.md#status) | Billing status |
| [`GET /billing/usage`](./endpoints/billing.md#usage) | Usage details |

### AI (API Key Required)

| Endpoint | Description |
|----------|-------------|
| [`POST /v1/ai/generate`](./endpoints/ai.md) | Generate JSDoc |
| [`GET /v1/ai/quota`](./endpoints/ai.md#quota) | Check quota |

### GitHub App

| Endpoint | Description |
|----------|-------------|
| [`GET /github/install`](./endpoints/github-app.md) | Install app |
| [`GET /github/repos`](./endpoints/github-app.md#repos) | List repos |
| [`GET /github/status`](./endpoints/github-app.md#status) | Install status |

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/badge/*` | 10 | 24h (per IP) |
| `/demo/*` | 5 | 1h (per IP) |
| `/v1/*` | 50-200 | Daily (per org) |

Rate limit headers:
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

## Error Responses

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| Status | Description |
|--------|-------------|
| 400 | Invalid request |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

## Plans

| Feature | Free | Team | Pro |
|---------|------|------|-----|
| Badge API | 10/day | Unlimited | Unlimited |
| AI Generation | 0 | 50/mo | 250/mo |
| Coverage History | 0 days | 30 days | 90 days |
| Daily Analyses | 0 | 50 | 200 |
