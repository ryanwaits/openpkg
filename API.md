# OpenPkg API Documentation

## Table of Contents
- [Core Functions](#core-functions)
- [CLI API](#cli-api)
- [Service APIs](#service-apis)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)

## Core Functions

### `generateEnhancedSpec(entryFile, options)`

Generates an OpenPkg specification using the TypeScript Compiler API.

#### Parameters
- `entryFile: string` - Path to the TypeScript entry file
- `options?: EnhancedGeneratorOptions` - Optional configuration

#### Options
```typescript
interface EnhancedGeneratorOptions {
  includeResolvedTypes?: boolean;    // Include expanded type information
  includeTypeHierarchy?: boolean;     // Include type inheritance hierarchy
  maxDepth?: number;                  // Maximum resolution depth (default: 5)
  useCompilerAPI?: boolean;           // Use Compiler API (default: true)
}
```

#### Returns
`OpenPkgSpec` - The generated specification

#### Example
```typescript
import { generateEnhancedSpec } from 'openpkg';

const spec = generateEnhancedSpec('src/index.ts', {
  includeResolvedTypes: true,
  includeTypeHierarchy: true,
  maxDepth: 10
});
```

### `generateBaseSpec(entryFile)`

Legacy function using ts-morph. Maintained for backward compatibility.

#### Parameters
- `entryFile: string` - Path to the TypeScript entry file

#### Returns
`OpenPkgSpec` - The generated specification

## CLI API

### Command Line Interface

```bash
openpkg [entry] [options]
```

### Arguments
- `entry` - File path or package (default: 'index.ts')

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--output <file>` | `-o` | Output file path | `output.json` |
| `--include-resolved-types` | | Include fully resolved type information | `false` |
| `--include-type-hierarchy` | | Include type inheritance hierarchy | `false` |
| `--max-depth <number>` | | Maximum depth for type resolution | `5` |
| `--use-legacy-parser` | | Use legacy ts-morph parser | `false` |
| `--enhance-with-ai` | | Use AI for documentation enhancement | `false` |
| `--ai-examples` | | Generate code examples using AI | `false` |
| `--ai-descriptions` | | Enhance descriptions using AI | `false` |
| `--no-cache` | | Disable caching | `false` |
| `--verbose` | `-v` | Enable verbose output | `false` |

### Examples

```bash
# Basic usage
openpkg src/index.ts

# With resolved types
openpkg src/index.ts --include-resolved-types --output api.json

# With AI enhancement
openpkg src/index.ts --enhance-with-ai --ai-examples

# Using legacy parser
openpkg src/index.ts --use-legacy-parser
```

## Service APIs

### CompilerAPIService

Manages TypeScript program creation and type checking.

```typescript
interface CompilerAPIService {
  createProgram(files: string[], options?: ts.CompilerOptions): ts.Program;
  getTypeChecker(): ts.TypeChecker;
  getSourceFile(fileName: string): ts.SourceFile | undefined;
}
```

#### Usage
```typescript
import { createCompilerAPIService } from 'openpkg/services';

const service = createCompilerAPIService();
const program = service.createProgram(['src/index.ts']);
const typeChecker = service.getTypeChecker();
```

### TypeResolver

Handles type resolution and expansion.

```typescript
interface ITypeResolver {
  resolveType(node: ts.Node): ResolvedType;
  getProperties(type: ts.Type): PropertyInfo[];
  expandGeneric(type: ts.Type): ExpandedType;
  resolveImportedType(typeName: string, sourceFile: ts.SourceFile): ResolvedType | null;
  getTypeString(type: ts.Type): string;
}
```

#### Example
```typescript
import { TypeResolverFactory } from 'openpkg/services';

const resolver = TypeResolverFactory.getCompilerResolver(['src/index.ts']);
const resolvedType = resolver.resolveType(node);
```

### SymbolResolver

Extracts JSDoc and handles symbol resolution.

```typescript
class SymbolResolver {
  getSymbolAtLocation(node: ts.Node): ts.Symbol | undefined;
  getJSDocComments(symbol: ts.Symbol): JSDocInfo;
  getJSDocFromNode(node: ts.Node): JSDocInfo | null;
  resolveAlias(symbol: ts.Symbol): ts.Symbol;
  isDeclarationMerge(symbol: ts.Symbol): boolean;
  getExportedSymbols(sourceFile: ts.SourceFile): Map<string, ts.Symbol>;
}
```

### TypeWalker

Recursively walks type structures.

```typescript
interface TypeWalker {
  walk(type: ts.Type, depth?: number, maxDepth?: number): TypeStructure;
  visitNode(node: ts.Node): void;
  clearVisited(): void;
}
```

### TypeCache

Performance optimization through caching.

```typescript
class TypeCache {
  getOrResolveType(node: ts.Node, resolver: () => ResolvedType): ResolvedType;
  getOrResolveSymbol<T>(symbol: ts.Symbol, resolver: () => T): T;
  warmUp(sourceFiles: ts.SourceFile[], typeChecker: ts.TypeChecker): void;
  getStats(): CacheStats;
  clearAll(): void;
}
```

## Type Definitions

### OpenPkgSpec

The main output specification format.

```typescript
interface OpenPkgSpec {
  openpkg: string;            // Version (e.g., "1.0.0")
  meta: {
    name: string;
    version: string;
    ecosystem: 'js/ts';
    description?: string;
    license?: string;
    repository?: string;
  };
  exports: Export[];
  types: Type[];
}
```

### Export

Represents an exported function, class, or variable.

```typescript
interface Export {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'variable' | 'enum';
  description?: string;
  signatures?: Signature[];     // For functions
  constructors?: Constructor[]; // For classes
  examples?: string[];
  source: SourceLocation;
  flags?: ExportFlags;
  tags?: JSDocTag[];
  since?: string;              // From @since tag
  deprecated?: boolean;        // From @deprecated tag
}
```

### Type

Represents a type definition.

```typescript
interface Type {
  id: string;
  name: string;
  kind: 'interface' | 'type' | 'class' | 'enum';
  description?: string;
  properties?: Property[];      // For interfaces/classes
  members?: Member[];          // For classes
  type?: string;              // For type aliases
  expandedType?: ExpandedType; // When includeResolvedTypes is true
  typeHierarchy?: TypeStructure; // When includeTypeHierarchy is true
  extends?: string[];         // Parent types
  implements?: string[];      // Implemented interfaces
  source: SourceLocation;
}
```

### ResolvedType

Detailed type information from the Compiler API.

```typescript
interface ResolvedType {
  typeString: string;
  isGeneric: boolean;
  genericArguments?: ResolvedType[];
  isUnion: boolean;
  isIntersection: boolean;
  isArray: boolean;
  elementType?: ResolvedType;
  isPrimitive: boolean;
  isObject: boolean;
  isFunction: boolean;
  properties?: PropertyInfo[];
}
```

### PropertyInfo

Property information with full resolution.

```typescript
interface PropertyInfo {
  name: string;
  type: ResolvedType;
  optional: boolean;
  readonly: boolean;
  description: string;
  visibility: 'public' | 'private' | 'protected';
  inherited?: boolean;
  inheritedFrom?: string;
}
```

### JSDocInfo

Extracted JSDoc information.

```typescript
interface JSDocInfo {
  description: string;
  tags: Array<{ name: string; text: string }>;
  examples: string[];
  params: Map<string, string>;
  returns?: string;
  deprecated: boolean;
  since?: string;
  see: string[];
}
```

## Error Handling

### ErrorHandler

Centralized error handling service.

```typescript
class ErrorHandler {
  handleDiagnostic(diagnostic: ts.Diagnostic): void;
  handleTypeResolutionError(error: Error, node?: ts.Node, context?: string): void;
  handleWithFallback<T>(operation: () => T, fallback: T, context?: string): T;
  getErrors(): TypeResolutionError[];
  hasErrors(): boolean;
  printAll(): void;
  getSummary(): ErrorSummary;
}
```

### Error Types

```typescript
interface TypeResolutionError {
  code: string;
  message: string;
  location?: string;
  type: 'typescript-diagnostic' | 'type-resolution' | 'runtime';
  node?: ts.Node;
  context?: string;
  stack?: string;
  timestamp?: Date;
}
```

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `TYPE_RESOLUTION_ERROR` | Failed to resolve type | Check for circular references |
| `TS2304` | Cannot find name | Ensure proper imports |
| `OPERATION_FAILED` | Generic operation failure | Check error context |
| `FALLBACK_TO_TSMORPH` | Compiler API failed | Type too complex for resolution |

## Advanced Usage

### Custom Type Resolution

```typescript
import { 
  createCompilerAPIService, 
  TypeResolverCompilerAPI,
  SymbolResolver,
  TypeWalker 
} from 'openpkg/services';

// Create custom resolver
const service = createCompilerAPIService();
const program = service.createProgram(['src/types.ts']);
const typeChecker = service.getTypeChecker();

const resolver = new TypeResolverCompilerAPI(typeChecker);
const symbolResolver = new SymbolResolver(typeChecker);
const walker = new TypeWalkerImpl(typeChecker);

// Resolve a specific type
const sourceFile = program.getSourceFile('src/types.ts');
const node = /* find your node */;
const resolvedType = resolver.resolveType(node);

// Walk type hierarchy
const type = typeChecker.getTypeAtLocation(node);
const structure = walker.walk(type, 0, 10);
```

### AI Enhancement

```typescript
import { enhanceWithAI } from 'openpkg/ai';

const spec = generateEnhancedSpec('src/index.ts');
const enhancedSpec = await enhanceWithAI(spec, {
  generateExamples: true,
  enhanceDescriptions: true,
  suggestBestPractices: true,
  analyzeUsagePatterns: true
});
```

### Programmatic Cache Control

```typescript
import { TypeCache } from 'openpkg/services';

const cache = new TypeCache(10000); // Max 10k entries

// Warm up cache
cache.warmUp([sourceFile], typeChecker);

// Get stats
const stats = cache.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);

// Clear cache
cache.clearAll();
```

## Best Practices

1. **Use caching for large projects**: The cache significantly improves performance
2. **Set appropriate max depth**: Deep resolution can be memory intensive
3. **Handle errors gracefully**: Use the ErrorHandler for production code
4. **Prefer Compiler API**: It's faster and more accurate than legacy parser
5. **Use AI sparingly**: AI enhancement is optional and requires API keys

## Limitations

1. **Recursive types**: May cause stack overflow in extreme cases
2. **Very large unions**: Performance may degrade with 100+ union members
3. **Declaration files**: Limited support for ambient declarations
4. **Dynamic types**: Cannot resolve runtime-generated types

## Migration from v1.x

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for detailed instructions.

Key changes:
- Compiler API is now default
- AI is optional
- New resolution capabilities
- Enhanced performance