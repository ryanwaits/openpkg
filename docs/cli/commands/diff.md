# doccov diff

Compare two OpenPkg specs to detect breaking changes, coverage delta, and docs impact.

## Usage

```bash
doccov diff [base] [head] [options]
# or
doccov diff --base <file> --head <file>
```

## Options

### Input

| Flag | Description |
|------|-------------|
| `--base <file>` | Base spec (the "before" state) |
| `--head <file>` | Head spec (the "after" state) |
| `--cwd <dir>` | Working directory |

### Output

| Flag | Description |
|------|-------------|
| `--format <fmt>` | `text`, `json`, `markdown`, `html`, `github`, `pr-comment`, `changelog` |
| `-o, --output <file>` | Output path |
| `--stdout` | Output to stdout |
| `--limit <n>` | Max items (default: 10) |

### Validation

| Flag | Description |
|------|-------------|
| `--min-coverage <n>` | Min coverage % for HEAD |
| `--max-drift <n>` | Max drift % for HEAD |
| `--strict <preset>` | Fail on: `ci`, `release`, `quality` |

### Enhancement

| Flag | Description |
|------|-------------|
| `--docs <glob>` | Markdown docs to check for impact |
| `--ai` | AI-powered analysis |
| `--recommend-version` | Output semver bump recommendation |
| `--repo-url <url>` | GitHub repo for file links |
| `--sha <sha>` | Commit SHA for links |

## Examples

### Compare specs

```bash
doccov diff old-spec.json new-spec.json
```

### CI validation

```bash
doccov diff --base main.json --head pr.json --strict ci
```

### PR comment format

```bash
doccov diff --base base.json --head head.json \
  --format pr-comment \
  --repo-url https://github.com/org/repo \
  --sha abc123
```

### Semver recommendation

```bash
doccov diff base.json head.json --recommend-version
# Output: minor (2 new exports added)
```

### Docs impact analysis

```bash
doccov diff base.json head.json --docs "docs/**/*.md"
```

## Strict Mode Presets

| Preset | Fails on |
|--------|----------|
| `ci` | breaking changes, coverage regression |
| `release` | breaking, regression, drift, docs-impact, undocumented |
| `quality` | drift, undocumented exports |

## Output

### SpecDiff Result

```typescript
{
  breaking: string[];      // Removed or signature-changed exports
  nonBreaking: string[];   // New exports
  docsOnly: string[];      // Documentation-only changes
  coverageDelta: number;   // Coverage change (+/-)
  oldCoverage: number;
  newCoverage: number;
  newUndocumented: string[];
  improvedExports: string[];
  regressedExports: string[];
  driftIntroduced: number;
  driftResolved: number;
}
```

### pr-comment Format

```markdown
## DocCov Report

| Metric | Value |
|--------|-------|
| Coverage | 85% (+5%) |
| Breaking | 0 |
| New exports | 3 |

### Undocumented Exports
- `newFunction` ([src/utils.ts:42](link))
```

### changelog Format

```markdown
## Breaking Changes
- **REMOVED** `deprecatedFn` (high severity)

## New Exports
- `newHelper` (function)

## Documentation
- 3 exports improved
- 1 drift resolved

**Recommended version bump:** minor
```

## Semver Recommendation

Based on changes:
- **major**: Any breaking changes
- **minor**: New exports added
- **patch**: Documentation-only changes
- **none**: No changes
