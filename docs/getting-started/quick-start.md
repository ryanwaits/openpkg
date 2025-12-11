# Quick Start

Get DocCov running in 5 minutes.

## 1. Install

```bash
npm install -g @doccov/cli
```

## 2. Check Coverage

Run in your TypeScript project root:

```bash
doccov check --info
```

Output:

```
Coverage: 85% (17/20 documented)
Drift: 0 issues
Lint: 0 warnings
```

## 3. Generate Spec

Create an `openpkg.json` file:

```bash
doccov spec -o openpkg.json
```

This JSON file contains:
- Package metadata
- All exported functions, classes, types
- Full type information and signatures

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
doccov check --min-coverage 90 --examples presence
```

### Validate Examples Run

Execute `@example` blocks to catch runtime errors:

```bash
doccov check --examples run
```

### Generate Report

Create a markdown coverage report:

```bash
doccov check --format markdown -o COVERAGE.md
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
