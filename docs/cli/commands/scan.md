# doccov scan

Analyze documentation coverage for any public GitHub repository.

## Usage

```bash
doccov scan <url> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `url` | GitHub repository URL |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--ref <branch>` | `main` | Branch or tag to analyze |
| `--package <name>` | - | Target package in monorepo |
| `--output <format>` | `text` | Output: `text` or `json` |
| `--skip-install` | `false` | Skip dependency installation |
| `--save-spec <path>` | - | Save full spec to file |
| `--no-cleanup` | `false` | Keep cloned repo (debugging) |

## Examples

### Basic Scan

```bash
doccov scan https://github.com/tanstack/query
```

Output:

```
Scanning github.com/tanstack/query
Branch/tag: main

✓ Cloned tanstack/query
✓ Dependencies installed
✓ Entry point: src/index.ts (from package.json)
✓ Analysis complete

DocCov Scan Results
────────────────────────────────────
Repository: tanstack/query
Branch: main

Coverage
  72%

Stats
  156 exports
  89 types
  43 undocumented
  12 drift issues

Undocumented Exports
  ! QueryClient
  ! useQuery
  ! useMutation
  ... and 40 more

Drift Issues
  • fetchQuery: param-mismatch
  • prefetchQuery: return-type-mismatch
  ... and 10 more
```

### Specific Branch

```bash
doccov scan https://github.com/colinhacks/zod --ref v3.22.4
```

### Monorepo Package

```bash
doccov scan https://github.com/tanstack/query --package @tanstack/react-query
```

### JSON Output

```bash
doccov scan https://github.com/pmndrs/zustand --output json
```

```json
{
  "owner": "pmndrs",
  "repo": "zustand",
  "ref": "main",
  "coverage": 65,
  "exportCount": 24,
  "typeCount": 18,
  "driftCount": 3,
  "undocumented": ["create", "useStore"],
  "drift": [
    {
      "export": "createStore",
      "type": "param-mismatch",
      "issue": "@param initializer not in signature"
    }
  ]
}
```

### Save Full Spec

```bash
doccov scan https://github.com/jaredpalmer/formik --save-spec formik-spec.json
```

### Skip Install (Faster)

```bash
doccov scan https://github.com/simple/repo --skip-install
```

Note: Type resolution may be limited without dependencies.

### Keep Cloned Repo

For debugging:

```bash
doccov scan https://github.com/user/repo --no-cleanup
```

## URL Formats

All supported:

```bash
doccov scan https://github.com/owner/repo
doccov scan github.com/owner/repo
doccov scan owner/repo
```

## Monorepo Detection

DocCov auto-detects monorepos:

```
Monorepo detected with 5 packages. Specify target with --package:

  @tanstack/query-core
  @tanstack/react-query
  @tanstack/vue-query
  @tanstack/solid-query
  @tanstack/svelte-query
```

## Package Manager Detection

Auto-detects from lockfile:

| File | Package Manager |
|------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `bun.lock` | bun |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |

## LLM Fallback

For complex projects (WASM, unusual structures), set `OPENAI_API_KEY` for smart entry point detection:

```bash
export OPENAI_API_KEY=sk-...
doccov scan https://github.com/aspect-build/aspect-cli
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Clone failed, package not found, analysis error |

## Local Testing

```bash
# Scan public repo
bun run packages/cli/src/cli.ts scan https://github.com/colinhacks/zod

# Keep temp directory for debugging
bun run packages/cli/src/cli.ts scan https://github.com/pmndrs/zustand --no-cleanup
```

## API Equivalent

The `/scan-stream` API endpoint provides the same functionality with SSE progress:

```bash
curl "https://api.doccov.com/scan-stream?url=https://github.com/owner/repo&owner=owner&repo=repo"
```

See [Scan Stream API](../../api/endpoints/scan-stream.md).

## See Also

- [Scan Stream API](../../api/endpoints/scan-stream.md) - Web API version
- [check](./check.md) - Local project checking
- [generate](./generate.md) - Local spec generation

