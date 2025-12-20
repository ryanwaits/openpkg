# Standard JSON Schema Integration Analysis

> **Date:** December 2024
> **Status:** Research & Planning
> **Authors:** DocCov Team

## Executive Summary

This document analyzes the newly released [Standard JSON Schema specification](https://standardschema.dev/json-schema) and its relationship to DocCov's `@openpkg-ts/spec` package. The key finding is that **Standard JSON Schema and OpenPkg are complementary tools serving different purposes**, and Standard JSON Schema can significantly reduce custom schema library handling code when combined with DocCov's existing sandbox runtime capabilities.

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Key Questions & Answers](#key-questions--answers)
3. [Technical Analysis](#technical-analysis)
4. [Architecture Implications](#architecture-implications)
5. [Implementation Recommendations](#implementation-recommendations)
6. [Decision Record](#decision-record)

---

## Background & Context

### What is Standard JSON Schema?

Standard JSON Schema is a TypeScript interface specification that standardizes how validation/schema libraries expose JSON Schema conversion. It's part of the broader Standard Schema family.

**Core Interface:**

```typescript
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
    readonly jsonSchema: {
      readonly input: (options: Options) => Record<string, unknown>;
      readonly output: (options: Options) => Record<string, unknown>;
    };
  };
}

export interface Options {
  readonly target: 'draft-07' | 'draft-2020-12' | 'openapi-3.0' | ({} & string);
  readonly libraryOptions?: Record<string, unknown> | undefined;
}
```

**Supported Libraries (as of December 2024):**

| Library | Support Status |
|---------|---------------|
| Zod v4.2+ | Built-in |
| ArkType v2.1.28+ | Built-in |
| Valibot v1.2+ | Via `@valibot/to-json-schema` adapter |
| TypeBox | Not yet adopted |

**Planned Adopters:** AI SDK, TanStack, MCP SDK

### What is OpenPkg (`@openpkg-ts/spec`)?

OpenPkg is DocCov's **output specification format** - analogous to OpenAPI but for TypeScript packages. It defines how to represent:

- Package exports (functions, classes, variables, interfaces, types, enums)
- Type schemas (`SpecSchema` DSL)
- Documentation coverage metrics
- Documentation drift detection
- JSDoc/TSDoc metadata
- Source locations and examples

**Key Distinction:**

| Aspect | OpenPkg | Standard JSON Schema |
|--------|---------|---------------------|
| **What it is** | Output specification format | Interface contract |
| **Purpose** | Document TypeScript package APIs | Unify schema library JSON Schema conversion |
| **Analogy** | Like OpenAPI for packages | Like USB standard for schema libraries |
| **Produces** | `openpkg.json` documentation | JSON Schema (various drafts) |

---

## Key Questions & Answers

### Q1: Is Standard JSON Schema competing with or complementary to OpenPkg?

**Answer: Complementary - they operate at different layers.**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THE TYPESCRIPT ECOSYSTEM                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                         ┌─────────────┐                             │
│                         │   DocCov    │                             │
│                         │  (Analyzer) │                             │
│                         └──────┬──────┘                             │
│                                │                                     │
│                    Statically analyzes ALL of it                    │
│                                │                                     │
│         ┌──────────────────────┼──────────────────────┐             │
│         │                      │                      │             │
│         ▼                      ▼                      ▼             │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       │
│  │   Schema    │       │  Frameworks │       │  End-User   │       │
│  │  Libraries  │       │ (Consumers) │       │   Apps      │       │
│  │             │       │             │       │             │       │
│  │ Zod         │──────▶│ AI SDK      │──────▶│ my-app      │       │
│  │ TypeBox     │──────▶│ TanStack    │       │ your-api    │       │
│  │ Valibot     │──────▶│ MCP SDK     │       │ etc.        │       │
│  │ ArkType     │──────▶│ Hono        │       │             │       │
│  └─────────────┘       └─────────────┘       └─────────────┘       │
│        │                      │                      │              │
│        │    StandardJSONSchemaV1 flows this way ───▶│              │
│        │         (runtime interface)                 │              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

- **OpenPkg answers:** "What does this package export and how well is it documented?"
- **Standard JSON Schema answers:** "How do I get JSON Schema from this Zod/TypeBox/Valibot object?"

### Q2: Should we replace OpenPkg with Standard JSON Schema?

**Answer: No.** They solve different problems:

- OpenPkg is the specification format for DocCov's output
- Standard JSON Schema is a tool that can improve DocCov's **input processing**

### Q3: Who implements Standard JSON Schema?

**Answer: Schema libraries implement it; consumers accept it.**

**Two Types of Adoption:**

| Role | What "Adopting" Means | Examples |
|------|----------------------|----------|
| **Schema Library** (Producer) | Implement `~standard` property on schema objects | Zod, TypeBox, Valibot, ArkType |
| **Consumer Framework** | Accept `StandardJSONSchemaV1` as input, use `~standard.jsonSchema` methods | AI SDK, TanStack, MCP SDK, **DocCov** |

**Key Insight:** The consuming library/package CANNOT add Standard JSON Schema support - the schema library itself must implement the `~standard` property.

### Q4: How does this help DocCov specifically?

**Answer: It depends on the analysis mode.**

**Static Analysis (AST-only):**
- Standard JSON Schema provides **minimal direct value**
- Cannot call runtime methods from static analysis
- Still need custom handlers for TypeBox, Zod, etc.

**Runtime Analysis (Sandbox):**
- Standard JSON Schema provides **significant value**
- Can import modules and call `~standard.jsonSchema.output()`
- Eliminates need for custom schema library adapters

---

## Technical Analysis

### The Static vs Runtime Analysis Problem

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   What Standard JSON Schema provides:                                │
│   ═══════════════════════════════════                                │
│                                                                      │
│   RUNTIME METHOD:                                                    │
│   schema['~standard'].jsonSchema.output({ target: 'draft-2020-12' })│
│                                                                      │
│   • Must CALL this function                                         │
│   • Executes at runtime                                              │
│   • Returns JSON Schema                                              │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   What DocCov static analysis does:                                  │
│   ═════════════════════════════════                                  │
│                                                                      │
│   AST TRAVERSAL:                                                     │
│   TypeScript Compiler API → Read type structures → Build SpecSchema │
│                                                                      │
│   • No code execution                                                │
│   • Reads type information from AST                                  │
│   • TObject<{ name: TString }> → { type: 'object', ... }           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### TypeScript Type Erasure

TypeScript erases type information at compile time. This fundamentally limits what runtime analysis can extract:

```typescript
// Source code                         // After compilation

function greet(                        function greet(
  name: string,           ──▶            name,
  age: number                            age
): string { }                          ) { }

interface User {          ──▶          // GONE ENTIRELY
  id: number;
}

type Status = 'ok'        ──▶          // GONE ENTIRELY
  | 'error';
```

**What Runtime CAN Extract:**
- Schema objects (Zod, TypeBox, etc.) - these encode types as runtime data
- Any value implementing `StandardJSONSchemaV1`

**What Runtime CANNOT Extract:**
- Function signatures (parameter types, return types)
- Class definitions (method types, property types)
- Interface definitions
- Type aliases
- TSDoc/JSDoc comments

### Current DocCov TypeBox Handling

DocCov currently has ~400 lines of custom TypeBox handling in `packages/sdk/src/utils/parameter-utils.ts`:

```typescript
const TYPEBOX_PRIMITIVE_MAP: Record<string, Record<string, unknown>> = {
  TString: { type: 'string' },
  TNumber: { type: 'number' },
  TBoolean: { type: 'boolean' },
  // ... 10+ more primitives
};

function formatTypeBoxSchema(type: TS.Type, ...): Record<string, unknown> | null {
  switch (symbolName) {
    case 'TObject': { /* 50 lines */ }
    case 'TArray': { /* 30 lines */ }
    case 'TUnion': { /* 80 lines */ }
    case 'TIntersect': { /* 50 lines */ }
    case 'TOptional': { /* 40 lines */ }
    case 'TLiteral': { /* 20 lines */ }
    case 'TRecord': { /* 30 lines */ }
    case 'TRef': { /* 15 lines */ }
    // ... etc
  }
}
```

This same pattern would need to be replicated for Zod, Valibot, ArkType, and any future schema library.

---

## Architecture Implications

### DocCov's Unique Position

DocCov is a **consumer of TypeScript code** - it analyzes source code regardless of what libraries that code uses:

```
┌─────────────────────────────────────────────────────────────────────┐
│   When you run: doccov generate --entry ./src/index.ts              │
│                                                                      │
│   DocCov might be analyzing:                                         │
│                                                                      │
│   1. A SCHEMA LIBRARY itself (e.g., running on Zod's source)        │
│      └─▶ Documents: z.string(), z.object(), ZodType, etc.           │
│                                                                      │
│   2. A FRAMEWORK that uses schemas (e.g., AI SDK's source)          │
│      └─▶ Documents: generateObject(), tool(), etc.                  │
│                                                                      │
│   3. An END-USER APP using both                                     │
│      └─▶ Documents: their API routes, functions, schemas            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### The Hybrid Analysis Model

With DocCov's existing Vercel Sandbox capability, a hybrid approach becomes possible:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                    DocCov Hybrid Analysis Pipeline                   │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              STATIC ANALYSIS (always required)               │   │
│   │                                                              │   │
│   │  • Function signatures (params, return types)               │   │
│   │  • Class definitions (methods, properties)                  │   │
│   │  • Interface definitions                                     │   │
│   │  • Type aliases                                              │   │
│   │  • TSDoc/JSDoc comments                                      │   │
│   │  • @example extraction                                       │   │
│   │  • Source file locations                                     │   │
│   │  • Import/export relationships                               │   │
│   │                                                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              +                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              RUNTIME ANALYSIS (sandbox enhancement)          │   │
│   │                                                              │   │
│   │  • Schema objects via Standard JSON Schema                  │   │
│   │  • Running @examples in sandbox                              │   │
│   │  • Validation testing                                        │   │
│   │                                                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              =                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      OpenPkg Output                          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Export Type Analysis Matrix

| Export Type | Analysis Method | Standard JSON Schema Helps? |
|-------------|-----------------|----------------------------|
| `const UserSchema = z.object({...})` | Runtime | Yes - call `~standard.jsonSchema.output()` |
| `function createUser(name: string): User` | Static | No - types erased at runtime |
| `interface UserOptions { ... }` | Static | No - doesn't exist at runtime |
| `class UserService { getUser(): User }` | Static | No - method types erased |
| `type Status = 'pending' \| 'complete'` | Static | No - type alias erased |
| `/** @example ... */` | Static + Runtime | Partial - extract statically, run in sandbox |

---

## Implementation Recommendations

### Phase 1: Add Standard JSON Schema Detection

```typescript
// packages/sdk/src/extraction/standard-schema.ts

import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

/**
 * Runtime check for Standard JSON Schema compliance
 */
export function isStandardJSONSchema(value: unknown): value is StandardJSONSchemaV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~standard' in value &&
    typeof (value as any)['~standard']?.version === 'number' &&
    typeof (value as any)['~standard']?.jsonSchema?.output === 'function'
  );
}

/**
 * Extract JSON Schema via Standard JSON Schema runtime interface
 */
export function extractViaStandardSchema(
  schema: StandardJSONSchemaV1,
  options: { target?: 'draft-07' | 'draft-2020-12' | 'openapi-3.0' } = {}
): Record<string, unknown> {
  return schema['~standard'].jsonSchema.output({
    target: options.target ?? 'draft-2020-12'
  });
}

/**
 * Get vendor info from Standard JSON Schema
 */
export function getSchemaVendor(schema: StandardJSONSchemaV1): string {
  return schema['~standard'].vendor;
}
```

### Phase 2: Integrate with Sandbox Analysis

```typescript
// In sandbox analysis flow

async function extractSchemaFromExport(
  sandboxModule: Record<string, unknown>,
  exportName: string
): Promise<{ schema: SpecSchema; method: 'standard' | 'static'; vendor?: string }> {
  const exported = sandboxModule[exportName];

  // 1. Try Standard JSON Schema first (runtime)
  if (isStandardJSONSchema(exported)) {
    const vendor = getSchemaVendor(exported);

    return {
      schema: extractViaStandardSchema(exported),
      method: 'standard',
      vendor
    };
  }

  // 2. Fall back to static AST analysis
  return {
    schema: await staticAnalysisFallback(exportName),
    method: 'static'
  };
}
```

### Phase 3: Track Extraction Method in OpenPkg

Consider adding metadata to track how schemas were extracted:

```typescript
// In SpecGenerationInfo or SpecExport
analysis: {
  // ... existing fields
  schemaExtraction?: {
    method: 'standard-json-schema' | 'static-ast' | 'hybrid';
    vendor?: string; // 'zod', 'arktype', 'valibot', etc.
    standardSchemaVersion?: number;
  };
}
```

### What NOT To Do

- **Don't replace OpenPkg with Standard JSON Schema** - they serve different purposes
- **Don't immediately drop TypeBox-specific handling** - TypeBox hasn't adopted the standard yet
- **Don't make Standard JSON Schema a hard dependency** - it should be optional/opportunistic
- **Don't expect runtime analysis to replace static analysis** - most exports still need AST analysis

---

## Decision Record

### ADR-001: Standard JSON Schema Integration Strategy

**Status:** Proposed

**Context:**
- Standard JSON Schema v1 specification released December 2024
- DocCov currently has ~400 lines of custom TypeBox handling
- DocCov has sandbox runtime capability via Vercel
- Zod v4.2+, ArkType v2.1.28+, Valibot v1.2+ support the standard
- TypeBox has not yet adopted the standard

**Decision:**
Adopt Standard JSON Schema as a **supplementary extraction method** in sandbox-enabled analysis, while maintaining static AST analysis as the primary method.

**Consequences:**

*Positive:*
- Immediate support for Zod, ArkType, Valibot schemas with ~20 lines of code
- Future-proof for new schema libraries that adopt the standard
- Reduced maintenance burden for schema library adapters
- TypeBox AST code becomes fallback rather than primary path

*Negative:*
- Must maintain both runtime and static analysis paths
- TypeBox support still requires custom code until they adopt
- Additional complexity in analysis pipeline
- Dependency on `@standard-schema/spec` package

*Neutral:*
- Static analysis remains required for ~80% of typical exports
- OpenPkg specification unchanged
- No breaking changes to existing functionality

---

## Appendix: Library Support Status

### Current Status (December 2024)

| Schema Library | Standard JSON Schema | DocCov Current Support |
|---------------|---------------------|----------------------|
| **Zod v4.2+** | Built-in | Pattern detection only |
| **ArkType v2.1.28+** | Built-in | None |
| **Valibot v1.2+** | Via adapter | None |
| **TypeBox** | Not yet adopted | Custom ~400 LOC AST handling |

### Tracking Adoption

- TypeBox repo: https://github.com/sinclairzx81/typebox
- Standard Schema spec: https://github.com/standard-schema/standard-schema
- npm package: `@standard-schema/spec`

---

## References

- [Standard JSON Schema Specification](https://standardschema.dev/json-schema)
- [Standard Schema (parent spec)](https://standardschema.dev)
- [OpenPkg Specification](../spec/README.md)
- [DocCov SDK Architecture](./sdk-architecture.md)
