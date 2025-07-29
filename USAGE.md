# OpenPkg Usage Guide

## Quick Start

1. Install dependencies:
```bash
bun install
```

2. Generate OpenPkg spec for your TypeScript package:
```bash
bun run src/cli.ts index.ts
```

## CLI Options

```bash
bun run src/cli.ts [entry] [options]
```

- `[entry]` - Entry file to analyze (default: `index.ts`)
- `-o, --output <file>` - Output file (default: `openpkg.json`)

## Examples

### Basic Usage
```bash
# Analyze index.ts and output to openpkg.json
bun run src/cli.ts

# Analyze src/main.ts
bun run src/cli.ts src/main.ts

# Custom output file
bun run src/cli.ts -o api-spec.json src/index.ts
```

### Generate Examples
We include several example TypeScript packages:

```bash
# Generate specs for all examples
bun run generate:examples

# Or generate individually
cd examples/simple-math
bun ../../src/cli.ts index.ts -o openpkg.json
```

## Understanding the Output

The generated `openpkg.json` contains:

1. **meta** - Package metadata (name, version, description)
2. **exports** - All exported functions, classes, variables, types
3. **types** - Detailed type definitions referenced by exports

### Type Reference System

OpenPkg follows OpenAPI's approach to type references:

#### Primitive Types
Always inline - no `$ref` needed:
```json
{ "type": "string" }
{ "type": "number" }
{ "type": "boolean" }
```

#### Named Types
Types defined in your package use `$ref`:
```json
{
  "parameters": [{
    "name": "user",
    "type": { "$ref": "#/types/User" }
  }]
}
```

#### Complex Types
Complex type expressions remain as strings:
```json
{ "type": "Record<string, any>" }
{ "type": "Partial<User>" }
{ "type": "User[]" }
{ "type": "\"success\" | \"error\"" }
```

### Source Locations

Every export includes source location for easy navigation:

```json
"source": {
  "file": "src/user.ts",
  "line": 42
}
```

## Working with the Specification

The OpenPkg specification is designed to be consumed by tools:

```typescript
import { openPkgSchema } from './src/types/openpkg';
import spec from './openpkg.json';

// Validate the spec
const validated = openPkgSchema.parse(spec);

// Access exports
validated.exports.forEach(exp => {
  console.log(`${exp.kind}: ${exp.name}`);
});

// Access types
validated.types?.forEach(type => {
  console.log(`Type ${type.name}: ${type.kind}`);
});

// Resolve a $ref
function resolveRef(ref: { $ref: string }, spec: any) {
  const [, , typeName] = ref.$ref.split('/');
  return spec.types.find((t: any) => t.id === typeName);
}
```

## Real-World Example

Here's what OpenPkg generates for a React hook:

```typescript
// Input: useLocalStorage.ts
export interface UseLocalStorageOptions {
  serializer?: (value: any) => string;
  deserializer?: (value: string) => any;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions
): [T, (value: T) => void] {
  // implementation...
}
```

```json
// Output: openpkg.json
{
  "exports": [{
    "id": "useLocalStorage",
    "name": "useLocalStorage",
    "kind": "function",
    "signatures": [{
      "parameters": [
        { "name": "key", "type": "string" },
        { "name": "initialValue", "type": "T" },
        { 
          "name": "options", 
          "type": { "$ref": "#/types/UseLocalStorageOptions" },
          "optional": true
        }
      ],
      "returnType": "[T, (value: T) => void]"
    }]
  }],
  "types": [{
    "id": "UseLocalStorageOptions",
    "name": "UseLocalStorageOptions", 
    "kind": "interface",
    "properties": [
      {
        "name": "serializer",
        "type": "(value: any) => string",
        "optional": true
      },
      {
        "name": "deserializer", 
        "type": "(value: string) => any",
        "optional": true
      }
    ]
  }]
}
```

## Limitations

- Only analyzes TypeScript source files (not compiled JavaScript)
- Requires TypeScript compiler to be available
- Complex generic types are represented as strings
- Does not follow external module imports
- Currently analyzes single entry points

## Building Tools on OpenPkg

The simplicity of OpenPkg makes it easy to build tools:

### Documentation Generator
```typescript
function generateDocs(spec: OpenPkg) {
  const markdown = spec.exports.map(exp => {
    if (exp.kind === 'function') {
      return `### ${exp.name}\n${exp.description}\n`;
    }
    // ... handle other types
  }).join('\n');
}
```

### Type Resolver
```typescript
function resolveType(type: any, spec: OpenPkg): string {
  if (typeof type === 'object' && type.$ref) {
    const resolved = resolveRef(type, spec);
    return resolved ? resolved.name : 'unknown';
  }
  return type;
}
```

## Next Steps

- Build documentation generators that consume OpenPkg specs
- Create IDE plugins that use the specification
- Generate API clients from the spec
- Feed specs to AI for code understanding