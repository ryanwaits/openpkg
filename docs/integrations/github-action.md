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
| `strict` | - | Fail conditions: preset (`ci`, `release`, `quality`) or comma-separated checks |
| `docs-glob` | - | Glob pattern for markdown docs to check for impact |
| `format` | `github` | Output format for diff: `text`, `json`, `github` |
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

### Strict Mode with Presets

Use presets for common CI patterns:

```yaml
# Default CI protection
- uses: doccov/doccov@v1
  with:
    strict: ci

# Pre-release validation (all checks)
- uses: doccov/doccov@v1
  with:
    strict: release

# Documentation hygiene
- uses: doccov/doccov@v1
  with:
    strict: quality
```

| Preset | Checks | Use Case |
|--------|--------|----------|
| `ci` | breaking, regression | Default CI protection |
| `release` | breaking, regression, drift, docs-impact, undocumented | Pre-release validation |
| `quality` | drift, undocumented | Documentation hygiene |

Or use custom check combinations:

```yaml
- uses: doccov/doccov@v1
  with:
    strict: drift,undocumented
```

### PR Diff

```yaml
- uses: doccov/doccov@v1
  with:
    strict: regression
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
    strict: docs-impact
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
    strict: all
    docs-glob: 'docs/**/*.md'
```

## PR Comments

When `comment-on-pr: true`, the action posts an actionable comment with:

- Coverage summary with target comparison
- Undocumented exports grouped by file (with clickable links)
- Doc drift issues with fix guidance
- Contextual "How to fix" section
- Collapsible full metrics table

Example comment:

```markdown
## ✅ DocCov — Documentation Coverage

**Patch coverage:** 86% (target: 80%) ✅
**New undocumented exports:** 2
**Doc drift issues:** 1

### Undocumented exports in this PR

📁 [`packages/client/src/index.ts`](https://github.com/org/repo/blob/sha/packages/client/src/index.ts)
- `export function createClient(options: ClientOptions): Client`
  - Missing: description, `@param options`, `@returns`

### Doc drift detected

⚠️ `docs/api.md`: `fetchData`
- Parameter type mismatch: expected `string`, got `Options`
- Fix: Update @param type annotation

### How to fix

**For undocumented exports:**
Add JSDoc/TSDoc blocks with description, `@param`, and `@returns` tags.

**For doc drift:**
Update the code examples in your markdown files to match current signatures.

Push your changes — DocCov re-checks automatically.

<details>
<summary>View full report</summary>

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Coverage | 80% | 86% | +6% |
| Breaking changes | - | 0 | - |
| New exports | - | 3 | - |
| Undocumented | - | 2 | - |

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
      
      # Output GitHub annotations (shows inline in PR)
      - name: Diff with annotations
        run: npx @doccov/cli diff base.json head.json --docs "docs/**/*.md" --format github
      
      # Fail on conditions
      - name: Strict check
        run: npx @doccov/cli diff base.json head.json --strict regression,drift
          
      # Get JSON for PR comment
      - name: Get diff JSON
        id: diff
        run: |
          npx @doccov/cli diff base.json head.json --format json > diff.json
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

