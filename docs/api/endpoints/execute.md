# Execute Endpoint

Execute a build plan in a secure sandbox and generate an OpenPkg spec.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/execute` | POST | Execute and return JSON result |
| `/execute-stream` | POST | Execute with SSE streaming |

## When to Use Which

**Use `/execute-stream` for:**
- User-facing UIs with real-time progress feedback
- Interactive dashboards and web apps
- Any scenario where users are waiting (30+ second operations benefit from progress updates)

**Use `/execute` for:**
- Background job workers and queue processors
- CI/CD pipelines (GitHub Actions, etc.)
- Webhook-triggered workflows
- Automated systems that just need the final result
- Cron jobs and scheduled tasks

Both endpoints return identical final results - the only difference is how progress is communicated during execution.

## Request Body

Both endpoints accept the same request body:

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
    ]
  }
}
```

## POST /execute

Returns JSON when execution completes.

### Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `includeSpec` | No | `false` | Include full OpenPkg spec in response |

### Response

By default, returns a summary for a cleaner response:

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
    {
      "stepId": "install",
      "success": true,
      "duration": 12000,
      "output": "added 150 packages..."
    },
    {
      "stepId": "build",
      "success": true,
      "duration": 8000,
      "output": "tsc completed..."
    },
    {
      "stepId": "analyze",
      "success": true,
      "duration": 5000
    }
  ],
  "totalDuration": 25000
}
```

### Response with Full Spec

Add `?includeSpec=true` to include the complete OpenPkg spec:

```json
{
  "success": true,
  "summary": { ... },
  "spec": {
    "$schema": "https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json",
    "openpkg": "0.3.0",
    "meta": { "name": "ky", "version": "1.0.0" },
    "exports": [...],
    "types": [...]
  },
  "stepResults": [...],
  "totalDuration": 25000
}
```

### Example

```bash
# First get a plan
PLAN=$(curl -s -X POST https://api.doccov.com/plan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/sindresorhus/ky"}' | jq '.plan')

# Execute and get summary (default)
curl -X POST https://api.doccov.com/execute \
  -H "Content-Type: application/json" \
  -d "{\"plan\": $PLAN}"

# Execute and get full spec
curl -X POST "https://api.doccov.com/execute?includeSpec=true" \
  -H "Content-Type: application/json" \
  -d "{\"plan\": $PLAN}"
```

## POST /execute-stream

Returns Server-Sent Events for real-time progress.

### Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `includeSpec` | No | `false` | Include full OpenPkg spec in final event |

### SSE Events

| Event | Description |
|-------|-------------|
| `progress` | General progress updates |
| `step:start` | Step execution started |
| `step:complete` | Step completed successfully |
| `step:error` | Step failed |
| `complete` | Execution finished successfully |
| `error` | Execution failed |

### Event Payloads

**progress**
```json
{
  "stage": "cloned",
  "message": "Repository cloned",
  "progress": 15
}
```

**step:start**
```json
{
  "stepId": "install",
  "name": "Install dependencies",
  "progress": 15
}
```

**step:complete**
```json
{
  "stepId": "install",
  "success": true,
  "duration": 12000,
  "output": "added 150 packages...",
  "progress": 38
}
```

**step:error**
```json
{
  "stepId": "build",
  "success": false,
  "duration": 5000,
  "error": "tsc: error TS2307..."
}
```

**complete**
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
  "stepResults": [...],
  "totalDuration": 25000
}
```

With `?includeSpec=true`, the complete event also includes the full `spec` object.

**error**
```json
{
  "success": false,
  "stepResults": [...],
  "totalDuration": 15000,
  "error": "Step 'build' failed: tsc error..."
}
```

### Example with curl

```bash
# Stream all events and show summary at end
curl -sN -X POST https://api.doccov.com/execute-stream \
  -H "Content-Type: application/json" \
  -d "$(cat plan.json)" | {
    last_data=""
    while IFS= read -r line; do
      echo "$line"
      [[ "$line" == data:* ]] && last_data="${line#data: }"
    done
    echo -e "\n--- Summary ---"
    echo "$last_data" | jq '.summary'
  }

# Just get the final summary (wait for completion)
curl -sN -X POST https://api.doccov.com/execute-stream \
  -H "Content-Type: application/json" \
  -d "$(cat plan.json)" | grep "^data:" | tail -1 | sed 's/^data: //' | jq '.summary'
```

### JavaScript Client

```javascript
async function executeWithStreaming(plan) {
  const response = await fetch('https://api.doccov.com/execute-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const event = line.slice(7);
        console.log('Event:', event);
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        console.log('Data:', data);

        if (data.progress) {
          updateProgressBar(data.progress);
        }
      }
    }
  }
}
```

### React Hook Example

```typescript
function useScanProgress(plan: BuildPlan | null) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<BuildPlanExecutionResult | null>(null);

  useEffect(() => {
    if (!plan) return;

    setStatus('running');

    const execute = async () => {
      const response = await fetch('/api/execute-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.progress) setProgress(data.progress);
            if (data.success !== undefined) {
              setResult(data);
              setStatus(data.success ? 'complete' : 'error');
            }
          }
        }
      }
    };

    execute();
  }, [plan]);

  return { progress, status, result };
}
```

## Execution Flow

1. **Clone** - Repository cloned into sandbox (5-15%)
2. **Install** - Dependencies installed (15-40%)
3. **Build** - TypeScript compiled (40-70%)
4. **Analyze** - DocCov CLI generates spec (70-95%)
5. **Complete** - Results returned (100%)

## Sandbox Environment

- **Runtime**: Node.js 22
- **Resources**: 4 vCPUs
- **Timeout**: 5 minutes max
- **Isolation**: Vercel Sandbox (secure, isolated)

## Errors

| Error | Cause |
|-------|-------|
| `plan is required` | Missing plan in request |
| `Invalid plan structure` | Plan missing required fields |
| `Step 'X' failed: ...` | Build step failed |
| `Spec generation failed` | DocCov analysis failed |

## See Also

- [Plan Endpoint](./plan.md) - Generate a build plan
- [API Overview](../overview.md) - Full workflow
