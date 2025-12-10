# Auto-Fix

> Last updated: 2024-12-08

How DocCov automatically repairs documentation issues.

---

## Overview

DocCov can automatically fix many drift issues:

```bash
doccov check --fix
```

---

## Fixable Issues

| Issue | Fix Applied |
|-------|-------------|
| Missing `@param` | Generated from signature |
| Wrong param type | Updated from signature |
| Missing `@returns` | Added with return type |
| Optionality mismatch | Bracket notation corrected |
| Deprecated mismatch | Tag added/removed |
| Visibility mismatch | Tag corrected |

---

## Dry Run

Preview changes without applying:

```bash
doccov check --fix --dry-run
```

---

## Output

```
Found 3 fixable issue(s)

  src/client.ts:
    ✓ ChainhooksClient.createChainhook [line 45]
      + Update @param options type to {CreateOptions}
      + Add missing @param timeout

    ✓ getUser [line 120]
      + Add @returns {Promise<User>}
```

---

## What Can't Be Fixed

- `example-drift` - Requires manual update
- `example-syntax-error` - Requires manual fix
- `example-runtime-error` - Requires manual fix
- `broken-link` - Requires manual resolution

---

## TODO

- [ ] Document fix algorithm
- [ ] Show before/after examples
- [ ] Add configuration options
- [ ] Document conflict resolution
