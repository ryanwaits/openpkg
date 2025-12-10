# Concepts

Core concepts behind DocCov's coverage and drift detection.

## Coverage Scoring

DocCov measures documentation completeness using four signals:

| Signal | Description | Example |
|--------|-------------|---------|
| `description` | Has a description comment | `/** Creates a user */` |
| `params` | All parameters documented | `@param name The user's name` |
| `returns` | Return value documented | `@returns The created user` |
| `examples` | Has usage examples | `@example createUser('Alice')` |

### Coverage Calculation

Each export gets a coverage score (0-100%):
- 25% for description
- 25% for params (or N/A if no params)
- 25% for returns (or N/A if void/no return)
- 25% for examples

Package-wide coverage is the average of all export scores.

### Example

```typescript
/**
 * Creates a new user in the database.
 * 
 * @param name - The user's display name
 * @param email - The user's email address
 * @returns The newly created user object
 * 
 * @example
 * const user = await createUser('Alice', 'alice@example.com');
 */
export async function createUser(name: string, email: string): Promise<User> {
  // ...
}
```

This function has 100% coverage: description, params, returns, and example.

## Drift Detection

Drift occurs when documentation doesn't match actual code. DocCov detects 10 types:

### Parameter Drift

| Type | Issue |
|------|-------|
| `param-mismatch` | `@param foo` but signature has `bar` |
| `param-type-mismatch` | `@param {string} id` but actual type is `number` |
| `optionality-mismatch` | `[param]` (optional) but param is required |

### Return/Type Drift

| Type | Issue |
|------|-------|
| `return-type-mismatch` | `@returns {User}` but actual return is `Promise<User>` |
| `generic-constraint-mismatch` | `@template T` constraint doesn't match code |

### Semantic Drift

| Type | Issue |
|------|-------|
| `deprecated-mismatch` | `@deprecated` tag without matching code |
| `visibility-mismatch` | `@internal` on a public export |
| `example-drift` | `@example` references non-existent export |
| `example-runtime-error` | `@example` throws at runtime |
| `broken-link` | `{@link Foo}` but `Foo` isn't exported |

### Fuzzy Matching

When a param is misnamed, DocCov suggests corrections:

```
⚠ param-mismatch: @param userId not in signature
  Suggestion: Did you mean "id"?
```

## OpenPkg vs DocCov

DocCov separates two concerns:

| Concept | Description |
|---------|-------------|
| **OpenPkg** | Pure structural API specification - exports, types, signatures |
| **DocCov** | Quality analysis layer - coverage scores, drift detection, linting |

### OpenPkg (Pure Structural)

The `openpkg.json` file follows the OpenPkg 0.3.0 schema - a pure structural format:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json",
  "openpkg": "0.3.0",
  "meta": {
    "name": "my-package",
    "version": "1.0.0",
    "ecosystem": "js/ts"
  },
  "exports": [...],
  "types": [...]
}
```

No coverage data here - OpenPkg is intentionally pure.

### Enriched OpenPkg (With Coverage)

Coverage data is computed on-demand using `enrichSpec()` from the SDK:

```typescript
import { DocCov, enrichSpec } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

// Pure spec - no coverage
const enriched = enrichSpec(spec);

// Now has coverage data
console.log(enriched.docs?.coverageScore); // 85
console.log(enriched.exports[0].docs?.missing); // ['examples']
```

### Structure

| Field | Description |
|-------|-------------|
| `meta` | Package name, version, ecosystem |
| `exports` | All exported functions, classes, variables |
| `types` | Type definitions referenced by exports |

### Export Entry (Pure)

Each export in the pure OpenPkg:

```json
{
  "id": "createUser",
  "name": "createUser",
  "kind": "function",
  "signatures": [...],
  "description": "Creates a new user",
  "examples": ["createUser('Alice')"]
}
```

### Export Entry (Enriched)

After calling `enrichSpec()`:

```json
{
  "id": "createUser",
  "name": "createUser",
  "kind": "function",
  "signatures": [...],
  "description": "Creates a new user",
  "examples": ["createUser('Alice')"],
  "docs": {
    "coverageScore": 100,
    "missing": [],
    "drift": []
  }
}
```

## Type References

Like OpenAPI, types use `$ref` for reusability:

```json
{
  "parameters": [{
    "name": "user",
    "schema": { "$ref": "#/types/User" }
  }]
}
```

Primitives are inline:

```json
{ "type": "string" }
{ "type": "number" }
```

## See Also

- [Drift Types Reference](../spec/drift-types.md) - Detailed drift examples
- [Types Reference](../spec/types.md) - Full type definitions
- [OpenPkg Schema](../reference/openpkg-schema.md) - JSON Schema spec

