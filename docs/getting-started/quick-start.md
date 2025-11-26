# Quick Start

Get DocCov running in 5 minutes.

## 1. Install

```bash
npm install -g @doccov/cli
```

## 2. Check Coverage

Run in your TypeScript project root:

```bash
doccov check
```

Output:

```
✓ Auto-detected entry point: src/index.ts
✓ Documentation analysis complete
✓ Docs coverage 85% (min 80%)
```

## 3. Generate Spec

Create an `openpkg.json` file:

```bash
doccov generate -o openpkg.json
```

This JSON file contains:
- Package metadata
- All exported functions, classes, types
- Documentation coverage scores
- Drift issues (JSDoc out of sync with code)

## 4. Add a Badge

Add to your README:

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)
```

Requires `openpkg.json` committed to your repo's main branch.

## 5. Enforce in CI

Add to GitHub Actions:

```yaml
name: Docs
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx @doccov/cli check --min-coverage 80
```

## Common Workflows

### Strict Mode

Require examples and higher coverage:

```bash
doccov check --min-coverage 90 --require-examples
```

### Validate Examples Run

Execute `@example` blocks to catch runtime errors:

```bash
doccov check --run-examples
```

### Generate Report

Create a markdown coverage report:

```bash
doccov report --output markdown --out COVERAGE.md
```

### Scan Any Repo

Analyze a public GitHub repository:

```bash
doccov scan https://github.com/tanstack/query
```

## Next Steps

- [Concepts](./concepts.md) - Understand coverage and drift
- [CLI Commands](../cli/overview.md) - Full command reference
- [GitHub Action](../integrations/github-action.md) - Advanced CI setup

