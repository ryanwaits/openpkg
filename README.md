# OpenPkg

Generate structured JSON specifications for TypeScript packages, similar to how OpenAPI documents REST APIs.

## What is OpenPkg?

Unlike TSDoc (which documents code) or the TypeScript compiler (which checks types), OpenPkg **extracts** your package's complete type structure into a standardized, consumable format:

- 🎯 **Structured JSON output** following OpenAPI patterns
- 📦 **Full type extraction** with complete JSDoc/TSDoc integration
- 🔗 **Smart type references** with `$ref` for clean, navigable specs
- ⚡ **Monorepo support** out of the box

## Installation

```bash
# Clone and link locally with Bun
git clone https://github.com/yourusername/openpkg.git
cd openpkg
bun install
bun link

# Now use anywhere
openpkg generate
```

## Basic Usage

```bash
# Generate from package.json entry point
openpkg generate

# Generate from specific file
openpkg generate src/index.ts

# Target a monorepo package
openpkg generate --package @myorg/package-name

# Custom output
openpkg generate -o api-spec.json
```

## Example Output

Input TypeScript:
```typescript
/**
 * Calculate distance between two points
 * @param a - First point
 * @param b - Second point
 * @returns Distance between points
 */
export function distance(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

export interface Point {
  x: number;
  y: number;
}
```

Output OpenPkg spec:
```json
{
  "openpkg": "1.0.0",
  "meta": {
    "name": "openpkg",
    "version": "1.0.0",
    "description": "OpenAPI-like specification generator for TypeScript packages",
    "license": "",
    "repository": "",
    "ecosystem": "js/ts"
  },
  "exports": [
    {
      "id": "distance",
      "name": "distance",
      "kind": "function",
      "signatures": [
        {
          "parameters": [
            {
              "name": "a",
              "required": true,
              "description": "First point",
              "schema": {
                "$ref": "#/types/Point"
              }
            },
            {
              "name": "b",
              "required": true,
              "description": "Second point",
              "schema": {
                "$ref": "#/types/Point"
              }
            }
          ],
          "returns": {
            "schema": {
              "type": "number"
            },
            "description": "Distance between points"
          }
        }
      ],
      "description": "Calculate distance between two points",
      "source": {
        "file": "<path-to-source-file>",
        "line": 7
      }
    },
    {
      "id": "Point",
      "name": "Point",
      "kind": "interface",
      "description": "",
      "source": {
        "file": "<path-to-source-file>",
        "line": 11
      }
    }
  ],
  "types": [
    {
      "id": "Point",
      "name": "Point",
      "kind": "interface",
      "schema": {
        "type": "object",
        "properties": {
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          }
        },
        "required": [
          "x",
          "y"
        ]
      },
      "description": "",
      "source": {
        "file": "<path-to-source-file>",
        "line": 11
      }
    }
  ]
}
```

## Key Features

### Smart Type Extraction
- Handles complex TypeScript patterns (unions, intersections, generics)
- Extracts JSDoc/TSDoc documentation automatically
- Resolves type references across files

### OpenAPI Alignment
- Uses familiar `schema` objects with `properties` and `required` arrays
- Supports `oneOf`, `anyOf` for complex types
- Compatible with OpenAPI tooling for schema validation

### Developer Friendly
- Auto-detects entry points from package.json
- Works with `.ts` source files (not just `.d.ts`)
- Monorepo-aware with workspace support

## Analyze Command (Studio Feature)

Analyze TypeScript files directly from GitHub URLs using OpenPkg Studio:

```bash
# Basic analysis
openpkg analyze https://github.com/org/repo/blob/main/src/index.ts

# Show import analysis
openpkg analyze https://github.com/org/repo/blob/main/src/index.ts --show=imports

# Follow and analyze relative imports
openpkg analyze https://github.com/org/repo/blob/main/src/index.ts --follow=imports

# Combine multiple display options
openpkg analyze https://github.com/org/repo/blob/main/src/index.ts --follow=imports --show=spec,imports,summary

# Debug mode with import following
openpkg analyze https://github.com/org/repo/blob/main/src/index.ts --follow=imports --show=debug --max-depth=3
```

### Analyze Options

- `--show=<items>` - What to display (comma-separated):
  - `spec` - Generate OpenPkg specification (default)
  - `imports` - Show import analysis
  - `summary` - Show detailed exports/types breakdown
  - `debug` - Display debug information
  
- `--follow=<items>` - What to follow (comma-separated):
  - `imports` - Recursively analyze relative imports

- `--max-depth <n>` - Maximum depth for import resolution (default: 5)
- `-o, --output <file>` - Save specification to file

## Why OpenPkg?

**TSDoc** tells you how to write comments. **TypeScript** checks your types. **OpenPkg** extracts your entire package structure into a format that tools can understand and consume - enabling rich documentation and tooling capabilities.

## License

MIT
