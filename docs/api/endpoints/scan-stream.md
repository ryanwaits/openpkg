# Scan Stream Endpoint

Analyze a GitHub repository with real-time progress via Server-Sent Events.

## Endpoint

```
GET /scan-stream
```

## Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | GitHub repository URL |
| `owner` | Yes | Repository owner |
| `repo` | Yes | Repository name |
| `ref` | No | Branch or tag (default: `main`) |
| `package` | No | Target package in monorepo |

## Response

Server-Sent Events stream.

### Event Format

```
data: {"type": "progress", "stage": "cloning", "message": "Cloning owner/repo...", "progress": 5}

data: {"type": "complete", "result": {...}}

data: {"type": "error", "message": "Clone failed"}
```

### Progress Stages

| Stage | Progress | Description |
|-------|----------|-------------|
| `cloning` | 5% | Cloning repository |
| `detecting` | 10-15% | Detecting project structure |
| `installing` | 18-40% | Installing dependencies |
| `building` | 45-55% | Running build step |
| `analyzing` | 60-85% | Running DocCov analysis |
| `extracting` | 85-100% | Extracting results |

### Complete Event

```json
{
  "type": "complete",
  "result": {
    "owner": "tanstack",
    "repo": "query",
    "ref": "main",
    "packageName": "@tanstack/react-query",
    "coverage": 72,
    "exportCount": 156,
    "typeCount": 89,
    "driftCount": 12,
    "undocumented": ["QueryClient", "useQuery"],
    "drift": [
      {
        "export": "fetchQuery",
        "type": "param-mismatch",
        "issue": "@param options not in signature"
      }
    ]
  }
}
```

### Error Event

```json
{
  "type": "error",
  "message": "Repository not accessible or does not exist"
}
```

## Examples

### Basic Scan

```bash
curl "https://api.doccov.com/scan-stream?url=https://github.com/colinhacks/zod&owner=colinhacks&repo=zod"
```

### Specific Branch

```bash
curl "https://api.doccov.com/scan-stream?url=https://github.com/colinhacks/zod&owner=colinhacks&repo=zod&ref=v3.22.4"
```

### Monorepo Package

```bash
curl "https://api.doccov.com/scan-stream?url=https://github.com/tanstack/query&owner=tanstack&repo=query&package=@tanstack/react-query"
```

### JavaScript Client

```javascript
const params = new URLSearchParams({
  url: 'https://github.com/colinhacks/zod',
  owner: 'colinhacks',
  repo: 'zod'
});

const eventSource = new EventSource(`https://api.doccov.com/scan-stream?${params}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'progress') {
    console.log(`${data.progress}% - ${data.message}`);
  } else if (data.type === 'complete') {
    console.log('Coverage:', data.result.coverage);
    eventSource.close();
  } else if (data.type === 'error') {
    console.error(data.message);
    eventSource.close();
  }
};
```

## Runtime

This endpoint runs on Node.js (not Edge) because it uses Vercel Sandbox for:

- Cloning repositories
- Installing dependencies
- Building projects
- Running DocCov CLI

## Timeout

Maximum duration: 5 minutes (300 seconds).

## Package Manager Detection

Auto-detects from lockfile:

| File | Package Manager |
|------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `bun.lock` | bun |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |

## Build Detection

Runs `build` or `compile` script if found in `package.json`.

## Local Testing

The endpoint uses Vercel Sandbox in production. Locally, it requires `vercel dev`:

```bash
cd packages/api
vercel dev

# Test
curl "http://localhost:3000/scan-stream?url=https://github.com/colinhacks/zod&owner=colinhacks&repo=zod"
```

## CLI Equivalent

The CLI `scan` command provides the same functionality:

```bash
doccov scan https://github.com/colinhacks/zod
```

See [scan Command](../../cli/commands/scan.md).

## See Also

- [scan Command](../../cli/commands/scan.md) - CLI version
- [Self-Hosting](../self-hosting.md) - Deploy your own

