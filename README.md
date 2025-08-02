# OpenPkg

[![npm version](https://img.shields.io/npm/v/openpkg-cli.svg)](https://www.npmjs.com/package/openpkg-cli)
[![npm version](https://img.shields.io/npm/v/openpkg-sdk.svg)](https://www.npmjs.com/package/openpkg-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate structured JSON specifications for TypeScript packages, similar to how OpenAPI documents REST APIs.

## What is OpenPkg?

OpenPkg extracts your TypeScript package's complete type structure into a standardized, machine-readable format:

```typescript
// Your TypeScript code
export interface User {
  id: string;
  name: string;
  email: string;
}

export function createUser(data: Partial<User>): User {
  // ...
}
```

```json
// Generated OpenPkg specification
{
  "exports": [{
    "name": "createUser",
    "kind": "function",
    "signatures": [{
      "parameters": [{
        "name": "data",
        "schema": { "$ref": "#/types/User" }
      }],
      "returns": {
        "schema": { "$ref": "#/types/User" }
      }
    }]
  }],
  "types": [{
    "name": "User",
    "kind": "interface",
    "schema": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string" }
      }
    }
  }]
}
```

## Quick Start

### CLI Installation

```bash
npm install -g openpkg-cli
```

### Basic Usage

```bash
# Generate spec for your package
openpkg generate

# Generate from specific file
openpkg generate src/index.ts
```

### SDK Installation

```bash
npm install openpkg-sdk
```

### SDK Usage

```typescript
import { OpenPkg } from 'openpkg-sdk';

const openpkg = new OpenPkg();
const spec = await openpkg.analyzeFile('./src/index.ts');
```

## Documentation

- 📖 [CLI Documentation](./packages/cli/README.md) - Full CLI usage guide with all commands and options
- 📦 [SDK Documentation](./packages/sdk/README.md) - SDK API reference and examples
- 🧪 [Examples](./examples/README.md) - Sample TypeScript projects demonstrating various features

## Key Features

- 🎯 **Structured Output** - JSON specifications following OpenAPI patterns
- 📦 **Complete Type Extraction** - All exports, types, interfaces, and classes
- 🔗 **Smart References** - Clean `$ref` links between types
- 📚 **JSDoc Integration** - Preserves your documentation
- ⚡ **Monorepo Support** - Works with workspace packages

## License

MIT © Ryan Waits
