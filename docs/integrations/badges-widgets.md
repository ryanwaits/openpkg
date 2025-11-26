# Badges & Widgets

Embed coverage badges and widgets in your README.

## Coverage Badge

Simple Shields.io-style badge showing coverage percentage.

### Markdown

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)
```

### With Link

```markdown
[![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)](https://doccov.com/YOUR_ORG/YOUR_REPO)
```

### HTML

```html
<img src="https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO" alt="DocCov">
```

### Specific Branch

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO?branch=develop)
```

## Coverage Widget

Detailed widget showing signal breakdown.

### Dark Theme (default)

```markdown
![DocCov](https://api.doccov.com/widget/YOUR_ORG/YOUR_REPO)
```

### Light Theme

```markdown
![DocCov](https://api.doccov.com/widget/YOUR_ORG/YOUR_REPO?theme=light)
```

### Compact Mode

```markdown
![DocCov](https://api.doccov.com/widget/YOUR_ORG/YOUR_REPO?compact=true)
```

### All Options

```markdown
![DocCov](https://api.doccov.com/widget/YOUR_ORG/YOUR_REPO?theme=light&compact=true&branch=main)
```

## Prerequisites

Both badge and widget require `openpkg.json` in your repository:

```bash
# Generate spec
doccov generate -o openpkg.json

# Commit and push
git add openpkg.json
git commit -m "Add DocCov spec"
git push
```

## Color Scale

| Coverage | Badge Color |
|----------|-------------|
| 90-100% | Bright green |
| 80-89% | Green |
| 70-79% | Yellow-green |
| 60-69% | Yellow |
| 50-59% | Orange |
| 0-49% | Red |

## Examples

### Complete README Section

```markdown
## Documentation

[![DocCov](https://api.doccov.com/badge/myorg/myrepo)](https://doccov.com/myorg/myrepo)

This project maintains 85%+ documentation coverage.

<details>
<summary>Coverage Breakdown</summary>

![Coverage](https://api.doccov.com/widget/myorg/myrepo?theme=light)

</details>
```

### Badges Row

```markdown
[![npm](https://img.shields.io/npm/v/mypackage)](https://npmjs.com/package/mypackage)
[![DocCov](https://api.doccov.com/badge/myorg/myrepo)](https://doccov.com/myorg/myrepo)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
```

### In Table

```markdown
| Package | Version | Docs |
|---------|---------|------|
| core | 1.0.0 | ![](https://api.doccov.com/badge/myorg/core) |
| react | 1.0.0 | ![](https://api.doccov.com/badge/myorg/react) |
```

## Widget Details

The widget shows coverage for each signal:

| Signal | Description |
|--------|-------------|
| desc | Description coverage |
| params | Parameter documentation |
| returns | Return value documentation |
| examples | Example coverage |

Plus overall coverage score.

## Caching

Badges and widgets are cached for 5 minutes. Changes to `openpkg.json` may take a few minutes to reflect.

## Not Found

If `openpkg.json` is missing:
- Badge shows "docs: not found" (grey)
- Widget shows "not found"

## CI/CD Integration

Auto-update badge on push:

```yaml
# .github/workflows/docs.yml
name: Update Docs
on:
  push:
    branches: [main]

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx @doccov/cli generate -o openpkg.json
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "docs: update coverage spec"
          file_pattern: openpkg.json
```

## See Also

- [Badge Endpoint](../api/endpoints/badge.md) - API reference
- [Widget Endpoint](../api/endpoints/widget.md) - API reference
- [generate Command](../cli/commands/generate.md) - Create spec

