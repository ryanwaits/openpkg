# API Overview

The DocCov API provides programmatic access to documentation analysis for TypeScript/JavaScript projects.

## Base URL

```
https://api.doccov.com
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and health status |
| `/badge/:owner/:repo` | GET | Coverage badge SVG |
| `/spec/:owner/:repo/:ref?` | GET | Fetch spec from GitHub |
| `/plan` | POST | Generate AI build plan |
| `/execute` | POST | Execute build plan |
| `/execute-stream` | POST | Execute with SSE streaming |

## Quick Start

The typical workflow is: **Plan** → **Execute**

### 1. Generate a Build Plan

```bash
curl -X POST https://api.doccov.com/plan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/sindresorhus/ky"}'
```

Response:
```json
{
  "plan": {
    "version": "1.0.0",
    "target": {
      "type": "github",
      "repoUrl": "https://github.com/sindresorhus/ky",
      "entryPoints": ["distribution/index.d.ts"]
    },
    "environment": {
      "runtime": "node22",
      "packageManager": "npm"
    },
    "steps": [
      { "id": "install", "command": "npm", "args": ["install"] },
      { "id": "build", "command": "npm", "args": ["run", "build"] }
    ],
    "confidence": "high"
  },
  "context": {
    "owner": "sindresorhus",
    "repo": "ky",
    "ref": "main"
  }
}
```

### 2. Execute the Plan

```bash
curl -X POST https://api.doccov.com/execute \
  -H "Content-Type: application/json" \
  -d '{"plan": <plan-from-step-1>}'
```

Response (summary by default):
```json
{
  "success": true,
  "summary": {
    "name": "ky",
    "version": "1.0.0",
    "coverage": 85,
    "exports": 42,
    "types": 15,
    "documented": 36,
    "undocumented": 6
  },
  "stepResults": [
    { "stepId": "install", "success": true, "duration": 12000 },
    { "stepId": "build", "success": true, "duration": 8000 },
    { "stepId": "analyze", "success": true, "duration": 5000 }
  ],
  "totalDuration": 25000
}
```

Add `?includeSpec=true` to include the full OpenPkg spec in the response.

### 3. Execute with Streaming (SSE)

For real-time progress updates:

```bash
curl -X POST https://api.doccov.com/execute-stream \
  -H "Content-Type: application/json" \
  -d '{"plan": <plan-from-step-1>}'
```

SSE Events:
```
event: progress
data: {"stage":"init","message":"Creating sandbox...","progress":5}

event: progress
data: {"stage":"cloned","message":"Repository cloned","progress":15}

event: step:start
data: {"stepId":"install","name":"Install dependencies","progress":15}

event: step:complete
data: {"stepId":"install","success":true,"duration":12000,"progress":38}

event: step:start
data: {"stepId":"build","name":"Build TypeScript","progress":38}

event: step:complete
data: {"stepId":"build","success":true,"duration":8000,"progress":61}

event: step:start
data: {"stepId":"analyze","name":"Analyzing API","progress":85}

event: step:complete
data: {"stepId":"analyze","success":true,"progress":95}

event: complete
data: {"success":true,"summary":{...},"totalDuration":25000}
```

## JavaScript Client Example

```javascript
// 1. Generate plan
const planRes = await fetch('https://api.doccov.com/plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://github.com/sindresorhus/ky' })
});
const { plan } = await planRes.json();

// 2. Execute with streaming
const response = await fetch('https://api.doccov.com/execute-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

## CORS

All endpoints have CORS enabled for browser access.

## Runtime

All endpoints run on Node.js 22 with Vercel Sandbox for secure code execution.

## Timeout

Maximum duration: 5 minutes (300 seconds).

## Error Responses

```json
{
  "error": "Repository not found",
  "message": "Could not fetch https://github.com/owner/repo"
}
```

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 403 | Private repository |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal error |

## See Also

- [Plan Endpoint](./endpoints/plan.md)
- [Execute Endpoint](./endpoints/execute.md)
- [Badges & Widgets](../integrations/badges-widgets.md)
