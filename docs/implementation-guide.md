# OpenPkg Implementation Guide

This guide explains how OpenPkg extracts and structures TypeScript type information, combining the TypeScript Compiler API with TSDoc parsing to generate comprehensive package specifications.

## Overview

OpenPkg uses a two-pronged approach:
1. **TypeScript Compiler API**: Extracts type information, signatures, and code structure
2. **TSDoc Parser**: Extracts documentation, parameter descriptions, and examples

## Core Components

### 1. Type Extraction (`src/extractor.ts`)

The main extraction flow:
```typescript
// 1. Load TypeScript source files (preferring .ts over .d.ts for TSDoc)
// 2. Create TypeScript program with project's tsconfig
// 3. Extract exports and their types
// 4. Collect referenced types (even from other packages)
// 5. Structure everything into OpenPkg spec format
```

**Responsibilities:**
- Finding entry points from package.json
- Creating TypeScript compiler program
- Walking through exports
- Collecting type definitions

### 2. Parameter Structuring (`src/utils/parameter-utils.ts`)

Handles complex parameter types with special cases:

#### Intersection Types (A & B)
When a parameter uses intersection types, we **flatten** the properties:

```typescript
// Input: { transaction: Tx } & NetworkParam & ClientParam
// Output:
{
  "type": "object",
  "properties": [
    { "name": "transaction", "type": {...} },
    { "name": "network", "type": "..." },    // Flattened from NetworkParam
    { "name": "client", "type": "..." }      // Flattened from ClientParam
  ]
}
```

#### Union Types (A | B)
When a parameter can be one of several shapes, we use **oneOf**:

```typescript
// Input: SingleSigOptions | MultiSigOptions
// Output:
{
  "type": "object",
  "oneOf": [
    { "properties": [...] },  // SingleSigOptions shape
    { "properties": [...] }   // MultiSigOptions shape
  ]
}
```

#### Type References
All named types use `$ref` format:

```typescript
// Input: StacksTransaction
// Output: { "$ref": "#/types/StacksTransaction" }

// Input: string | ClientOpts | undefined
// Output: {
//   "anyOf": [
//     "string",
//     { "$ref": "#/types/ClientOpts" },
//     "undefined"
//   ]
// }
```

### 3. TSDoc Integration (`src/utils/tsdoc-utils.ts`)

Parses JSDoc/TSDoc comments to enrich type information:

```typescript
/**
 * @param opts - The options object
 * @param opts.transaction - The transaction to broadcast
 * @param opts.attachment - Optional attachment
 */
function broadcastTransaction(opts: {...}) { }
```

**Extracts:**
- Parameter descriptions
- Destructured property documentation
- Return type descriptions
- Examples

**Key Features:**
- Handles `@param paramName.propertyName` for destructured parameters
- Works around TypeScript's `__0` naming for destructured params
- Preserves rich documentation from source files

### 4. Type Reference Formatting (`formatTypeReference`)

Consistently formats all type references following OpenAPI standards:

```typescript
// Primitives: Return as-is
"string", "number", "boolean"

// Literals: Remove quotes
"mainnet" (not "\"mainnet\"")

// Named types: Always use $ref
{ "$ref": "#/types/TypeName" }

// Unions: Use anyOf
{ "anyOf": ["string", { "$ref": "#/types/MyType" }] }

// Arrays/Complex: Return type string
"string[]", "Promise<Result>"
```

## How It All Works Together

### Example: Processing `broadcastTransaction`

1. **TypeScript Compiler API** sees:
   ```typescript
   function broadcastTransaction({
     transaction: txOpt,
     attachment: attachOpt,
     network: _network,
     client: _client,
   }: {
     transaction: StacksTransactionWire;
     attachment?: Uint8Array | string;
   } & NetworkClientParam): Promise<TxBroadcastResult>
   ```

2. **Parameter Detection**:
   - Recognizes destructured parameter (shows as `__0` in compiler)
   - Identifies intersection type with object literal

3. **TSDoc Parser** finds:
   ```typescript
   /**
    * @param opts.transaction - The transaction to broadcast
    * @param opts.attachment - Optional attachment encoded as a hex string
    */
   ```

4. **Parameter Structuring**:
   - Renames `__0` to `opts` (from TSDoc)
   - Flattens `NetworkClientParam` properties into main object
   - Adds descriptions from TSDoc

5. **Final Output**:
   ```json
   {
     "name": "opts",
     "type": "object",
     "properties": [
       {
         "name": "transaction",
         "type": { "$ref": "#/types/StacksTransactionWire" },
         "description": "The transaction to broadcast"
       },
       {
         "name": "attachment",
         "type": { "anyOf": ["undefined", "string", "Uint8Array"] },
         "description": "Optional attachment encoded as a hex string"
       },
       {
         "name": "network",
         "type": { "anyOf": ["undefined", "mainnet", "testnet", ...] }
       },
       {
         "name": "client",
         "type": { "anyOf": ["undefined", { "$ref": "#/types/ClientOpts" }] }
       }
     ]
   }
   ```

## Key Decision Points

### When TypeScript Compiler API is Used
- Extracting actual types and signatures
- Determining type relationships (unions, intersections)
- Finding exported symbols
- Resolving type references

### When TSDoc Parser is Used
- Getting parameter descriptions
- Finding actual parameter names (vs `__0`)
- Extracting examples and detailed documentation
- Understanding destructured parameter properties

### When Custom Logic Applies
- Flattening intersection types for cleaner output
- Structuring union types with `oneOf`
- Converting TypeScript's quoted literals to clean strings
- Deciding between `$ref` and inline type strings

## Adding TSDoc Comments

When documenting the OpenPkg codebase itself:

```typescript
/**
 * Formats a TypeScript type into OpenPkg's standardized format.
 * 
 * @param type - The TypeScript type to format
 * @param typeChecker - TypeScript's type checker instance
 * @param typeRefs - Map of known type names to their IDs
 * @param referencedTypes - Set to collect newly discovered type references
 * 
 * @returns Either a string for primitives/literals, or an object with $ref/anyOf
 * 
 * @example
 * // Named type
 * formatTypeReference(stacksTransactionType, checker, refs)
 * // Returns: { "$ref": "#/types/StacksTransaction" }
 * 
 * @example  
 * // Union type
 * formatTypeReference(stringOrNumberType, checker, refs)
 * // Returns: { "anyOf": ["string", "number"] }
 */
export function formatTypeReference(...) { }
```

## Common Patterns

### Pattern 1: Type exists in current package
```typescript
// ✅ Create $ref
{ "$ref": "#/types/LocalType" }
```

### Pattern 2: Type from another package
```typescript
// ⚠️ Create $ref (will not resolve in single package spec)
{ "$ref": "#/types/ExternalType" }
// Note: This is intentional - see design-decisions.md
```

### Pattern 3: Complex union with references
```typescript
// Input: string | MyType | undefined
// Output: { "anyOf": ["string", { "$ref": "#/types/MyType" }, "undefined"] }
```

### Pattern 4: Intersection with object literal
```typescript
// Input: { prop: string } & BaseType
// Flatten into single object with all properties
```

## Testing Your Changes

When modifying type extraction:

1. **Test with various parameter styles**:
   - Simple parameters: `(name: string)`
   - Destructured: `({ a, b }: Options)`
   - Unions: `(opts: A | B)`
   - Intersections: `(opts: A & B)`

2. **Verify TSDoc extraction**:
   - Add JSDoc comments to test functions
   - Ensure descriptions appear in output
   - Check destructured property documentation

3. **Check type references**:
   - All named types should use `$ref`
   - Primitives should be strings
   - Complex types should be properly structured

## Future Improvements

1. **Cross-package type resolution**: Plugin to fetch and merge dependent package specs
2. **Generic type handling**: Better support for `Array<T>`, `Promise<T>`, etc.
3. **Conditional types**: Support for TypeScript's conditional type expressions
4. **Type aliases**: Deeper resolution of type alias chains