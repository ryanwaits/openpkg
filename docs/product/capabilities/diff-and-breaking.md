# Diff & Breaking Change Detection

> Last updated: 2024-12-08

How DocCov detects and categorizes API changes.

---

## Overview

The `doccov diff` command compares two specs and reports:
- Breaking changes
- Non-breaking changes
- Docs-only changes
- Coverage delta
- Drift changes

---

## Change Categories

### Breaking
API-incompatible changes that require consumer updates:
- Export removed
- Signature changed
- Required parameter added
- Type incompatibly changed

### Non-Breaking
Additive changes that don't break consumers:
- New exports added
- Optional parameter added

### Docs-Only
Changes that only affect documentation:
- Description updated
- Examples changed
- Tags modified

---

## Severity Levels

| Severity | Examples |
|----------|----------|
| **High** | Function/class removed, constructor changed, method removed |
| **Medium** | Interface/type changed, signature modified |
| **Low** | Variable changed, other modifications |

---

## Member-Level Tracking

For classes, DocCov tracks individual member changes:
- Method added/removed/changed
- Property added/removed/changed
- Constructor changed

---

## Commands

```bash
# Basic diff
doccov diff base.json head.json

# With strict modes
doccov diff base.json head.json --strict breaking,regression

# With docs impact
doccov diff base.json head.json --docs "docs/**/*.md"

# Different formats
doccov diff base.json head.json --format github
doccov diff base.json head.json --format json
```

---

## TODO

- [ ] Add example output for each change type
- [ ] Document member change detection algorithm
- [ ] Add migration hints documentation
- [ ] Show integration with CI
