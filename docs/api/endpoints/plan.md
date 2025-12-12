# Plan Endpoint

Generate an AI-powered build plan for analyzing a GitHub repository.

## Endpoint

```
POST /plan
```

## Request Body

```json
{
  "url": "https://github.com/owner/repo",
  "ref": "main",
  "package": "packages/core"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `url` | Yes | GitHub repository URL |
| `ref` | No | Branch, tag, or commit (default: `main`) |
| `package` | No | Target package path in monorepo (e.g., `packages/core`) |

> **Note:** The `package` field should be the **directory path** to the package, not the npm package name. For example, use `packages/v0-sdk` not `v0-sdk` or `@v0-sdk/core`.

## Response

```json
{
  "plan": {
    "version": "1.0.0",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "target": {
      "type": "github",
      "repoUrl": "https://github.com/sindresorhus/ky",
      "ref": "main",
      "entryPoints": ["distribution/index.d.ts"]
    },
    "environment": {
      "runtime": "node22",
      "packageManager": "npm"
    },
    "steps": [
      {
        "id": "install",
        "name": "Install dependencies",
        "command": "npm",
        "args": ["install"],
        "timeout": 60000
      },
      {
        "id": "build",
        "name": "Build TypeScript",
        "command": "npm",
        "args": ["run", "build"],
        "timeout": 90000
      }
    ],
    "reasoning": {
      "summary": "TypeScript library requiring build step for type declarations",
      "rationale": "Package exports point to distribution/ folder...",
      "concerns": ["Build may fail if dependencies have issues"]
    },
    "confidence": "high"
  },
  "context": {
    "owner": "sindresorhus",
    "repo": "ky",
    "ref": "main",
    "packageManager": "npm",
    "isMonorepo": false
  }
}
```

## Examples

### Basic Usage

```bash
curl -X POST https://api.doccov.com/plan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/sindresorhus/ky"}'
```

### Specific Branch

```bash
curl -X POST https://api.doccov.com/plan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/tanstack/query", "ref": "v5.0.0"}'
```

### Monorepo Package

```bash
curl -X POST https://api.doccov.com/plan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/tanstack/query",
    "package": "packages/react-query"
  }'
```

## How It Works

1. Fetches repository metadata from GitHub API
2. Analyzes `package.json`, `tsconfig.json`, and lockfiles
3. Detects package manager, build scripts, entry points
4. Uses Claude AI to generate optimal build steps
5. Returns structured plan for execution

## AI Model

Uses Claude Sonnet for intelligent plan generation based on:
- Project structure and dependencies
- TypeScript configuration
- Build scripts and entry points
- Monorepo detection

## Confidence Levels

| Level | Meaning |
|-------|---------|
| `high` | Standard project, well-understood patterns |
| `medium` | Some complexity or unusual setup |
| `low` | Non-standard project, may need adjustments |

## Errors

```json
{
  "error": "Repository not found"
}
```

| Error | Cause |
|-------|-------|
| `url is required` | Missing URL in request body |
| `Invalid GitHub URL` | URL doesn't match GitHub format |
| `Repository not found` | Repo doesn't exist or is private |
| `Private repositories are not supported` | Repo requires authentication |
| `GitHub API rate limit exceeded` | Too many requests |

## See Also

- [Execute Endpoint](./execute.md) - Execute the generated plan
- [API Overview](../overview.md) - Full workflow example
