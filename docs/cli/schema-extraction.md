# Schema Extraction Guide

DocCov extracts type information from schema validation libraries (Zod, Valibot, TypeBox, ArkType). This guide explains the two extraction modes and how to use them.

## Two Extraction Modes

| Mode | Flag | Requires Built Code | Output Field | Constraints Preserved |
|------|------|---------------------|--------------|----------------------|
| **Static** | (default) | No | `type` | No |
| **Runtime** | `--runtime` | Yes (`dist/`) | `schema` | Yes |

### Static Mode (Default)

Uses TypeScript Compiler API to parse source files. Works on any `.ts` file without building.

**Pros:**
- No build step required
- Fast, safe (no code execution)
- Works with any TypeScript

**Cons:**
- Loses runtime constraints (formats, min/max, patterns)
- Output is TypeScript type representation, not JSON Schema

### Runtime Mode (`--runtime`)

Executes compiled JavaScript in a subprocess to extract actual JSON Schema from schema objects at runtime.

**Pros:**
- Full JSON Schema with all constraints preserved
- Formats (`email`, `uuid`, `url`)
- Numeric bounds (`minimum`, `maximum`)
- String constraints (`minLength`, `maxLength`, `pattern`)

**Cons:**
- Requires built code (`npm run build` first)
- Slightly slower (subprocess execution)

## How Runtime Extraction Works

```
src/index.ts                    dist/index.js
     │                               │
     │  npm run build / tsc          │
     └──────────────────────────────►│
                                     │
                                     ▼
                              ┌─────────────────┐
                              │  doccov --runtime │
                              │                   │
                              │  1. Find dist/    │
                              │  2. Import module │
                              │  3. Check exports │
                              │  4. Extract schema│
                              └─────────────────┘
                                     │
                                     ▼
                              ┌─────────────────┐
                              │  Detection:       │
                              │                   │
                              │  Standard Schema? │
                              │  → ~standard.     │
                              │    jsonSchema.    │
                              │    output()       │
                              │                   │
                              │  TypeBox?         │
                              │  → Schema IS      │
                              │    JSON Schema    │
                              └─────────────────┘
```

### Where Runtime Looks for Compiled JS

Given `src/index.ts`, doccov checks (in order):
1. `src/index.js` (same directory)
2. `dist/index.js`
3. `build/index.js`
4. `lib/index.js`

## CLI Output

### Static Mode

```bash
doccov spec src/index.ts -o spec.json --verbose
```

```
✓ Generated spec.json (1.1s)
  4 exports

Generation Info
  Entry point:      src/index.ts
  External types:   resolved
  Max type depth:   20
```

No "Schema extraction" line appears in static mode.

### Runtime Mode (Built Code Present)

```bash
npm run build
doccov spec src/index.ts -o spec.json --runtime --verbose
```

```
✓ Generated spec.json (1.2s)
  4 exports

Generation Info
  Entry point:      src/index.ts
  Schema extraction: hybrid
  Runtime schemas:   4 (typebox)
```

### Runtime Mode (No Built Code)

```bash
rm -rf dist
doccov spec src/index.ts -o spec.json --runtime --verbose
```

```
✓ Generated spec.json (1.5s)
  4 exports

Generation Info
  Entry point:      src/index.ts
```

**Current behavior:** Falls back silently to static extraction. No warning displayed.

## Output Comparison

### Static Output

```json
{
  "name": "ProductSchema",
  "type": { "type": "array" },
  "tags": [
    { "name": "schemaLibrary", "text": "typebox" },
    { "name": "schemaSource", "text": "static-ast" }
  ]
}
```

Constraints lost: `format`, `minLength`, `maxLength`, `minimum`, `$id`

### Runtime Output

```json
{
  "name": "ProductSchema",
  "schema": {
    "$id": "Product",
    "type": "object",
    "properties": {
      "id": { "format": "uuid", "type": "string" },
      "name": { "minLength": 1, "maxLength": 100, "type": "string" },
      "price": { "minimum": 0, "type": "number" },
      "inStock": { "type": "boolean" }
    },
    "required": ["id", "name", "price", "inStock"]
  },
  "tags": [
    { "name": "schemaLibrary", "text": "typebox" },
    { "name": "schemaSource", "text": "typebox-native" }
  ]
}
```

All constraints preserved.

## Tag Reference

### `schemaSource` Values

| Value | Meaning |
|-------|---------|
| `static-ast` | TypeScript Compiler API extraction (no runtime) |
| `standard-schema` | Runtime via `~standard.jsonSchema.output()` (Zod 4.2+, Valibot, ArkType) |
| `typebox-native` | Runtime TypeBox detection (schema IS JSON Schema) |

### `schemaLibrary` Values

| Value | Library |
|-------|---------|
| `zod` | Zod |
| `valibot` | Valibot |
| `typebox` | TypeBox (@sinclair/typebox) |
| `arktype` | ArkType |

## Library Support Matrix

| Library | Version | Static | Runtime | Runtime Method |
|---------|---------|--------|---------|----------------|
| Zod | 4.2+ | Yes | Yes | Standard Schema |
| Zod | <4.2 | Yes | No | - |
| Valibot | 1.0+ | Yes | Yes | Standard Schema |
| TypeBox | any | Yes | Yes | Native JSON Schema |
| ArkType | 2.0+ | Yes | Yes | Standard Schema |

## Examples

### TypeBox

```typescript
// src/index.ts
import { Type } from '@sinclair/typebox';

export const UserSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  age: Type.Integer({ minimum: 0, maximum: 150 })
});
```

```bash
# Static (works without build)
doccov spec src/index.ts -o static.json

# Runtime (requires build)
npm run build
doccov spec src/index.ts -o runtime.json --runtime
```

### Zod

```typescript
// src/index.ts
import { z } from 'zod';

export const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
});
```

```bash
npm run build
doccov spec src/index.ts -o spec.json --runtime --verbose
# → Runtime schemas: N (zod)
```

### Valibot

```typescript
// src/index.ts
import * as v from 'valibot';

export const UserSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  age: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(150))
});
```

```bash
npm run build
doccov spec src/index.ts -o spec.json --runtime --verbose
# → Runtime schemas: N (valibot)
```

## Recommendations

1. **For richest output:** Always use `--runtime` with built code
2. **For CI/CD:** Ensure `npm run build` runs before `doccov spec --runtime`
3. **For quick checks:** Static mode works without building
4. **Check verbose output:** Use `--verbose` to confirm runtime extraction is active

## Troubleshooting

### Runtime not extracting schemas

**Symptom:** Using `--runtime` but output shows `schemaSource: "static-ast"`

**Cause:** Compiled JavaScript not found

**Fix:**
```bash
npm run build  # or: tsc
doccov spec src/index.ts --runtime
```

### No schema tags appearing

**Symptom:** Export has no `schemaLibrary` or `schemaSource` tags

**Cause:** Not detected as a schema type (plain variable, function, etc.)

**Check:** Ensure export is a schema object from a supported library

### Old library version

**Symptom:** Zod detected but no runtime extraction

**Cause:** Zod <4.2 doesn't implement Standard Schema

**Fix:** Upgrade to Zod 4.2+ for runtime support
