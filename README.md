# OpenPkg

A powerful TypeScript package analyzer that generates comprehensive API specifications using the TypeScript Compiler API.

## Features

- **Full Type Resolution** - Resolves complex types including generics, utility types, and mapped types
- **No AI Dependency** - Complete type analysis using TypeScript Compiler API (AI is optional for documentation enhancement)
- **Cross-file Analysis** - Follows imports and resolves types across multiple files
- **Rich Metadata** - Extracts JSDoc comments, inferred types, and type hierarchies
- **Backward Compatible** - Maintains compatibility with existing OpenPkg specifications

## Installation

```bash
bun install openpkg
# or
npm install openpkg
```

## Usage

### CLI

```bash
# Basic usage (uses TypeScript Compiler API by default)
openpkg src/index.ts --output api-spec.json

# Include resolved type information
openpkg src/index.ts --include-resolved-types --output api-spec.json

# Include type hierarchy
openpkg src/index.ts --include-type-hierarchy --output api-spec.json

# Use legacy ts-morph parser
openpkg src/index.ts --use-legacy-parser --output api-spec.json

# Enhance with AI (optional)
openpkg src/index.ts --enhance-with-ai --ai-examples --output api-spec.json
```

### Programmatic API

```typescript
import { generateEnhancedSpec } from 'openpkg';

const spec = generateEnhancedSpec('src/index.ts', {
  includeResolvedTypes: true,
  includeTypeHierarchy: true,
  maxDepth: 5
});

console.log(JSON.stringify(spec, null, 2));
```

## What's New in v2.0

### TypeScript Compiler API Integration

OpenPkg now uses the TypeScript Compiler API directly for superior type resolution:

- **Utility Type Expansion**: `Partial<User>` → shows all properties as optional
- **Generic Resolution**: `Array<string>` → fully resolved array type
- **Type Inference**: Detects and marks inferred return types
- **Declaration Merging**: Handles merged interfaces and namespaces
- **JSDoc Extraction**: Complete extraction of all JSDoc tags

### Example Output

```typescript
// Input
export type PartialUser = Partial<User>;

// Output with --include-resolved-types
{
  "type": "Partial<User>",
  "expandedType": {
    "properties": [
      { "name": "id", "type": "string", "optional": true },
      { "name": "name", "type": "string", "optional": true },
      { "name": "email", "type": "string", "optional": true }
    ]
  }
}
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <file>` | Output file path | `output.json` |
| `--include-resolved-types` | Include fully resolved type information | `false` |
| `--include-type-hierarchy` | Include type inheritance hierarchy | `false` |
| `--max-depth <number>` | Maximum depth for type resolution | `5` |
| `--use-legacy-parser` | Use legacy ts-morph parser | `false` |
| `--enhance-with-ai` | Use AI for documentation enhancement | `false` |
| `--ai-examples` | Generate code examples using AI | `false` |
| `--ai-descriptions` | Enhance descriptions using AI | `false` |
| `--no-cache` | Disable caching | `false` |

## Type Resolution Examples

### Utility Types
```typescript
export type ReadonlyUser = Readonly<User>;
export type PartialUser = Partial<User>;
export type RequiredUser = Required<User>;
export type PickedUser = Pick<User, 'id' | 'name'>;
```

### Complex Generics
```typescript
export interface Repository<T> {
  items: T[];
  add(item: T): void;
  find(id: string): T | undefined;
}
```

### Type Inference
```typescript
// Return type is inferred
export const double = (x: number) => x * 2;

// Generic type parameters are inferred
export function identity<T>(value: T) {
  return value;
}
```

## Performance

The TypeScript Compiler API implementation includes:
- **Caching**: Type resolutions are cached for performance
- **Incremental Analysis**: Only analyzes what's needed
- **Configurable Depth**: Control resolution depth with `--max-depth`

## Migration from v1.x

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for detailed migration instructions.

Key changes:
- TypeScript Compiler API is now the default (use `--use-legacy-parser` for old behavior)
- AI is now optional enhancement only
- New flags for enhanced type information
- Improved performance with caching

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run specific test suite
bun test:phase4

# Run CLI locally
bun run src/cli.ts test/example.ts --output output.json
```

## Architecture

OpenPkg v2 is built with a modular architecture:

- **Compiler API Service** - Manages TypeScript program and type checker
- **Type Resolver** - Handles type resolution and expansion
- **Symbol Resolver** - Extracts JSDoc and handles symbol aliases
- **Type Walker** - Recursively walks type structures
- **Module Resolver** - Handles cross-file imports
- **Type Cache** - Performance optimization layer
- **AI Enhancement** - Optional documentation enhancement

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs.

## License

MIT

## Acknowledgments

Built with:
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation