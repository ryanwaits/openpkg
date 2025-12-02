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
| `--output <format>` | `text` | Output format: `text` or `json` |
| `--fail-on-regression` | `false` | Exit 1 if coverage decreased |
| `--fail-on-drift` | `false` | Exit 1 if new drift introduced |
| `--docs <glob>` | - | Glob pattern for markdown docs to check for impact (repeatable) |
| `--fail-on-docs-impact` | `false` | Exit 1 if docs need updates due to API changes |
| `--ai` | `false` | Use AI for deeper analysis and fix suggestions |

## Examples

### Basic Diff

```bash
doccov diff old.json new.json
```

Output:

```
DocCov Diff Report
────────────────────────────────────

Coverage
  80% → 85% (+5%)

API Changes
  2 breaking change(s)
    - oldFunction
    - deprecatedHelper
  3 new export(s)
    + createUser
    + updateUser
    + deleteUser

Docs Health
  1 new undocumented export(s)
    ! deleteUser
  2 export(s) improved docs

Drift
  +1 new drift issue(s)
  -2 drift issue(s) resolved
```

### JSON Output

```bash
doccov diff old.json new.json --output json
```

```json
{
  "breaking": ["oldFunction", "deprecatedHelper"],
  "nonBreaking": ["createUser", "updateUser", "deleteUser"],
  "docsOnly": [],
  "coverageDelta": 5,
  "oldCoverage": 80,
  "newCoverage": 85,
  "newUndocumented": ["deleteUser"],
  "improvedExports": ["createUser", "updateUser"],
  "regressedExports": [],
  "driftIntroduced": 1,
  "driftResolved": 2
}
```

### Fail on Regression

For CI - fail if coverage dropped:

```bash
doccov diff base.json head.json --fail-on-regression
```

### Fail on New Drift

Fail if any new drift issues:

```bash
doccov diff base.json head.json --fail-on-drift
```

### Combined

```bash
doccov diff base.json head.json --fail-on-regression --fail-on-drift
```

## Docs Impact Analysis

Detect which markdown documentation files are impacted by API changes.

### Check Docs Impact

```bash
doccov diff base.json head.json --docs "docs/**/*.md"
```

Output includes a new section:

```
Docs Impact
  Scanned 15 file(s), 42 code block(s)

  3 file(s) need updates:
    📄 docs/getting-started.md
       Line 45: fetchData (signature changed)
       Line 78: fetchData (signature changed)
    📄 docs/guides/webhooks.mdx
       Line 23: legacyFetch (removed)

  1 new export(s) missing docs:
    • createWebhook
```

### Multiple Globs

```bash
doccov diff base.json head.json \
  --docs "docs/**/*.md" \
  --docs "README.md" \
  --docs "**/*.mdx"
```

### Fail on Docs Impact

For CI - fail if any docs need updates:

```bash
doccov diff base.json head.json --docs "docs/**/*.md" --fail-on-docs-impact
```

### AI-Enhanced Analysis

Get AI-generated summary and fix suggestions:

```bash
doccov diff base.json head.json --docs "docs/**/*.md" --ai
```

Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable.

### Config-Based Docs Paths

Instead of `--docs` flags, configure in `doccov.config.ts`:

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

### JSON Output with Docs Impact

```bash
doccov diff base.json head.json --docs "docs/**/*.md" --output json
```

```json
{
  "breaking": ["legacyFetch"],
  "nonBreaking": ["createWebhook"],
  "coverageDelta": 5,
  "docsImpact": {
    "impactedFiles": [
      {
        "file": "docs/getting-started.md",
        "references": [
          { "exportName": "fetchData", "line": 45, "changeType": "signature-changed" }
        ]
      }
    ],
    "missingDocs": ["createWebhook"],
    "stats": {
      "filesScanned": 15,
      "codeBlocksFound": 42,
      "referencesFound": 28,
      "impactedReferences": 3
    }
  }
}
```

## Change Categories

### Breaking Changes

Exports removed or with incompatible signature changes.

### Non-Breaking Changes

New exports added.

### Docs-Only Changes

Only documentation changed, API unchanged.

### Coverage Delta

Difference in package-wide coverage score.

### New Undocumented

New exports that lack documentation.

### Improved/Regressed Exports

Individual exports with better or worse coverage.

### Drift Changes

Count of new drift issues introduced or resolved.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or no `--fail-on-*` flags) |
| 1 | Regression or drift (with corresponding flags) |

## CI/CD Integration

### GitHub Actions PR Check

```yaml
- name: Generate head spec
  run: doccov generate -o head.json

- name: Download base spec
  run: curl -o base.json https://raw.githubusercontent.com/$REPO/main/openpkg.json

- name: Diff specs
  run: doccov diff base.json head.json --fail-on-regression
```

### PR Comment

```yaml
- name: Diff specs
  id: diff
  run: |
    doccov diff base.json head.json --output json > diff.json
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
bun run packages/cli/src/cli.ts generate tests/fixtures/simple-math.ts -o /tmp/v1.json

# Modify fixture, generate again
bun run packages/cli/src/cli.ts generate tests/fixtures/simple-math.ts -o /tmp/v2.json

# Diff
bun run packages/cli/src/cli.ts diff /tmp/v1.json /tmp/v2.json
```

## See Also

- [Diffing](../../spec/diffing.md) - SDK diff API
- [GitHub Action](../../integrations/github-action.md) - Full PR integration
- [generate](./generate.md) - Generate specs to diff

