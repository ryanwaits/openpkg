# Demo Endpoint

Analyze npm packages via Server-Sent Events stream.

## Endpoint

```
GET /demo/analyze?package=<npm-package>
```

## Parameters

| Param | Description |
|-------|-------------|
| `package` | npm package name (e.g., `lodash`, `@org/pkg`) |

## Response

**Content-Type:** `text/event-stream`

### Events

#### status

```json
{"type": "status", "message": "Fetching package info..."}
```

#### log

```json
{"type": "log", "message": "Found entry: dist/index.d.ts"}
```

#### result

```json
{
  "type": "result",
  "data": {
    "packageName": "lodash",
    "version": "4.17.21",
    "coverage": 85,
    "exportCount": 312,
    "documentedCount": 265,
    "undocumentedCount": 47,
    "driftCount": 12,
    "topUndocumented": ["_baseClone", "_baseGet"],
    "topDrift": ["merge", "clone"]
  }
}
```

#### error

```json
{"type": "error", "message": "Package not found"}
```

## Example

```typescript
const eventSource = new EventSource(
  'https://api.doccov.dev/demo/analyze?package=lodash'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'status':
      console.log('Status:', data.message);
      break;
    case 'result':
      console.log('Coverage:', data.data.coverage + '%');
      eventSource.close();
      break;
    case 'error':
      console.error('Error:', data.message);
      eventSource.close();
      break;
  }
};
```

## Rate Limiting

- 5 requests/hour per IP
- Upgrade for higher limits

## Pipeline

1. Fetch package metadata from npm registry
2. Download and extract tarball
3. Detect entry point (.d.ts or .ts)
4. Run DocCov analysis
5. Stream results

## Limitations

- Only analyzes published npm packages
- Requires TypeScript declarations
- 60 second timeout
- No private packages
