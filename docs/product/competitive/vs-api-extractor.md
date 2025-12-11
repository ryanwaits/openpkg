# DocCov vs API Extractor

> Last updated: 2024-12-08

A detailed comparison between DocCov and Microsoft's API Extractor.

## Executive Summary

| Tool | Primary Mission |
|------|-----------------|
| **API Extractor** | "Prevent accidental API changes from shipping" |
| **DocCov** | "Ensure documentation is accurate, complete, and stays in sync with code" |

These tools solve **different problems** with some overlapping capabilities. DocCov provides significantly more functionality for documentation quality, while API Extractor excels at TypeScript declaration bundling.

---

## Quick Comparison

| Capability | DocCov | API Extractor |
|------------|:------:|:-------------:|
| Breaking change detection | Yes (with severity) | Yes (basic) |
| Member-level change tracking | Yes | No |
| Coverage scoring | Yes (0-100%) | No |
| Drift detection | Yes (14 types) | No |
| Auto-fix JSDoc | Yes | No |
| Example type-checking | Yes | No |
| Example runtime execution | Yes | No |
| External docs impact | Yes | No |
| GitHub PR annotations | Yes | No |
| API reference site generation | Yes (Fumadocs) | Via api-documenter |
| React component library | Yes (@doccov/ui) | No |
| `.d.ts` rollup generation | No | Yes |
| Release tag filtering | No | Yes |
| API review files | Partial | Yes |

---

## Detailed Comparison

### 1. API Change Detection

Both tools detect breaking changes, but DocCov provides more granular, actionable output.

#### API Extractor Output
```
API Report for "my-package"

> my-package.d.ts

// @public
export function createUser(name: string): User;  // CHANGED
```

Shows what changed at the export level with limited context.

#### DocCov Output
```
DocCov Diff Report
────────────────────────────────────────

Coverage
  80% → 85% (+5%)

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

**DocCov advantages:**
- **Member-level tracking**: Shows which methods within a class changed
- **Severity categorization**: high (function removed), medium (signature changed), low (type changed)
- **Migration hints**: `→ Use replayChainhook instead`
- **Signature diffs**: Shows before/after for signature changes
- **Coverage delta**: Tracks documentation health changes alongside API changes

---

### 2. Spec/Model Generation

Both tools generate structured JSON models of your API.

| Aspect | DocCov | API Extractor |
|--------|--------|---------------|
| Format | `openpkg.json` | `.api.json` |
| Schema | Open (JSON Schema published) | Proprietary |
| Signatures | Yes | Yes |
| Class members | Yes | Yes |
| Generics | Yes | Yes |
| JSDoc/TSDoc | Yes | Yes |
| Source locations | Yes | Yes |
| Coverage metadata | Yes | No |
| Drift metadata | Yes | No |

**Key difference**: DocCov's OpenPkg format is an open standard with a published JSON Schema. API Extractor's format is proprietary and tightly coupled to their toolchain.

---

### 3. Report Formats

| Format | DocCov | API Extractor |
|--------|:------:|:-------------:|
| JSON | Yes | Yes |
| Markdown | Yes | Yes (`.api.md`) |
| HTML | Yes | Via api-documenter |
| GitHub annotations | Yes | No |
| Text (CLI) | Yes (colorized) | Basic |

---

### 4. Documentation Quality

This is where DocCov significantly outperforms API Extractor.

#### Coverage Scoring
```bash
doccov check --format markdown

Coverage: 72%
| Signal      | Coverage |
|-------------|----------|
| description | 85%      |
| params      | 68%      |
| returns     | 71%      |
| examples    | 42%      |
```

**API Extractor**: No coverage scoring. Can warn on missing docs (`ae-undocumented`) but no metrics.

#### Drift Detection (14 types)

| Drift Type | DocCov | API Extractor |
|------------|:------:|:-------------:|
| param-mismatch | Yes | No |
| param-type-mismatch | Yes | No |
| return-type-mismatch | Yes | No |
| optionality-mismatch | Yes | No |
| deprecated-mismatch | Yes | No |
| async-mismatch | Yes | No |
| visibility-mismatch | Yes | No |
| property-type-drift | Yes | No |
| generic-constraint-mismatch | Yes | No |
| example-drift | Yes | No |
| example-syntax-error | Yes | No |
| example-runtime-error | Yes | No |
| example-assertion-failed | Yes | No |
| broken-link | Yes | Partial |

#### Auto-Fix
```bash
doccov check --fix

Found 3 fixable issue(s)

  src/client.ts:
    ✓ ChainhooksClient.createChainhook [line 45]
      + Update @param options type to {CreateOptions}
      + Add missing @param timeout
```

**API Extractor**: No auto-fix capability.

---

### 5. Example Validation

DocCov validates `@example` blocks three ways:

```bash
# Type-check examples against actual signatures
doccov check --examples types

# Execute examples and catch runtime errors
doccov check --examples run

# Validate inline assertions
# @example
# console.log(add(2, 3)); // => 5
```

**API Extractor**: Treats `@example` as content in the doc model. No validation.

---

### 6. External Documentation Impact

DocCov can scan markdown files and identify which docs are affected by API changes:

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

  Missing documentation for 1 new export(s):
    deleteUser
```

**API Extractor**: Only analyzes TypeScript source, not external documentation.

---

### 7. CI/CD Integration

#### DocCov
```yaml
- uses: doccov/doccov@v1
  with:
    min-coverage: 80
    require-examples: true
    strict: regression,drift,docs-impact,breaking,undocumented
    docs-glob: 'docs/**/*.md'
    comment-on-pr: true
```

Features:
- PR comments with coverage deltas
- Inline annotations on changed files
- Docs impact summary
- Multiple strict mode conditions

#### API Extractor
Basic CI support, no PR annotations or coverage comments.

---

### 8. Release Tags & Visibility

| Capability | DocCov | API Extractor |
|------------|:------:|:-------------:|
| Parse @internal | Yes | Yes |
| Parse @alpha | Yes | Yes |
| Parse @beta | Yes | Yes |
| Parse @public | Yes | Yes |
| Visibility mismatch detection | Yes | No |
| Filter exports by release stage | No | Yes |
| Trimmed `.d.ts` by release stage | No | Yes |

DocCov parses release tags and detects mismatches. API Extractor uses them for filtering and `.d.ts` generation.

---

## What API Extractor Has That DocCov Doesn't

### 1. `.d.ts` Rollup Generation

API Extractor bundles all type declarations into distributable files:

```
dist/
  my-package.d.ts        # Full declarations
  my-package-beta.d.ts   # @beta and @public only
  my-package-public.d.ts # @public only
```

Useful for:
- Cleaner npm packages
- Hiding internal types
- Release maturity filtering

**DocCov position**: This is a commodity feature. Alternatives exist (`dts-bundle-generator`, `rollup-plugin-dts`), and TypeScript may absorb it natively. Not on our roadmap.

### 2. API Review Files (`.api.md`)

API Extractor generates a deterministic, git-trackable file showing the full API surface. Teams use this with CODEOWNERS to require API review approval.

**DocCov position**: Our diff reports serve a similar purpose. Consider adding `--format api-surface` for a git-trackable output.

### 3. Rush Stack Integration

API Extractor integrates deeply with Microsoft's Rush Stack monorepo toolchain.

**DocCov position**: We work with any TypeScript project. Lower barrier to entry.

---

## What DocCov Has That API Extractor Doesn't

1. **Coverage scoring** (0-100% per export and aggregate)
2. **14 drift types** with detection and auto-fix
3. **Example validation** (type-check, runtime, assertions)
4. **External docs impact** analysis
5. **GitHub PR annotations** with line-level precision
6. **Migration hints** for breaking changes
7. **Member-level change tracking** (methods, constructors)
8. **AI-powered analysis** (optional)
9. **Remote repository scanning**
10. **Open spec format** (OpenPkg with JSON Schema)
11. **Modern API reference site generation** (Fumadocs adapter with React components)
12. **Coverage badges and drift indicators** embedded in rendered docs
13. **Interactive code examples** with CodeHike syntax highlighting

---

## When to Use Each

### Use DocCov When
- Documentation quality is a priority
- You need to enforce coverage thresholds
- You want to catch docs/code drift before shipping
- You need to validate that examples actually work
- You want to know which markdown files need updates
- You want auto-fix for documentation issues

### Use API Extractor When
- You need `.d.ts` rollup generation for npm publishing
- You have formal API review processes with CODEOWNERS
- You're in the Rush Stack / Microsoft monorepo ecosystem
- You need strict release tag governance with `.d.ts` trimming

### Use Both Together
DocCov for documentation quality enforcement, API Extractor for `.d.ts` rollups. They complement each other.

---

## Summary

| Dimension | Winner | Notes |
|-----------|--------|-------|
| Breaking change detection | **DocCov** | Severity, member-level, migration hints |
| Documentation quality | **DocCov** | No contest - API Extractor doesn't play here |
| External docs tracking | **DocCov** | API Extractor can't do this |
| Auto-fix | **DocCov** | API Extractor can't do this |
| Example validation | **DocCov** | API Extractor can't do this |
| CI/CD experience | **DocCov** | PR annotations, comments, strict modes |
| API reference sites | **DocCov** | Modern React components vs basic api-documenter |
| `.d.ts` bundling | **API Extractor** | DocCov doesn't attempt this |
| Release tag filtering | **API Extractor** | DocCov parses but doesn't filter |
| Ecosystem lock-in | **DocCov** | More portable, open spec |

**Bottom line**: For teams building TypeScript libraries who care about documentation quality, DocCov is the superior choice. DocCov also provides better API reference site generation via its Fumadocs adapter. The only reason to also use API Extractor is if you need `.d.ts` rollups.
