# Widget Endpoint

Generate an embeddable coverage widget with signal breakdown.

## Endpoint

```
GET /widget/:owner/:repo
GET /widget/:owner/:repo.svg
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
| `theme` | `dark` | Theme: `dark` or `light` |
| `compact` | `false` | Compact mode (no labels) |

## Response

Returns an SVG image with signal breakdown.

### Widget Content

Shows coverage for each signal:

- **desc**: Description coverage
- **params**: Parameter documentation
- **returns**: Return value documentation
- **examples**: Example coverage

Plus overall coverage score.

## Examples

### Basic Usage

```bash
curl https://api.doccov.com/widget/tanstack/query
```

### Light Theme

```bash
curl "https://api.doccov.com/widget/tanstack/query?theme=light"
```

### Compact Mode

```bash
curl "https://api.doccov.com/widget/tanstack/query?compact=true"
```

### Markdown Embed

```markdown
![DocCov](https://api.doccov.com/widget/your-org/your-repo?theme=dark)
```

### HTML Embed

```html
<img 
  src="https://api.doccov.com/widget/your-org/your-repo?theme=light" 
  alt="DocCov Coverage"
>
```

## Widget Appearance

### Dark Theme (default)

- Background: #0d1117
- Text: #c9d1d9
- Accent: #58a6ff

### Light Theme

- Background: #ffffff
- Text: #24292f
- Accent: #58a6ff

### Compact Mode

- Smaller width (160px vs 200px)
- No signal labels, just bars and percentages

## Signal Colors

Each signal bar is colored based on its coverage:

| Coverage | Color |
|----------|-------|
| 90-100% | Bright green |
| 80-89% | Green |
| 70-79% | Yellow-green |
| 60-69% | Yellow |
| 50-59% | Orange |
| 0-49% | Red |

## Caching

- Success: Cached 5 minutes
- Error/Not Found: No cache

## Prerequisites

Requires `openpkg.json` in the repository root.

## Local Testing

```bash
cd packages/api && bun run dev
curl "http://localhost:3000/widget/tanstack/query?theme=light"
```

## See Also

- [Badge](./badge.md) - Simple coverage badge
- [Badges & Widgets](../../integrations/badges-widgets.md) - Embed examples

