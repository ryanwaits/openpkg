# External Documentation Impact

> Last updated: 2024-12-08

How DocCov identifies which markdown files are affected by API changes.

---

## Overview

When your API changes, DocCov can scan external documentation (markdown files) to identify which files need updates.

---

## How It Works

1. Parse markdown files and extract code blocks
2. Identify API references (imports, function calls, class usage)
3. Cross-reference with spec changes
4. Report impacted files with line numbers

---

## Configuration

### Via CLI
```bash
doccov diff base.json head.json --docs "docs/**/*.md"
```

### Via Config
```typescript
// doccov.config.ts
export default defineConfig({
  docs: {
    include: ['docs/**/*.md', 'README.md'],
    exclude: ['docs/archive/**'],
  },
});
```

---

## Output

```
Docs Requiring Updates
  Scanned 15 files, 42 code blocks

  evaluate.mdx (2 issues)
    L30: evaluateChainhook() → Use replayChainhook instead
    L44: evaluateChainhook() → Use replayChainhook instead

  create.mdx (4 issues)
    L78: bulkEnableChainhooks() ~ signature changed
```

---

## TODO

- [ ] Document code block extraction
- [ ] Explain reference detection algorithm
- [ ] Add examples of different impact types
- [ ] Show GitHub annotation output
