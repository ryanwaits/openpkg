# Leaderboard Endpoint

Public rankings of TypeScript libraries by documentation coverage.

## Endpoints

```
GET /leaderboard
GET /leaderboard/:owner/:repo
POST /leaderboard/submit
```

## GET /leaderboard

List top libraries by coverage.

### Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `category` | `all` | Filter by category |
| `limit` | `100` | Max entries (max 100) |

### Response

```json
{
  "entries": [
    {
      "owner": "colinhacks",
      "repo": "zod",
      "coverage": 92,
      "exportCount": 156,
      "driftCount": 3,
      "lastUpdated": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 10,
  "category": "all",
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

### Example

```bash
curl https://api.doccov.com/leaderboard
```

## GET /leaderboard/:owner/:repo

Get detailed stats for a specific repository.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | path | GitHub username or org |
| `repo` | path | Repository name |

### Response

```json
{
  "owner": "colinhacks",
  "repo": "zod",
  "coverage": 92,
  "exportCount": 156,
  "driftCount": 3,
  "missingDocsCount": 12,
  "version": "3.22.4",
  "name": "zod",
  "exports": [
    {
      "name": "z",
      "kind": "variable",
      "coverage": 100,
      "driftCount": 0,
      "missing": []
    }
  ]
}
```

### Example

```bash
curl https://api.doccov.com/leaderboard/colinhacks/zod
```

### Not Found

```json
{
  "error": "Not found",
  "message": "No openpkg.json found for owner/repo"
}
```

## POST /leaderboard/submit

Submit a repository to the leaderboard.

### Request Body

```json
{
  "owner": "your-org",
  "repo": "your-repo"
}
```

### Response

```json
{
  "success": true,
  "message": "your-org/your-repo added to leaderboard tracking",
  "coverage": 85
}
```

### Example

```bash
curl -X POST https://api.doccov.com/leaderboard/submit \
  -H "Content-Type: application/json" \
  -d '{"owner": "your-org", "repo": "your-repo"}'
```

### Not Found

```json
{
  "error": "Not found",
  "message": "No openpkg.json found for owner/repo. Generate one with: doccov generate"
}
```

## Tracked Repositories

The default leaderboard tracks popular TypeScript libraries:

- tanstack/query
- trpc/trpc
- colinhacks/zod
- drizzle-team/drizzle-orm
- pmndrs/zustand
- react-hook-form/react-hook-form
- TanStack/router
- TanStack/table
- tailwindlabs/headlessui

Submit your repo to be tracked.

## Caching

Leaderboard is cached for 5 minutes to reduce GitHub API load.

## Local Testing

```bash
cd packages/api && bun run dev

# Get leaderboard
curl http://localhost:3000/leaderboard

# Get specific repo
curl http://localhost:3000/leaderboard/colinhacks/zod

# Submit repo
curl -X POST http://localhost:3000/leaderboard/submit \
  -H "Content-Type: application/json" \
  -d '{"owner": "test", "repo": "repo"}'
```

## See Also

- [Badge](./badge.md) - Show your ranking
- [Widget](./widget.md) - Detailed coverage widget

