# Badge Endpoint

Generate coverage badge SVG for README embedding.

## Endpoint

```
GET /badge/:owner/:repo
GET /badge/:owner/:repo.svg
```

## Parameters

### Path

| Param | Description |
|-------|-------------|
| `owner` | GitHub owner/org |
| `repo` | Repository name |

### Query

| Param | Default | Description |
|-------|---------|-------------|
| `ref` / `branch` | `main` | Git ref or branch |
| `path` / `package` | `openpkg.json` | Spec file path |
| `style` | `flat` | Badge style |

### Styles

- `flat` - Default flat style
- `flat-square` - Square corners
- `for-the-badge` - Large badge

## Response

**Content-Type:** `image/svg+xml`

**Cache:** 5 minutes, stale-if-error 1 hour

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="106" height="20">
  <!-- Badge SVG -->
</svg>
```

## Examples

### Basic

```markdown
![Coverage](https://api.doccov.dev/badge/owner/repo)
```

### Custom Branch

```markdown
![Coverage](https://api.doccov.dev/badge/owner/repo?branch=develop)
```

### Monorepo Package

```markdown
![Coverage](https://api.doccov.dev/badge/owner/repo?path=packages/core/openpkg.json)
```

### Style Variants

```markdown
![Coverage](https://api.doccov.dev/badge/owner/repo?style=for-the-badge)
```

## Coverage Calculation

1. Fetches `openpkg.json` from GitHub
2. If enriched spec: uses `docs.coverageScore`
3. Otherwise: calculates from export descriptions

## Errors

| Status | Description |
|--------|-------------|
| 404 | Spec not found |
| 422 | Invalid spec format |
| 429 | Rate limit (10/day per IP) |
| 500 | Server error |

Error badges show "error" text instead of percentage.

## Rate Limiting

- Anonymous: 10 requests/day per IP
- Authenticated: Unlimited

Upgrade to paid plan for unlimited badge requests.
