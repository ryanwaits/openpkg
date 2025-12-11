# Badge Endpoint

Generate a Shields.io-style coverage badge.

## Endpoint

```
GET /badge/:owner/:repo
GET /badge/:owner/:repo.svg
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | path | GitHub username or org |
| `repo` | path | Repository name |

## Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `branch` | `main` | Git branch or tag |

## Response

Returns an SVG image.

### Success (200)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="82" height="20">
  <!-- docs: 85% badge -->
</svg>
```

### Not Found (404)

Returns a "docs: not found" badge.

### Error (500)

Returns a "docs: error" badge.

## Color Scale

| Coverage | Color |
|----------|-------|
| 90-100% | Bright green |
| 80-89% | Green |
| 70-79% | Yellow-green |
| 60-69% | Yellow |
| 50-59% | Orange |
| 0-49% | Red |

## Examples

### Basic Usage

```bash
curl https://api.doccov.com/badge/tanstack/query
```

### Specific Branch

```bash
curl "https://api.doccov.com/badge/tanstack/query?branch=v5"
```

### Markdown Embed

```markdown
![DocCov](https://api.doccov.com/badge/your-org/your-repo)
```

### HTML Embed

```html
<img src="https://api.doccov.com/badge/your-org/your-repo" alt="DocCov">
```

### With Link

```markdown
[![DocCov](https://api.doccov.com/badge/your-org/your-repo)](https://doccov.com/your-org/your-repo)
```

## Caching

- Success: Cached 5 minutes (`Cache-Control: public, max-age=300`)
- Error/Not Found: No cache

## Prerequisites

Requires `openpkg.json` in the repository root (main/master branch).

Generate it with:

```bash
doccov spec -o openpkg.json
git add openpkg.json
git commit -m "Add DocCov spec"
git push
```

## Local Testing

```bash
# Start API
cd packages/api && bun run dev

# Test badge
curl http://localhost:3000/badge/tanstack/query
```

## See Also

- [Widget](./widget.md) - Detailed signal breakdown
- [Badges & Widgets](../../integrations/badges-widgets.md) - README examples
- [spec Command](../../cli/commands/spec.md) - Create openpkg.json

