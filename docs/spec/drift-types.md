# Drift Types Reference

DocCov detects 10 types of documentation drift - when JSDoc comments don't match actual code.

## Parameter Drift

### param-mismatch

JSDoc documents a parameter that doesn't exist in the signature.

**Trigger**: `@param foo` but signature has different parameters.

**Example**:

```typescript
/**
 * @param userId - The user ID  // ❌ Drift: param is "id", not "userId"
 */
function getUser(id: string) {}
```

**Output**:

```
param-mismatch: @param userId not in signature
  Suggestion: Did you mean "id"?
```

### param-type-mismatch

JSDoc type annotation differs from actual TypeScript type.

**Trigger**: `@param {string} id` but actual type is `number`.

**Example**:

```typescript
/**
 * @param {string} count  // ❌ Drift: actual type is number
 */
function setCount(count: number) {}
```

**Output**:

```
param-type-mismatch: @param {string} count but signature has number
```

### optionality-mismatch

JSDoc marks parameter as optional but code requires it (or vice versa).

**Trigger**: `[param]` in JSDoc but parameter is required.

**Example**:

```typescript
/**
 * @param [name]  // ❌ Drift: param is required
 */
function greet(name: string) {}
```

**Output**:

```
optionality-mismatch: @param [name] marked optional but signature requires it
```

## Return Type Drift

### return-type-mismatch

JSDoc return type differs from actual return type.

**Trigger**: `@returns {User}` but function returns `Promise<User>`.

**Example**:

```typescript
/**
 * @returns {User}  // ❌ Drift: actually returns Promise<User>
 */
async function getUser(): Promise<User> {}
```

**Output**:

```
return-type-mismatch: @returns {User} but signature returns Promise<User>
```

## Generic Drift

### generic-constraint-mismatch

JSDoc template constraint doesn't match TypeScript constraint.

**Trigger**: `@template T extends string` but code has `T extends number`.

**Example**:

```typescript
/**
 * @template T extends string  // ❌ Drift: constraint is object
 */
function process<T extends object>(value: T) {}
```

**Output**:

```
generic-constraint-mismatch: @template T extends string but signature has T extends object
```

## Metadata Drift

### deprecated-mismatch

`@deprecated` tag without corresponding code deprecation.

**Trigger**: JSDoc has `@deprecated` but export isn't actually deprecated.

**Example**:

```typescript
/**
 * @deprecated Use newFunction instead  // ⚠️ Check if intentional
 */
export function oldFunction() {}  // No /** @deprecated */ in export
```

### visibility-mismatch

Visibility tag doesn't match actual TypeScript visibility.

**Trigger**: `@internal` or `@private` on a public export.

**Example**:

```typescript
/**
 * @internal  // ❌ Drift: this is a public export
 */
export function publicHelper() {}
```

**Output**:

```
visibility-mismatch: @internal tag on public export
```

## Semantic Drift

### example-drift

`@example` code references exports that no longer exist.

**Trigger**: Example uses `oldFunction()` but it was removed/renamed.

**Example**:

```typescript
/**
 * @example
 * const result = oldFunction();  // ❌ Drift: oldFunction no longer exists
 */
export function newFunction() {}
```

**Output**:

```
example-drift: @example references "oldFunction" which is not exported
```

### example-runtime-error

`@example` code throws when executed.

**Trigger**: Example has syntax errors or runtime exceptions.

**Detection**: Requires `--run-examples` flag.

**Example**:

```typescript
/**
 * @example
 * const x = JSON.parse("invalid);  // ❌ Syntax error
 */
export function parse() {}
```

**Output**:

```
example-runtime-error: @example failed with: SyntaxError: Unexpected end of JSON input
```

### broken-link

`{@link Target}` references a non-existent export.

**Trigger**: `{@link Foo}` but `Foo` isn't exported.

**Example**:

```typescript
/**
 * Related to {@link OldHelper}  // ❌ Drift: OldHelper not exported
 */
export function newHelper() {}
```

**Output**:

```
broken-link: {@link OldHelper} target not found in exports
```

## Drift Detection in CLI

Check for drift:

```bash
doccov check
```

Fail on any drift:

```bash
doccov check  # Fails by default if drift detected
```

Ignore drift:

```bash
doccov check --ignore-drift
```

Run examples to detect runtime errors:

```bash
doccov check --run-examples
```

## Drift in Spec Output

Drift appears in each export's `docs.drift` array:

```json
{
  "name": "getUser",
  "docs": {
    "coverageScore": 75,
    "drift": [
      {
        "type": "param-mismatch",
        "target": "userId",
        "issue": "@param userId not in signature",
        "suggestion": "id"
      }
    ]
  }
}
```

## See Also

- [Concepts](../getting-started/concepts.md) - Coverage and drift overview
- [check Command](../cli/commands/check.md) - CLI drift checking
- [Types Reference](./types.md) - `SpecDocDrift` type

