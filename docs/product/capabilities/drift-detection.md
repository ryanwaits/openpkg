# Drift Detection

> Last updated: 2024-12-08

Complete guide to DocCov's 14 drift detection types.

---

## Overview

"Drift" is when documentation doesn't match the code. DocCov detects 14 types of drift.

---

## Drift Types

### 1. param-mismatch
**What**: `@param` tag references a parameter that doesn't exist.
**Auto-fix**: Yes
**Example**:
```typescript
/**
 * @param userId - The user ID  // But signature has `id`
 */
function getUser(id: string) {}
```

### 2. param-type-mismatch
**What**: `@param {type}` doesn't match signature type.
**Auto-fix**: Yes
**Example**:
```typescript
/**
 * @param {string} count  // But signature has `number`
 */
function process(count: number) {}
```

### 3. return-type-mismatch
**What**: `@returns {type}` doesn't match actual return type.
**Auto-fix**: Yes

### 4. optionality-mismatch
**What**: `[param]` bracket notation doesn't match signature optionality.
**Auto-fix**: Yes

### 5. deprecated-mismatch
**What**: `@deprecated` tag without matching code flag, or vice versa.
**Auto-fix**: Yes

### 6. async-mismatch
**What**: Function returns Promise but docs don't indicate async.
**Auto-fix**: Yes

### 7. visibility-mismatch
**What**: `@internal`/`@public` doesn't match actual visibility.
**Auto-fix**: Yes

### 8. property-type-drift
**What**: Class property type annotation doesn't match `@type`.
**Auto-fix**: Yes

### 9. generic-constraint-mismatch
**What**: `@template` constraint doesn't match actual constraint.
**Auto-fix**: Yes

### 10. example-drift
**What**: Example code references deleted/renamed exports.
**Auto-fix**: No

### 11. example-syntax-error
**What**: Example has TypeScript syntax errors.
**Auto-fix**: No

### 12. example-runtime-error
**What**: Example throws when executed.
**Auto-fix**: No

### 13. example-assertion-failed
**What**: `// => expected` doesn't match actual output.
**Auto-fix**: Yes (can update expected value)

### 14. broken-link
**What**: `{@link Foo}` or `@see Foo` references non-existent export.
**Auto-fix**: No

---

## Detection

```bash
# Standard analysis includes drift detection
doccov check

# View drift in coverage report
doccov check --format json | jq '.exports[].docs.drift'
```

---

## TODO

- [ ] Add detailed examples for each type
- [ ] Show CLI output for each
- [ ] Document suggestion messages
- [ ] Add troubleshooting guide
