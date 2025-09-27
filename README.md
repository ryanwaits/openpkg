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
  "$schema": "https://raw.githubusercontent.com/ryanwaits/openpkg/main/schemas/v0.1.0/openpkg.schema.json",
  "openpkg": "0.1.0",
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

# Keep only specific exports
openpkg generate src/index.ts --include=createUser,deleteUser
```

### SDK Installation

```bash
npm install openpkg-sdk
```

### SDK Usage

```typescript
import { OpenPkg } from 'openpkg-sdk';

const openpkg = new OpenPkg();
const spec = await openpkg.analyzeFile('./src/index.ts', {
  filters: { include: ['createUser'] },
});
```

### Analyze a local file

```bash
# Analyze a single TypeScript entry point
openpkg analyze src/index.ts --show=summary

# Restrict output to specific exports
openpkg analyze src/index.ts --include=createUser --show=spec
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
- 🎚️ **Filter Controls** - Include or exclude exports via config files or CLI flags
- ✅ **Schema Validation** - JSON Schema for spec validation and IDE support

## Configuration

Add an `openpkg.config.(ts|js|mjs)` file to save defaults:

```ts
// openpkg.config.ts
import { defineConfig } from 'openpkg-cli/config';

export default defineConfig({
  include: ['createUser', 'deleteUser'],
  exclude: ['internalHelper'],
});
```

CLI flags override config values, and OpenPkg automatically pulls in referenced types for the exports you keep.

## License

MIT © Ryan Waits
