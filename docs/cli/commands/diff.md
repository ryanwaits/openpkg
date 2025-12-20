# doccov diff

Compare two OpenPkg specs and report changes.

## Usage

```bash
doccov diff <base> <head> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `base` | Path to base/old spec file |
| `head` | Path to head/new spec file |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `text`, `json`, `github`, `pr-comment`, `markdown`, `html` |
| `--strict <preset>` | - | Fail conditions: preset (`ci`, `release`, `quality`) or comma-separated checks |
| `--docs <glob>` | - | Glob pattern for markdown docs to check for impact (repeatable) |
| `--repo-url <url>` | - | GitHub repo URL for file links (pr-comment format) |
| `--sha <sha>` | - | Commit SHA for file links (pr-comment format) |
| `--min-coverage <n>` | - | Minimum coverage % for HEAD spec |
| `--ai` | `false` | Use AI for deeper analysis and fix suggestions |

### Output Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| `text` | Human-readable CLI output | Local dev, quick checks |
| `json` | Structured JSON object | AI/LLM consumption, programmatic use |
| `github` | GitHub Actions annotations | CI inline feedback in PR diffs |
| `pr-comment` | PR comment markdown | GitHub PR comments with actionable info |
| `markdown` | Full markdown report | Documentation, sharing |
| `html` | HTML report | Standalone viewing |

### Strict Presets

| Preset | Checks | Use Case |
|--------|--------|----------|
| `ci` | breaking, regression | Default CI protection |
| `release` | breaking, regression, drift, docs-impact, undocumented | Pre-release validation |
| `quality` | drift, undocumented | Documentation hygiene |

### Individual Checks

| Check | Description |
|-------|-------------|
| `regression` | Fail if coverage decreased |
| `drift` | Fail if new drift introduced |
| `docs-impact` | Fail if docs need updates (requires `--docs`) |
| `breaking` | Fail if any breaking changes detected |
| `undocumented` | Fail if new exports lack documentation |

## Examples

### Basic Diff

```bash
doccov diff old.json new.json
```

Output:

```
DocCov Diff Report
────────────────────────────────────────

Coverage
  80% ↑ 85% (+5%)

API Changes
  ChainhooksClient [BREAKING]
    ✖ evaluateChainhook() → Use replayChainhook instead
    ~ bulkEnableChainhooks() signature changed
        was: bulkEnableChainhooks(filters)
        now: bulkEnableChainhooks(options)
    + deleteAllChainhooks(), replayChainhook()

  Function Changes (1):
    ✖ legacyFetch (removed)

  New Exports (3) (1 undocumented)
    + createUser, updateUser, deleteUser

  Drift: +1 drift, -2 resolved
```

### JSON Output

```bash
doccov diff old.json new.json --format json
```

```json
{
  "breaking": ["legacyFetch", "ChainhooksClient"],
  "nonBreaking": ["createUser", "updateUser", "deleteUser"],
  "coverageDelta": 5,
  "oldCoverage": 80,
  "newCoverage": 85,
  "categorizedBreaking": [
    { "id": "legacyFetch", "name": "legacyFetch", "kind": "function", "severity": "high", "reason": "removed" }
  ],
  "memberChanges": [
    { "className": "ChainhooksClient", "memberName": "evaluateChainhook", "changeType": "removed", "suggestion": "Use replayChainhook instead" }
  ],
  "newUndocumented": ["deleteUser"],
  "driftIntroduced": 1,
  "driftResolved": 2
}
```

### GitHub Annotations

For CI - output annotations that show inline in PR diffs:

```bash
doccov diff base.json head.json --format github
```

```
::warning file=docs/evaluate.mdx,line=30,title=API Change::evaluateChainhook() removed → Use replayChainhook instead
::error title=Breaking Change::legacyFetch - removed
::notice title=Missing Documentation::New export deleteUser needs documentation
```

### Strict Mode

Fail CI on specific conditions using presets:

```bash
# Use preset - default CI protection
doccov diff base.json head.json --strict ci

# Use preset - pre-release validation
doccov diff base.json head.json --strict release

# Use preset - documentation hygiene
doccov diff base.json head.json --strict quality

# Custom checks
doccov diff base.json head.json --strict regression,drift,undocumented
```

### PR Comment Format

Generate markdown optimized for GitHub PR comments:

```bash
doccov diff base.json head.json --format pr-comment \
  --repo-url https://github.com/org/repo \
  --sha abc123 \
  --min-coverage 80
```

Output includes:
- Coverage summary with target comparison
- Undocumented exports grouped by file (with clickable links)
- Doc drift issues with fix guidance
- Contextual "How to fix" section
- Collapsible full metrics table

### HTML Report

Generate a standalone HTML report:

```bash
doccov diff base.json head.json --format report > report.html
```

## Docs Impact Analysis

Detect which markdown documentation files are impacted by API changes.

### Check Docs Impact

```bash
doccov diff base.json head.json --docs "docs/**/*.md"
```

Output:

```
Docs Requiring Updates
  Scanned 15 files, 42 code blocks

  evaluate.mdx (2 issues)
    L30: evaluateChainhook() → Use replayChainhook instead
    L44: evaluateChainhook() → Use replayChainhook instead

  create.mdx (4 issues)
    L78: bulkEnableChainhooks() ~ signature changed
    L96: bulkEnableChainhooks() ~ signature changed
    ... and 2 more

  5 file(s) with class instantiation to review:
    migration.mdx, update.mdx, secrets.mdx, ...

  Missing documentation for 1 new export(s):
    deleteUser
```

### Multiple Globs

```bash
doccov diff base.json head.json \
  --docs "docs/**/*.md" \
  --docs "README.md" \
  --docs "**/*.mdx"
```

### Fail on Docs Impact

```bash
doccov diff base.json head.json --docs "docs/**/*.md" --strict docs-impact
```

### AI-Enhanced Analysis

Get AI-generated summary and fix suggestions:

```bash
doccov diff base.json head.json --docs "docs/**/*.md" --ai
```

Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable.

### Config-Based Docs Paths

Configure in `doccov.config.ts`:

```typescript
export default defineConfig({
  docs: {
    include: ['docs/**/*.md', 'README.md'],
    exclude: ['docs/archive/**'],
  },
});
```

Then just run:

```bash
doccov diff base.json head.json
```

## Change Categories

### Breaking Changes (High Severity)

- Functions removed
- Class methods removed
- Constructor signature changed

### Breaking Changes (Medium Severity)

- Method signature changed
- Interface/type definition changed

### Non-Breaking Changes

- New exports added

### Coverage Delta

Difference in package-wide coverage score.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or no `--strict` options) |
| 1 | Strict condition failed |

## CI/CD Integration

### GitHub Actions with Annotations

```yaml
- name: Generate specs
  run: |
    doccov spec -o head.json
    git fetch origin main
    git checkout origin/main -- openpkg.json
    mv openpkg.json base.json

- name: Diff with annotations
  run: doccov diff base.json head.json --docs "docs/**/*.md" --format github

- name: Strict check
  run: doccov diff base.json head.json --strict regression,drift
```

### PR Comment with JSON

```yaml
- name: Diff specs
  id: diff
  run: |
    doccov diff base.json head.json --format json > diff.json
    echo "delta=$(jq .coverageDelta diff.json)" >> $GITHUB_OUTPUT

- name: Comment on PR
  uses: actions/github-script@v7
  with:
    script: |
      const delta = ${{ steps.diff.outputs.delta }};
      const emoji = delta > 0 ? '📈' : delta < 0 ? '📉' : '➡️';
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: `${emoji} Coverage: ${delta > 0 ? '+' : ''}${delta}%`
      });
```

## Local Testing

```bash
# Generate two specs
doccov spec tests/fixtures/v1 -o /tmp/v1.json
doccov spec tests/fixtures/v2 -o /tmp/v2.json

# Diff with different formats
doccov diff /tmp/v1.json /tmp/v2.json --format text
doccov diff /tmp/v1.json /tmp/v2.json --format json
doccov diff /tmp/v1.json /tmp/v2.json --format github
```

## See Also

- [Diffing](../../spec/diffing.md) - SDK diff API
- [GitHub Action](../../integrations/github-action.md) - Full PR integration
- [spec](./spec.md) - Generate specs to diff
