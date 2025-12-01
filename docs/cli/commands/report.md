# doccov report

Generate a documentation coverage report.

## Usage

```bash
doccov report [entry] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `entry` | Entry file or directory (auto-detected if omitted) |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--output <format>` | `markdown` | Format: `markdown`, `html`, `json` |
| `--out <file>` | stdout | Write to file instead of stdout |
| `--spec <file>` | - | Use existing openpkg.json |
| `--limit <n>` | `20` | Max exports shown in tables |
| `--skip-resolve` | `false` | Skip external type resolution from node_modules |
| `-p, --package <name>` | - | Target package in monorepo |
| `--cwd <dir>` | `.` | Working directory |

## Examples

### Markdown to Stdout

```bash
doccov report
```

### Save to File

```bash
doccov report --out COVERAGE.md
```

### HTML Report

```bash
doccov report --output html --out coverage.html
```

### JSON Report

```bash
doccov report --output json --out coverage.json
```

### From Existing Spec

Skip analysis, use existing file:

```bash
doccov report --spec openpkg.json
```

### Limit Exports

Show top 50 exports:

```bash
doccov report --limit 50
```

## Output Formats

### Markdown

```markdown
# Documentation Coverage Report

## Summary

| Metric | Value |
|--------|-------|
| Overall Coverage | 85% |
| Total Exports | 42 |
| Fully Documented | 36 |
| With Drift | 3 |

## Signal Coverage

| Signal | Coverage |
|--------|----------|
| Description | 95% |
| Parameters | 88% |
| Returns | 82% |
| Examples | 75% |

## Coverage by Kind

| Kind | Count | Avg Coverage |
|------|-------|--------------|
| function | 25 | 88% |
| class | 8 | 82% |
| interface | 9 | 79% |

## Lowest Coverage Exports

| Export | Kind | Coverage | Missing |
|--------|------|----------|---------|
| internalHelper | function | 25% | params, returns, examples |
| Config | interface | 50% | description, examples |

## Drift Issues

| Export | Type | Issue |
|--------|------|-------|
| getUser | param-mismatch | @param userId not in signature |
```

### HTML

Styled HTML report with the same sections.

### JSON

```json
{
  "summary": {
    "coverage": 85,
    "totalExports": 42,
    "fullyDocumented": 36,
    "withDrift": 3
  },
  "signals": {
    "description": 95,
    "params": 88,
    "returns": 82,
    "examples": 75
  },
  "byKind": {
    "function": { "count": 25, "avgCoverage": 88 },
    "class": { "count": 8, "avgCoverage": 82 },
    "interface": { "count": 9, "avgCoverage": 79 }
  },
  "lowestCoverage": [...],
  "drift": [...]
}
```

## Use Cases

### README Badge + Report

```bash
# Add to CI
doccov report --out docs/COVERAGE.md
git add docs/COVERAGE.md
git commit -m "docs: update coverage report"
```

### CI Artifact

```yaml
- name: Generate report
  run: doccov report --output html --out coverage.html

- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage.html
```

### JSON for Processing

```bash
doccov report --output json | jq '.summary.coverage'
```

## Local Testing

```bash
# Generate report
bun run packages/cli/src/cli.ts report tests/fixtures/docs-coverage

# Save to file
bun run packages/cli/src/cli.ts report tests/fixtures/docs-coverage --out /tmp/report.md
```

## See Also

- [check](./check.md) - Validate coverage
- [generate](./generate.md) - Generate spec
- [Badges & Widgets](../../integrations/badges-widgets.md) - README embeds

