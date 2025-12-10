# Feature Comparison Matrix

> Last updated: 2024-12-08

Master comparison of DocCov against the TypeScript documentation ecosystem.

## Tools Compared

| Tool | Primary Purpose | Maintainer |
|------|-----------------|------------|
| **DocCov** | Documentation coverage, drift detection, quality enforcement | DocCov |
| **API Extractor** | API contract governance, .d.ts rollups | Microsoft |
| **TypeDoc** | API reference site generation | TypeDoc contributors |
| **TSDoc** | Documentation comment standard (not a tool) | Microsoft |

---

## Comparison Matrix

### Legend
- **Yes** = Full support
- **Partial** = Limited or basic support
- **No** = Not supported
- **N/A** = Not applicable to this tool

---

### 1. Spec/Model Generation

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Structured JSON output | Yes (`openpkg.json`) | Yes (`.api.json`) | Yes (JSON plugin) |
| Open/documented schema | Yes (JSON Schema) | No (proprietary) | No |
| Export signatures | Yes | Yes | Yes |
| Class members | Yes | Yes | Yes |
| Type parameters/generics | Yes | Yes | Yes |
| Decorators | Yes | Yes | Yes |
| Heritage (extends/implements) | Yes | Yes | Yes |
| JSDoc/TSDoc parsing | Yes | Yes | Yes |
| Source locations | Yes | Yes | Yes |

### 2. Report Generation

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| JSON format | Yes | Yes | Yes |
| Markdown format | Yes | Yes (`.api.md`) | Yes |
| HTML format | Yes | No (via api-documenter) | Yes |
| GitHub annotations | Yes | No | No |
| Coverage statistics | Yes | No | No |
| Drift issue listing | Yes | No | No |

### 3. API Change Detection

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Breaking change detection | Yes | Yes | No |
| Non-breaking change detection | Yes | Yes | No |
| Docs-only change detection | Yes | No | No |
| Severity categorization (high/med/low) | Yes | No | No |
| Member-level tracking | Yes | No | No |
| Constructor change detection | Yes | No | No |
| Method removal detection | Yes | No | No |
| Signature diff (was/now) | Yes | No | No |
| Migration hints/suggestions | Yes | No | No |
| Coverage delta tracking | Yes | No | No |

### 4. Documentation Coverage

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Coverage scoring (0-100%) | Yes | No | No |
| Per-export coverage | Yes | No | No |
| Signal-level coverage (params, returns, examples) | Yes | No | No |
| Coverage thresholds in CI | Yes | No | No |
| Coverage badges | Yes | No | No |
| Missing docs detection | Yes | Partial (`ae-undocumented`) | No |

### 5. Drift Detection

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Param name mismatch | Yes | No | No |
| Param type mismatch | Yes | No | No |
| Return type mismatch | Yes | No | No |
| Optionality mismatch | Yes | No | No |
| Deprecated mismatch | Yes | No | No |
| Async/Promise mismatch | Yes | No | No |
| Visibility mismatch | Yes | No | No |
| Property type drift | Yes | No | No |
| Generic constraint mismatch | Yes | No | No |
| Broken @link/@see references | Yes | Partial | Partial |
| Example drift | Yes | No | No |
| Example syntax errors | Yes | No | No |
| Example runtime errors | Yes | No | No |
| Example assertion failures | Yes | No | No |
| **Total drift types** | **14** | **~2** | **~1** |

### 6. Auto-Fix

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Auto-fix JSDoc issues | Yes | No | No |
| Fix param mismatches | Yes | No | No |
| Fix type mismatches | Yes | No | No |
| Fix optionality | Yes | No | No |
| Fix deprecated tags | Yes | No | No |
| Add missing params | Yes | No | No |
| Add missing returns | Yes | No | No |
| Dry-run mode | Yes | No | No |

### 7. Example Validation

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Type-check @example blocks | Yes | No | No |
| Runtime execution of examples | Yes | No | No |
| Inline assertion validation (`// => value`) | Yes | No | No |
| Structured example metadata (title, lang) | Yes | No | No |
| Require examples enforcement | Yes | No | No |

### 8. External Documentation

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Scan markdown files | Yes | No | No |
| Detect impacted docs from API changes | Yes | No | No |
| Line-level impact reporting | Yes | No | No |
| Code block extraction | Yes | No | No |
| Missing docs suggestions | Yes | No | No |

### 9. Linting

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Require description | Yes | Partial | No |
| Require example | Yes | No | No |
| No empty returns | Yes | No | No |
| Consistent param style | Yes | No | No |
| Pluggable rule system | Yes | No | No |
| TSDoc syntax validation | Partial | Yes | Partial |
| Release tag enforcement | No | Yes | No |

### 10. Release Tags & Visibility

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Parse @internal | Yes | Yes | Yes |
| Parse @alpha | Yes | Yes | No |
| Parse @beta | Yes | Yes | No |
| Parse @public | Yes | Yes | Yes |
| Filter output by release stage | No | Yes | No |
| Visibility mismatch detection | Yes | No | No |

### 11. CI/CD Integration

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| GitHub Actions support | Yes | Yes | Yes |
| PR comments | Yes | No | No |
| Inline file annotations | Yes | No | No |
| Configurable fail conditions | Yes | Partial | No |
| Strict modes (regression, drift, breaking, etc.) | Yes | Partial | No |

### 12. Output & Publishing

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| `.d.ts` rollup generation | No | Yes | No |
| `.d.ts` trimming by release stage | No | Yes | No |
| API review file (git-trackable) | Partial (via diff) | Yes (`.api.md`) | No |
| Doc site integration | Yes (Fumadocs adapter) | Via api-documenter | Yes (standalone) |

### 13. API Reference Site Generation

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| React component library | Yes (@doccov/ui) | No | No |
| Framework integration | Yes (Fumadocs) | Via api-documenter | Standalone |
| Function documentation pages | Yes | Yes | Yes |
| Class documentation pages | Yes | Yes | Yes |
| Interface/Type pages | Yes | Yes | Yes |
| Enum documentation pages | Yes | Yes | Yes |
| Collapsible method sections | Yes | No | No |
| Interactive code examples | Yes (CodeHike) | No | Partial |
| Coverage badges inline | Yes | No | No |
| Drift indicators in docs | Yes | No | No |
| Two-column layouts | Yes | No | Partial |
| Syntax highlighting | Yes (CodeHike) | Basic | Yes (Shiki) |
| Copy code buttons | Yes | No | Yes |
| Dark/light theme | Yes | Partial | Yes |
| Mobile responsive | Yes | Partial | Yes |
| Parameter cards | Yes | No | No |
| Type tables | Yes | Yes | Yes |
| Signature rendering | Yes (with generics) | Yes | Yes |
| Extends/implements display | Yes | Yes | Yes |

### 14. Other Capabilities

| Capability | DocCov | API Extractor | TypeDoc |
|------------|:------:|:-------------:|:-------:|
| Remote repo scanning | Yes | No | No |
| Monorepo support | Yes | Yes | Yes |
| AI-powered analysis | Yes (optional) | No | No |
| Open spec format | Yes (OpenPkg) | No | No |
| Watch mode | Yes | No | Yes |

---

## Summary Scorecard

| Category | DocCov | API Extractor | TypeDoc |
|----------|:------:|:-------------:|:-------:|
| Spec generation | 9/9 | 9/9 | 8/9 |
| Report generation | 6/6 | 3/6 | 4/6 |
| Change detection | 10/10 | 2/10 | 0/10 |
| Coverage | 6/6 | 1/6 | 0/6 |
| Drift detection | 14/14 | 2/14 | 1/14 |
| Auto-fix | 8/8 | 0/8 | 0/8 |
| Example validation | 5/5 | 0/5 | 0/5 |
| External docs | 5/5 | 0/5 | 0/5 |
| Linting | 5/7 | 3/7 | 1/7 |
| Release tags | 5/6 | 6/6 | 2/6 |
| CI/CD | 5/5 | 2/5 | 1/5 |
| Output/publishing | 2/4 | 4/4 | 2/4 |
| API reference sites | 16/18 | 8/18 | 12/18 |
| **Total** | **96/103** | **40/103** | **31/103** |

---

## When to Use Each Tool

### Use DocCov When
- Documentation quality is a priority
- You need to enforce coverage thresholds
- You want to catch docs/code drift before shipping
- You need to validate that examples actually work
- You want to know which markdown files are impacted by API changes
- You want auto-fix for documentation issues
- You want polished, interactive API reference pages in your existing doc site (Fumadocs)
- You want coverage badges and drift indicators embedded in your docs

### Use API Extractor When
- You need `.d.ts` rollup generation for npm publishing
- You have formal API review processes with CODEOWNERS
- You're in the Rush Stack / Microsoft monorepo ecosystem
- You need strict release tag governance (@alpha/@beta trimming)

### Use TypeDoc When
- You need a standalone API reference website (not integrated into existing docs)
- You want out-of-the-box doc site with minimal config
- Documentation quality enforcement isn't a priority

### Use Multiple Tools Together
- **DocCov + API Extractor**: DocCov for docs quality + site generation, API Extractor for `.d.ts` rollups
- **DocCov replaces TypeDoc**: Use DocCov's Fumadocs adapter for better API reference with quality signals built-in

---

## Notes

1. This matrix reflects capabilities as of the last update date
2. "Partial" indicates basic support that doesn't match full feature parity
3. API Extractor comparisons based on v7.x
4. TypeDoc comparisons based on v0.25.x
