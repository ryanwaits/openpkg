# doccov check

Analyze documentation coverage with threshold validation, auto-fix, and AI generation.

## Usage

```bash
doccov check [entry] [options]
```

## Options

### Input/Output

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Working directory |
| `--package <name>` | Target monorepo package |
| `--format <fmt>` | Output: `text` \| `json` \| `markdown` \| `html` \| `github` |
| `-o, --output <file>` | Custom output path |
| `--stdout` | Output to stdout |
| `--limit <n>` | Max exports in tables (default: 20) |

### Thresholds

| Flag | Description |
|------|-------------|
| `--min-coverage <n>` | Minimum coverage % (0-100) |
| `--max-drift <n>` | Maximum drift % (0-100) |

### Analysis

| Flag | Description |
|------|-------------|
| `--examples [mode]` | Example validation: `presence`, `typecheck`, `run` |
| `--skip-resolve` | Skip external type resolution |
| `--max-type-depth <n>` | Type recursion depth (default: 20) |
| `--visibility <tags>` | Filter: `public`, `beta`, `alpha`, `internal` |

### Auto-fix & AI

| Flag | Description |
|------|-------------|
| `--fix` / `--write` | Auto-fix drift issues |
| `--generate` | AI-generate missing JSDoc (requires `--fix`) |
| `--dry-run` | Preview fixes without writing |

### Ownership

| Flag | Description |
|------|-------------|
| `--owners` | Coverage breakdown by CODEOWNERS |
| `--contributors` | Show doc contributors (git blame) |

### Cache

| Flag | Description |
|------|-------------|
| `--no-cache` | Bypass spec cache |
| `--update-snapshot` | Force regenerate report |

## Examples

### Basic check

```bash
doccov check
```

### Enforce thresholds in CI

```bash
doccov check --min-coverage 80 --max-drift 5
```

### Auto-fix drift

```bash
doccov check --fix
```

### AI-generate missing docs

```bash
doccov check --fix --generate
```

### Validate examples run

```bash
doccov check --examples run
```

### GitHub Actions output

```bash
doccov check --format github >> $GITHUB_STEP_SUMMARY
```

### CODEOWNERS breakdown

```bash
doccov check --owners
```

## Output Formats

### text (default)

```
@myorg/core@1.0.0
  Coverage:  85% ████████░░
  Drift:     3 issues (2 fixable)
  Exports:   42 total, 36 documented
```

### json

Full report saved to `.doccov/report.json`:

```json
{
  "coverage": { "score": 85, "totalExports": 42 },
  "exports": { ... },
  "driftSummary": { ... }
}
```

### markdown

Detailed tables with signal coverage, drift breakdown, lowest-scoring exports.

### github

```
::warning file=src/utils.ts,line=42::Missing @param for 'options'
```

## Exit Codes

- `0` - All thresholds passed
- `1` - Threshold failed or error

## Behavior

1. Resolves entry file (from package.json or CLI arg)
2. Loads config for thresholds/filters
3. Analyzes with DocCov SDK
4. Enriches spec with coverage data
5. Validates examples if `--examples`
6. Auto-fixes drift if `--fix`
7. AI-generates docs if `--generate`
8. Evaluates policies if configured
9. Outputs in requested format
10. Exits 1 if thresholds fail
