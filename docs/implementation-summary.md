# OpenPkg Implementation Summary

## Overview

OpenPkg combines the TypeScript Compiler API with TSDoc parsing to generate comprehensive package specifications. This document summarizes how these components work together to extract both type information and documentation from TypeScript packages.

## Core Architecture

### 1. **Type Extraction Pipeline** (`src/extractor.ts`)

The main extraction flow follows a three-pass approach:

1. **First Pass**: Collect all exported type names to build a reference map
2. **Second Pass**: Process exports with type references available
3. **Third Pass**: Add referenced types that weren't directly exported

```typescript
// First pass - build type reference map
for (const symbol of exports) {
  if (isTypeDeclaration(declaration)) {
    typeRefs.set(name, name);
  }
}

// Second pass - process with references
for (const symbol of exports) {
  // Extract functions, classes, interfaces, etc.
  // Use typeRefs for consistent $ref formatting
}

// Third pass - collect referenced but not exported types
for (const typeName of referencedTypes) {
  // Find and add types used in parameters/returns
}
```

### 2. **TSDoc Integration** (`src/utils/tsdoc-utils.ts`)

TSDoc parsing enriches the type information with documentation:

- **Function Documentation**: Extracts descriptions, parameter docs, and return type docs
- **Parameter Names**: Resolves TypeScript's `__0` naming for destructured parameters
- **Nested Properties**: Handles `@param opts.property` syntax for destructured parameters

```typescript
/**
 * @param opts - The options object
 * @param opts.transaction - The transaction to broadcast
 * @param opts.attachment - Optional attachment
 */
function broadcastTransaction(opts: {...}) { }
```

### 3. **Parameter Structuring** (`src/utils/parameter-utils.ts`)

Handles complex TypeScript patterns:

#### Intersection Types (A & B)
- Flattens properties from all intersected types into a single object
- Example: `{ transaction: Tx } & NetworkParam & ClientParam` becomes one object with all properties

#### Union Types (A | B)
- Uses OpenAPI's `oneOf` pattern for object unions
- Uses `anyOf` for mixed type unions
- Example: `SingleSigOptions | MultiSigOptions` becomes `{ oneOf: [...] }`

#### Type References
- Consistent `$ref` formatting for all named types
- Preserves external package references (even if unresolved)
- Example: `StacksTransaction` becomes `{ "$ref": "#/types/StacksTransaction" }`

## Key Design Decisions

### 1. **Source File Preference**
- Always prefers `.ts` files over `.d.ts` files
- Reason: Source files contain TSDoc comments that are stripped in declaration files

### 2. **External Type References**
- Creates `$ref` for types from other packages even if they won't resolve
- Rationale: Maintains accuracy and enables future cross-package resolution
- Example: `StacksNetwork` from `@stacks/network` still gets a `$ref`

### 3. **Monorepo Support**
- Auto-detects entry points from package.json
- Supports `--package` flag for workspace packages
- Searches in priority order: types → typings → exports → main

### 4. **Type Formatting Standards**
- Primitives: Return as strings (`"string"`, `"number"`)
- Literals: Strip quotes (`"mainnet"` not `"\"mainnet\""`)
- Named Types: Always use `$ref` format
- Unions: Use `anyOf` array structure

## Data Flow Example

Here's how `broadcastTransaction` is processed:

### 1. TypeScript Compiler Sees:
```typescript
function broadcastTransaction({
  transaction,
  attachment,
  network,
  client
}: {
  transaction: StacksTransactionWire;
  attachment?: Uint8Array | string;
} & NetworkClientParam): Promise<TxBroadcastResult>
```

### 2. Parameter Detection:
- Identifies destructured parameter (named `__0` by compiler)
- Recognizes intersection type with object literal
- Collects type references: `StacksTransactionWire`, `NetworkClientParam`, `TxBroadcastResult`

### 3. TSDoc Parser Extracts:
```typescript
/**
 * @param opts.transaction - The transaction to broadcast
 * @param opts.attachment - Optional attachment encoded as a hex string
 */
```

### 4. Parameter Structuring:
- Renames `__0` to `opts` (from TSDoc)
- Flattens `NetworkClientParam` properties
- Applies descriptions from TSDoc
- Formats type references with `$ref`

### 5. Final Output:
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
      "description": "Optional attachment encoded as a hex string",
      "optional": true
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

## Component Responsibilities

### TypeScript Compiler API
- Type extraction and relationships
- Symbol resolution
- Export discovery
- Type checking

### TSDoc Parser
- Documentation extraction
- Parameter name resolution
- Description mapping
- Example extraction

### Custom Logic
- Intersection type flattening
- Union type structuring with oneOf/anyOf
- Consistent $ref formatting
- Literal type cleaning

## Testing Considerations

When testing the implementation:

1. **Parameter Styles**: Test simple, destructured, union, and intersection parameters
2. **TSDoc Extraction**: Verify descriptions appear in output
3. **Type References**: Ensure all named types use `$ref` format
4. **Complex Types**: Check union/intersection handling
5. **External Types**: Verify cross-package references are preserved

## Benefits of This Approach

1. **Rich Documentation**: Combines type safety with human-readable docs
2. **Flexibility**: Handles complex TypeScript patterns
3. **Standards Compliance**: Follows OpenAPI conventions
4. **Extensibility**: Clean separation of concerns enables future enhancements
5. **Accuracy**: Preserves exact type relationships from source code

## Future Enhancements

1. **Cross-Package Resolution**: Plugin system to resolve external type references
2. **Generic Type Support**: Better handling of `Array<T>`, `Promise<T>`
3. **Conditional Types**: Support for TypeScript's conditional type expressions
4. **Type Alias Chains**: Deeper resolution of type alias references
5. **Watch Mode**: Real-time spec generation during development