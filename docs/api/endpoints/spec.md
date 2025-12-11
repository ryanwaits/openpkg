# Spec Endpoint

Fetch OpenPkg specifications from GitHub repositories.

## Endpoints

```
GET /spec/:owner/:repo
GET /spec/:owner/:repo/:ref
GET /spec/:owner/:repo/pr/:pr
```

## GET /spec/:owner/:repo/:ref?

Fetch spec from a branch or tag.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | path | GitHub username or org |
| `repo` | path | Repository name |
| `ref` | path | Branch or tag (optional, default: `main`) |

### Response

Returns the full OpenPkg spec JSON.

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.2.0/openpkg.schema.json",
  "openpkg": "0.2.0",
  "meta": {
    "name": "zod",
    "version": "3.22.4"
  },
  "exports": [...],
  "types": [...],
  "docs": {
    "coverageScore": 85
  }
}
```

### Examples

```bash
# Default branch (main)
curl https://api.doccov.com/spec/colinhacks/zod

# Specific branch
curl https://api.doccov.com/spec/colinhacks/zod/v3.22.4

# Specific tag
curl https://api.doccov.com/spec/tanstack/query/v5.0.0
```

### Not Found

```json
{
  "error": "Spec not found"
}
```

## GET /spec/:owner/:repo/pr/:pr

Fetch spec from a pull request's head commit.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | path | GitHub username or org |
| `repo` | path | Repository name |
| `pr` | path | Pull request number |

### Response

Returns the spec from the PR's head SHA.

### Examples

```bash
curl https://api.doccov.com/spec/tanstack/query/pr/123
```

### Errors

```json
{
  "error": "PR not found"
}
```

```json
{
  "error": "Spec not found in PR"
}
```

## Use Cases

### Fetch for Comparison

```javascript
// Fetch base and head specs
const baseSpec = await fetch('https://api.doccov.com/spec/owner/repo/main').then(r => r.json());
const headSpec = await fetch('https://api.doccov.com/spec/owner/repo/pr/123').then(r => r.json());

// Compare using @openpkg-ts/spec
import { diffSpec } from '@openpkg-ts/spec';
const diff = diffSpec(baseSpec, headSpec);
```

### CI/CD Integration

```yaml
- name: Fetch base spec
  run: curl -o base.json https://api.doccov.com/spec/${{ github.repository }}/main

- name: Generate head spec
  run: doccov spec -o head.json

- name: Compare
  run: doccov diff base.json head.json --fail-on-regression
```

### Display Coverage

```javascript
const spec = await fetch('https://api.doccov.com/spec/owner/repo').then(r => r.json());
console.log(`Coverage: ${spec.docs?.coverageScore ?? 0}%`);
```

## Caching

- Success: Cached 5 minutes (`Cache-Control: public, max-age=300`)
- PR specs: No cache (always fetches latest)
- Error: No cache

## Prerequisites

Repository must have `openpkg.json` committed.

Generate with:

```bash
doccov spec -o openpkg.json
git add openpkg.json && git commit -m "Add DocCov spec" && git push
```

## Branch Resolution

Tries `main` first, then `master` as fallback.

## Local Testing

```bash
cd packages/api && bun run dev

curl http://localhost:3000/spec/colinhacks/zod
curl http://localhost:3000/spec/colinhacks/zod/v3.22.4
```

## See Also

- [Badge](./badge.md) - Badge uses this internally
- [Diffing](../../spec/diffing.md) - Compare specs
- [spec Command](../../cli/commands/spec.md) - Create spec

