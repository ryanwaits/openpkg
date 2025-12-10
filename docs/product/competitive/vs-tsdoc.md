# DocCov vs TSDoc

> Last updated: 2024-12-08

Understanding the relationship between DocCov and TSDoc.

---

## Key Distinction

**TSDoc is a standard. DocCov is a tool.**

| Aspect | TSDoc | DocCov |
|--------|-------|--------|
| What it is | Documentation comment specification | Documentation quality platform |
| What it does | Defines syntax for doc comments | Measures, validates, enforces docs |
| Output | Parser library | Coverage scores, drift reports, fixes |

---

## What TSDoc Is

TSDoc is a proposal by Microsoft that standardizes the syntax for TypeScript documentation comments.

### Goals
- Unified syntax across the TypeScript ecosystem
- Machine-parseable doc comments
- Compatibility with JSDoc while extending it

### Key Tags
```typescript
/**
 * Description here.
 *
 * @param name - Parameter description
 * @returns Return value description
 * @example
 * ```ts
 * doSomething('hello');
 * ```
 * @public
 */
```

### Release Tags
- `@public` - Stable API
- `@beta` - Preview, may change
- `@alpha` - Experimental
- `@internal` - Not for public use

---

## How DocCov Uses TSDoc

DocCov **parses** TSDoc-compliant comments and:

1. **Validates** that docs match code
2. **Scores** documentation completeness
3. **Detects** drift between docs and signatures
4. **Fixes** mismatches automatically

### Parser
DocCov includes a TSDoc-compatible parser that handles:
- Standard tags (`@param`, `@returns`, `@example`)
- Release tags (`@public`, `@internal`, `@alpha`, `@beta`)
- Inline tags (`{@link}`, `{@see}`)
- Type annotations (`@param {string} name`)
- Optional parameters (`@param [name]`)
- Default values (`@param [name=default]`)

**Source**: `packages/sdk/src/utils/tsdoc-parser.ts`

---

## TSDoc Compliance

### What We Parse
| Tag | Parsed | Validated |
|-----|:------:|:---------:|
| `@param` | Yes | Yes (matches signature) |
| `@returns` | Yes | Yes (matches return type) |
| `@example` | Yes | Yes (type-check, runtime) |
| `@deprecated` | Yes | Yes (matches code) |
| `@public` | Yes | Yes (visibility match) |
| `@internal` | Yes | Yes (visibility match) |
| `@alpha` | Yes | Partial |
| `@beta` | Yes | Partial |
| `@see` | Yes | Yes (link validation) |
| `@link` | Yes | Yes (link validation) |
| `@throws` | Yes | No validation |
| `@since` | Yes | No validation |

### Gaps
- No `@packageDocumentation` support
- No `@inheritDoc` resolution (parsed but not followed)
- No modifier tags (`@virtual`, `@override`, `@sealed`)

---

## Relationship Summary

```
TSDoc (Standard)
    │
    ├── Defines syntax
    │
    └── Used by:
        ├── API Extractor (parses + enforces)
        ├── TypeDoc (parses + renders)
        └── DocCov (parses + validates + scores)
```

DocCov is TSDoc-compatible but focuses on **quality assurance** rather than strict TSDoc compliance enforcement.

---

## TODO

- [ ] Add TSDoc compliance checklist
- [ ] Document which TSDoc tags we support
- [ ] Add lint rules for TSDoc strictness
- [ ] Compare with @microsoft/tsdoc parser
