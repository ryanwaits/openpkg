# Quick Start

Get DocCov running in 5 minutes.

## 1. Install

```bash
npm install -D @doccov/cli
```

## 2. Add Config

```bash
npx doccov init --format yaml
```

Creates `doccov.yml`:

```yaml
check:
  # minCoverage: 80
```

## 3. Check Coverage

```bash
npx doccov check
```

## 4. Generate Spec

```bash
npx doccov spec -o openpkg.json
```

## 5. Add Badge

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)
```

Requires `openpkg.json` committed to main branch.

## 6. Add to CI

```yaml
# .github/workflows/docs.yml
name: Docs
on: [push, pull_request]

jobs:
  doccov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: doccov/doccov@v1
```

## Next Steps

- [Concepts](./concepts.md) - Coverage and drift
- [CLI Commands](../cli/overview.md) - Full reference
- [GitHub Action](../integrations/github-action.md) - Advanced CI
