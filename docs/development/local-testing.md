# Local Testing

How to test DocCov packages locally during development.

## Prerequisites

- [Bun](https://bun.sh) installed
- Clone the repo: `git clone https://github.com/doccov/doccov`
- Install dependencies: `bun install`

## CLI

Run CLI commands directly from source:

```bash
# From repo root
bun run packages/cli/src/cli.ts <command> [options]

# Examples
bun run packages/cli/src/cli.ts check tests/fixtures/docs-coverage
bun run packages/cli/src/cli.ts generate tests/fixtures/simple-math.ts -o /tmp/spec.json
bun run packages/cli/src/cli.ts diff tests/fixtures/snapshots/simple-math.json /tmp/spec.json
```

### Using Test Fixtures

The `tests/fixtures/` directory contains test cases:

| Fixture | Purpose |
|---------|---------|
| `simple-math.ts` | Basic function exports |
| `docs-coverage/` | Coverage scoring tests |
| `drift-param-mismatch/` | Parameter drift detection |
| `drift-return-type/` | Return type drift |
| `drift-example/` | Example drift detection |
| `example-runner/` | Runnable example tests |

Example:

```bash
bun run packages/cli/src/cli.ts check tests/fixtures/drift-param-mismatch
```

## SDK

### Run Tests

```bash
# All SDK tests
bun test packages/sdk/test/

# Specific test file
bun test packages/sdk/test/docs-coverage.test.ts

# Watch mode
bun test packages/sdk/test/ --watch
```

### Test Coverage Analysis

```typescript
import { DocCov } from './packages/sdk/src';

const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('tests/fixtures/simple-math.ts');
console.log(result.spec);
```

## API

### Local Development Server

Start the Hono dev server:

```bash
cd packages/api
bun run dev
```

Server runs at `http://localhost:3000`.

Test endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Badge (requires openpkg.json in target repo)
curl http://localhost:3000/badge/tanstack/query

# Leaderboard
curl http://localhost:3000/leaderboard
```

### Vercel Dev (Full Simulation)

For endpoints using Vercel Sandbox (scan, examples):

```bash
cd packages/api
vercel dev
```

This simulates the Vercel environment locally.

### Testing Scan Endpoint

The scan endpoint clones repos and runs analysis:

```bash
# Local (uses spawn, not sandbox)
curl "http://localhost:3000/scan-stream?url=https://github.com/colinhacks/zod&owner=colinhacks&repo=zod"
```

### Testing Examples Endpoint

```bash
curl -X POST http://localhost:3000/api/examples/run \
  -H "Content-Type: application/json" \
  -d '{
    "packageName": "zod",
    "code": "import { z } from \"zod\";\nconsole.log(z.string().parse(\"hello\"));"
  }'
```

## Spec Package

### Run Tests

```bash
bun test packages/spec/test/
```

### Test Validation

```typescript
import { validateSpec, normalize } from './packages/spec/src';

const spec = JSON.parse(fs.readFileSync('openpkg.json', 'utf-8'));
const normalized = normalize(spec);
const result = validateSpec(normalized);
console.log(result.ok ? 'Valid' : result.errors);
```

### Test Diffing

```typescript
import { diffSpec } from './packages/spec/src';

const oldSpec = JSON.parse(fs.readFileSync('old.json', 'utf-8'));
const newSpec = JSON.parse(fs.readFileSync('new.json', 'utf-8'));
const diff = diffSpec(oldSpec, newSpec);
console.log(diff);
```

## Build Packages

```bash
# Build all packages
bun run build

# Build specific package
cd packages/cli && bun run build
```

## Linting

```bash
bun run lint
```

## Common Issues

### TypeScript Errors

If you see TS errors, ensure dependencies are installed:

```bash
bun install
```

### Port Already in Use

Kill existing processes:

```bash
lsof -ti:3000 | xargs kill -9
```

### Sandbox Not Available Locally

The Vercel Sandbox only works in Vercel environment. Locally, the API falls back to Node.js spawn for example execution.

## See Also

- [Contributing](./contributing.md) - Contribution guidelines
- [Vercel Deployment](./vercel-deployment.md) - Production deploy

