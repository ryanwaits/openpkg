# Examples Run Endpoint

Execute TypeScript code examples in a sandboxed environment.

## Endpoint

```
POST /api/examples/run
```

## Request Body

```json
{
  "packageName": "zod",
  "packageVersion": "3.22",
  "code": "import { z } from 'zod';\nconsole.log(z.string().parse('hello'));"
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `packageName` | Yes | npm package to install |
| `packageVersion` | No | Specific version (default: latest) |
| `code` | Yes | TypeScript/JavaScript code to execute |

## Response

```json
{
  "success": true,
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "duration": 1234
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether execution succeeded |
| `stdout` | string | Standard output |
| `stderr` | string | Standard error |
| `exitCode` | number | Process exit code |
| `duration` | number | Execution time in ms |

## Examples

### Basic Usage

```bash
curl -X POST https://api.doccov.com/api/examples/run \
  -H "Content-Type: application/json" \
  -d '{
    "packageName": "zod",
    "code": "import { z } from \"zod\";\nconsole.log(z.string().parse(\"hello\"));"
  }'
```

### With Markdown Code Block

The endpoint strips markdown code fences:

```json
{
  "packageName": "lodash",
  "code": "```typescript\nimport _ from 'lodash';\nconsole.log(_.capitalize('hello'));\n```"
}
```

### Specific Version

```json
{
  "packageName": "zod",
  "packageVersion": "3.21.4",
  "code": "import { z } from 'zod';\nconsole.log(z.ZodType);"
}
```

## Error Responses

### Missing Package Name

```json
{
  "error": "packageName is required"
}
```

### Missing Code

```json
{
  "error": "code is required"
}
```

### Execution Error

```json
{
  "success": false,
  "stdout": "",
  "stderr": "ReferenceError: foo is not defined",
  "exitCode": 1,
  "duration": 456
}
```

### Install Error

```json
{
  "success": false,
  "stdout": "",
  "stderr": "Failed to install nonexistent-package@latest: npm ERR! 404",
  "exitCode": 1,
  "duration": 2000
}
```

## Runtime

### Production (Vercel)

Uses Vercel Sandbox:
- Isolated environment
- Node.js 22 with `--experimental-strip-types`
- 30-second timeout
- Auto-cleanup

### Development (Local)

Uses Node.js spawn:
- Creates temp directory
- Installs package
- Runs with `--experimental-strip-types`
- Cleans up on completion

## Use Cases

### Validate @example Blocks

```javascript
const examples = spec.exports.flatMap(e => e.examples ?? []);

for (const code of examples) {
  const result = await fetch('https://api.doccov.com/api/examples/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageName: spec.meta.name,
      code
    })
  }).then(r => r.json());
  
  if (!result.success) {
    console.log(`Example failed: ${result.stderr}`);
  }
}
```

### Interactive Playground

```javascript
async function runCode(code) {
  const result = await fetch('/api/examples/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageName: 'zod',
      code
    })
  }).then(r => r.json());
  
  document.getElementById('output').textContent = result.stdout || result.stderr;
}
```

## Timeout

- Production: 30 seconds max
- Local: 5 seconds for execution, 15 seconds for install

## Security

- Code runs in isolated Vercel Sandbox
- No network access from sandbox
- No filesystem persistence
- Auto-cleanup after execution

## Local Testing

```bash
cd packages/api && bun run dev

curl -X POST http://localhost:3000/api/examples/run \
  -H "Content-Type: application/json" \
  -d '{"packageName": "zod", "code": "console.log(\"hello\")"}'
```

## See Also

- [Example Runner SDK](../../sdk/example-runner.md) - Programmatic API
- [check --run-examples](../../cli/commands/check.md) - CLI integration
- [Drift Types](../../spec/drift-types.md) - `example-runtime-error` drift

