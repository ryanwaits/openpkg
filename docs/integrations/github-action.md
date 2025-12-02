# GitHub Action

Run DocCov checks in your GitHub workflows.

## Quick Start

```yaml
name: Docs Coverage
on: [push, pull_request]

jobs:
  doccov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: doccov/doccov@v1
        with:
          min-coverage: 80
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `min-coverage` | `80` | Minimum coverage percentage |
| `require-examples` | `false` | Require `@example` on all exports |
| `fail-on-regression` | `false` | Fail if coverage decreased |
| `fail-on-drift` | `false` | Fail if new drift introduced |
| `docs-glob` | - | Glob pattern for markdown docs to check for impact |
| `fail-on-docs-impact` | `false` | Fail if docs need updates due to API changes |
| `comment-on-pr` | `true` | Post coverage report as PR comment |
| `working-directory` | `.` | Working directory |
| `skip-generate` | `false` | Skip spec generation and use existing openpkg.json |
| `github-token` | `${{ github.token }}` | Token for PR comments |

## Outputs

| Output | Description |
|--------|-------------|
| `coverage` | Current coverage percentage |
| `coverage-delta` | Coverage change compared to base (on PRs) |
| `drift-count` | Number of drift issues detected |
| `docs-impact-count` | Number of docs files needing updates |

## Examples

### Basic Check

```yaml
- uses: doccov/doccov@v1
  with:
    min-coverage: 80
```

### Strict Mode

```yaml
- uses: doccov/doccov@v1
  with:
    min-coverage: 90
    require-examples: true
    fail-on-drift: true
```

### PR Diff

```yaml
- uses: doccov/doccov@v1
  with:
    fail-on-regression: true
    comment-on-pr: true
```

### Monorepo

```yaml
- uses: doccov/doccov@v1
  with:
    working-directory: packages/core
    min-coverage: 85
```

### Docs Impact Check

Check if API changes affect your documentation:

```yaml
- uses: doccov/doccov@v1
  with:
    docs-glob: 'docs/**/*.md'
    fail-on-docs-impact: true
```

This will fail the check if:
- Any markdown code blocks reference changed exports
- New exports don't have corresponding documentation

### Full Protection

```yaml
- uses: doccov/doccov@v1
  with:
    min-coverage: 90
    require-examples: true
    fail-on-regression: true
    fail-on-drift: true
    docs-glob: 'docs/**/*.md'
    fail-on-docs-impact: true
```

## PR Comments

When `comment-on-pr: true`, the action posts a comment with:

- Coverage percentage
- Coverage delta (vs base branch)
- New undocumented exports
- Drift issues introduced/resolved
- **Docs impact** (if `docs-glob` is set)

Example comment:

```markdown
## 📈 DocCov Report

| Metric | Value |
|--------|-------|
| Coverage | 80% → 85% (+5%) |
| New exports | 3 |
| Undocumented | 1 |
| Drift introduced | 0 |
| Drift resolved | 2 |

## 📚 Documentation Impact

### Files Needing Updates

| File | Issues |
|------|--------|
| `docs/getting-started.md` | 2 reference(s) |
| `docs/guides/webhooks.mdx` | 1 reference(s) |

### Missing Documentation

- `createWebhook()` - new export with no docs

<details>
<summary>View details</summary>

#### docs/getting-started.md

- **Line 45**: `fetchData` (signature changed)
- **Line 78**: `fetchData` (signature changed)

</details>
```

## Manual Setup

If not using the action, run CLI directly:

```yaml
name: Docs Coverage
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
      
      - name: Check docs coverage
        run: npx @doccov/cli check --min-coverage 80
```

## Diff Workflow

Compare PR changes to base branch:

```yaml
name: Docs Diff
on: pull_request

jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - run: npm ci
      
      # Generate head spec
      - name: Generate head spec
        run: npx @doccov/cli generate -o head.json
      
      # Get base spec
      - name: Checkout base
        run: git checkout ${{ github.base_ref }}
        
      - name: Generate base spec
        run: npx @doccov/cli generate -o base.json
        
      - name: Checkout head
        run: git checkout ${{ github.head_ref }}
      
      # Compare
      - name: Diff specs
        id: diff
        run: |
          npx @doccov/cli diff base.json head.json --output json > diff.json
          echo "delta=$(jq .coverageDelta diff.json)" >> $GITHUB_OUTPUT
          
      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const delta = ${{ steps.diff.outputs.delta }};
            const emoji = delta > 0 ? '📈' : delta < 0 ? '📉' : '➡️';
            const sign = delta > 0 ? '+' : '';
            
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `${emoji} **DocCov**: Coverage ${sign}${delta}%`
            });
```

## Badge in README

After setting up CI:

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)
```

Requires `openpkg.json` committed to main branch.

## Caching

Speed up workflows by caching node_modules:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

## Artifacts

Save coverage report as artifact:

```yaml
- name: Generate report
  run: npx @doccov/cli report --output html --out coverage.html

- uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage.html
```

## Status Check

The action sets a commit status check. Configure required checks in repository settings.

## See Also

- [CI/CD](./ci-cd.md) - Other CI systems
- [diff Command](../cli/commands/diff.md) - CLI diffing
- [Badges & Widgets](./badges-widgets.md) - README embeds

