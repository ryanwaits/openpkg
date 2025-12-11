# Example Validation

> Last updated: 2024-12-08

How DocCov validates `@example` blocks.

---

## Overview

DocCov validates examples three ways:
1. **Type-checking** - Compile examples against signatures
2. **Runtime execution** - Actually run the code
3. **Assertion validation** - Check `// => expected` comments

---

## Type-Checking

```bash
doccov check --examples types
```

Compiles example code using TypeScript to catch:
- Type errors
- Missing imports
- Invalid API usage

---

## Runtime Execution

```bash
doccov check --examples run
```

Runs examples using Node.js with `--experimental-strip-types`:
- Catches runtime errors
- Validates actual behavior
- Timeout protection (default 5s)

---

## Inline Assertions

```typescript
/**
 * @example
 * console.log(add(2, 3)); // => 5
 */
```

DocCov:
1. Runs the example
2. Captures stdout
3. Compares against `// => expected`
4. Reports `example-assertion-failed` if mismatch

---

## Require Examples

```bash
# Fail if any export lacks @example
doccov check --examples presence
```

---

## TODO

- [ ] Document example format requirements
- [ ] Add troubleshooting for common failures
- [ ] Show example metadata (title, language)
- [ ] Document timeout configuration
