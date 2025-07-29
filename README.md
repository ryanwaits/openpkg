# OpenPkg

OpenPkg is a simple standard for documenting TypeScript packages, similar to how OpenAPI documents REST APIs. It generates a JSON specification that describes the exports, types, and structure of your TypeScript library.

## What is OpenPkg?

OpenPkg is:
- 📦 A **standard format** for TypeScript package documentation
- 🔗 Uses **`$ref` references** like OpenAPI for type definitions
- 🚀 **Simple and lightweight** - just 2 files, ~250 lines total
- 🎯 **Focused** on creating a consumable specification, not complex type resolution

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/openpkg.git
cd openpkg
bun install

# Generate spec for a TypeScript file
bun run src/cli.ts path/to/index.ts

# Or use with npx/bunx (once published)
bunx openpkg src/index.ts -o openpkg.json
```

## Usage

Generate an OpenPkg specification for your TypeScript package:

```bash
# Generate from default entry point (index.ts)
bun run src/cli.ts

# Generate from specific file
bun run src/cli.ts src/main.ts

# Output to custom file
bun run src/cli.ts src/index.ts -o api-spec.json
```

## Example Output

Given a simple TypeScript module:

```typescript
// math.ts
export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

export const PI = 3.14159;
```

OpenPkg generates:

```json
{
  "openpkg": "1.0.0",
  "meta": {
    "name": "my-math-lib",
    "version": "1.0.0",
    "description": "Math utilities",
    "ecosystem": "js/ts"
  },
  "exports": [
    {
      "id": "Point",
      "name": "Point",
      "kind": "interface",
      "source": { "file": "math.ts", "line": 2 }
    },
    {
      "id": "distance",
      "name": "distance",
      "kind": "function",
      "signatures": [{
        "parameters": [
          { "name": "a", "type": { "$ref": "#/types/Point" } },
          { "name": "b", "type": { "$ref": "#/types/Point" } }
        ],
        "returnType": "number"
      }],
      "source": { "file": "math.ts", "line": 7 }
    },
    {
      "id": "PI",
      "name": "PI",
      "kind": "variable",
      "type": "number",
      "source": { "file": "math.ts", "line": 11 }
    }
  ],
  "types": [
    {
      "id": "Point",
      "name": "Point",
      "kind": "interface",
      "properties": [
        { "name": "x", "type": "number" },
        { "name": "y", "type": "number" }
      ],
      "source": { "file": "math.ts", "line": 2 }
    }
  ]
}
```

## Type Reference System

OpenPkg follows OpenAPI's approach to type references:

### Primitive Types
Primitive types are always inline:
```json
{ "type": "string" }
{ "type": "number" }
{ "type": "boolean" }
```

### Named Types
Types defined in your package use `$ref`:
```json
{ "type": { "$ref": "#/types/Point" } }
{ "type": { "$ref": "#/types/User" } }
```

### Complex Types
Complex type expressions remain as strings:
```json
{ "type": "Record<string, any>" }
{ "type": "T[]" }
{ "type": "\"success\" | \"error\"" }
{ "type": "Partial<User>" }
```

## Examples

We include several example TypeScript packages in the `examples/` directory:

```bash
# Generate specs for all examples
bun run generate:examples

# Check out the generated specs
cat examples/simple-math/openpkg.json
cat examples/react-hooks/openpkg.json
cat examples/api-client/openpkg.json
```

### Example Projects
- **simple-math**: Basic types, interfaces, functions, and enums
- **react-hooks**: Custom React hooks with complex type parameters
- **api-client**: REST API client with generic types and classes

## Schema Structure

The OpenPkg schema has three main sections:

### 1. Meta Information
Package metadata from `package.json`:
```json
"meta": {
  "name": "package-name",
  "version": "1.0.0",
  "description": "Package description",
  "license": "MIT",
  "repository": "https://github.com/...",
  "ecosystem": "js/ts"
}
```

### 2. Exports
All exported members from the entry point:
```json
"exports": [
  {
    "id": "functionName",
    "name": "functionName",
    "kind": "function",
    "signatures": [...],
    "description": "JSDoc description",
    "source": { "file": "index.ts", "line": 10 }
  }
]
```

### 3. Types
Detailed type definitions referenced by exports:
```json
"types": [
  {
    "id": "InterfaceName",
    "name": "InterfaceName",
    "kind": "interface",
    "properties": [...],
    "source": { "file": "types.ts", "line": 5 }
  }
]
```

## Philosophy

OpenPkg follows the same philosophy as OpenAPI:
- **Standard over Implementation**: Focus on creating a standard format, not solving every edge case
- **Simple References**: Use `$ref` for types instead of deep resolution
- **Tool Agnostic**: The specification can be consumed by any tool
- **Extensible**: Room for custom extensions via the `extensions` field

## Use Cases

- 📚 **Documentation Generation**: Build beautiful docs from the spec
- 🤖 **AI Integration**: Feed the spec to LLMs for code understanding
- 🔍 **API Discovery**: Understand package exports without reading source
- 🛠️ **Tooling**: Build custom tools that consume the OpenPkg format

## Comparison with TSDoc

While TSDoc focuses on **comment syntax**, OpenPkg focuses on **package structure**:

| Feature | TSDoc | OpenPkg |
|---------|-------|---------|
| Focus | Comment syntax | Package structure |
| Output | Annotated source | JSON specification |
| Types | In comments | Extracted with `$ref` |
| Similar to | JSDoc | OpenAPI |

## Limitations

- Only analyzes TypeScript source files (not compiled JavaScript)
- Does not follow external module imports
- Complex generic constraints are represented as strings
- Currently analyzes single entry points (full package analysis coming soon)

## Roadmap

- [ ] Multi-file package analysis
- [ ] Watch mode for real-time updates
- [ ] Support for monorepos
- [ ] Plugin system for custom extractors
- [ ] Online playground

## Contributing

OpenPkg is open source! We welcome contributions:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT