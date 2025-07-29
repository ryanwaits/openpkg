# Migration Guide: ts-morph to TypeScript Compiler API

This guide helps you migrate from the ts-morph-based parser to the new TypeScript Compiler API implementation in OpenPkg.

## Overview

The new TypeScript Compiler API implementation provides:
- **Full type resolution** without AI assistance
- **Generic type expansion** (e.g., `Partial<T>` → all optional properties)
- **Cross-file type analysis** with import resolution
- **Type inference detection** for non-explicit types
- **Rich JSDoc extraction** including all tags

## Migration Steps

### 1. Enable the Enhanced Parser

The enhanced parser is available via CLI flags. Start by testing it alongside your existing workflow:

```bash
# Old way (ts-morph)
openpkg index.ts --output spec.json

# New way (TypeScript Compiler API)
openpkg index.ts --use-enhanced-parser --output spec.json
```

### 2. Gradual Feature Adoption

Enable features incrementally to ensure compatibility:

```bash
# Basic enhanced parsing
openpkg index.ts --use-enhanced-parser

# Add resolved type information
openpkg index.ts --use-enhanced-parser --include-resolved-types

# Add type hierarchy information
openpkg index.ts --use-enhanced-parser --include-type-hierarchy

# Control resolution depth
openpkg index.ts --use-enhanced-parser --max-depth 10
```

### 3. Output Format Changes

The enhanced parser maintains backward compatibility while adding optional fields:

#### Standard Output (Compatible)
```json
{
  "exports": [{
    "id": "createUser",
    "name": "createUser",
    "kind": "function",
    "signatures": [{
      "parameters": [...],
      "returnType": { "$ref": "#/types/User" }
    }]
  }],
  "types": [{
    "id": "User",
    "name": "User",
    "kind": "interface",
    "properties": [...]
  }]
}
```

#### Enhanced Output (With Additional Fields)
```json
{
  "exports": [{
    "id": "createUser",
    "name": "createUser",
    "kind": "function",
    "signatures": [{
      "parameters": [{
        "name": "data",
        "type": { "$ref": "#/types/Partial<User>" },
        "resolvedType": {  // NEW
          "typeString": "Partial<User>",
          "properties": [
            { "name": "id", "optional": true, ... },
            { "name": "name", "optional": true, ... }
          ]
        }
      }],
      "returnType": { "$ref": "#/types/User" }
    }],
    "flags": {
      "isInferredReturn": false  // NEW
    },
    "tags": [  // NEW - JSDoc tags
      { "name": "since", "text": "1.0.0" }
    ]
  }]
}
```

### 4. Type Resolution Examples

#### Utility Types
```typescript
// Input
export type PartialUser = Partial<User>;

// ts-morph output
{ "type": "Partial<User>" }

// Compiler API output with --include-resolved-types
{
  "type": "Partial<User>",
  "expandedType": {
    "properties": [
      { "name": "id", "type": "string", "optional": true },
      { "name": "name", "type": "string", "optional": true }
    ]
  }
}
```

#### Generic Functions
```typescript
// Input
export function map<T, U>(items: T[], fn: (item: T) => U): U[] {
  return items.map(fn);
}

// Enhanced output includes generic constraints and type parameters
```

### 5. API Usage (Programmatic)

If using OpenPkg programmatically:

```typescript
// Old way
import { generateBaseSpec } from 'openpkg';
const spec = generateBaseSpec('index.ts');

// New way
import { generateEnhancedSpec } from 'openpkg';
const spec = generateEnhancedSpec('index.ts', {
  includeResolvedTypes: true,
  includeTypeHierarchy: true,
  maxDepth: 5,
  useCompilerAPI: true
});

// Backward compatible way
import { generateBaseSpec } from 'openpkg';
const spec = generateBaseSpec('index.ts'); // Still works, uses enhanced parser internally
```

### 6. Handling Breaking Changes

There are no breaking changes in the output format. The enhanced parser is designed to be a drop-in replacement with additional capabilities.

#### Potential Issues and Solutions

1. **Performance**: The Compiler API may be slower for very large codebases
   - Solution: Use `--max-depth` to limit resolution depth
   - Solution: The built-in cache improves performance for repeated runs

2. **Memory Usage**: Deep type resolution can use more memory
   - Solution: Adjust `--max-depth` based on your needs
   - Solution: Use `--no-cache` if memory is limited

3. **Complex Circular Types**: Some circular type references may cause issues
   - Solution: The parser includes cycle detection
   - Solution: Report issues for specific type patterns

### 7. Feature Comparison

| Feature | ts-morph | Compiler API | Notes |
|---------|----------|--------------|-------|
| Basic type info | ✅ | ✅ | Full compatibility |
| Generic expansion | ❌ | ✅ | Resolves `Partial<T>`, etc. |
| Cross-file imports | Limited | ✅ | Full import resolution |
| Type inference | ❌ | ✅ | Detects inferred types |
| JSDoc extraction | Basic | ✅ | All tags supported |
| Declaration merging | ❌ | ✅ | Handles merged interfaces |
| Performance | Fast | Good | Cached for performance |
| Memory usage | Low | Medium | Configurable depth |

### 8. Common Migration Scenarios

#### Scenario 1: CI/CD Pipeline
```bash
# Update your CI scripts
- openpkg src/index.ts --output api.json
+ openpkg src/index.ts --use-enhanced-parser --output api.json
```

#### Scenario 2: Documentation Generation
```bash
# Get richer type information for docs
openpkg src/index.ts \
  --use-enhanced-parser \
  --include-resolved-types \
  --include-type-hierarchy \
  --output docs/api-spec.json
```

#### Scenario 3: Type Analysis
```bash
# Analyze complex types without AI
openpkg src/types.ts \
  --use-enhanced-parser \
  --include-resolved-types \
  --max-depth 10 \
  --output type-analysis.json
```

### 9. Rollback Plan

If you encounter issues, you can always rollback:

1. Remove the `--use-enhanced-parser` flag
2. The original ts-morph parser is still available
3. Report issues to help improve the Compiler API implementation

### 10. Getting Help

- Report issues: [GitHub Issues](https://github.com/openpkg/openpkg/issues)
- Check test cases: `test/phase4-*.test.ts`
- Run comparison: `bun test test/phase4-comparison.test.ts`

## Conclusion

The migration to TypeScript Compiler API is designed to be seamless with significant benefits:
- No more AI dependency for type resolution
- Richer type information
- Better cross-file analysis
- More accurate type representation

Start with the `--use-enhanced-parser` flag and gradually enable additional features as needed.