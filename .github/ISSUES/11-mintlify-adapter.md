# Mintlify Adapter

**Priority:** P4.2
**Phase:** 4
**Labels:** `enhancement`, `ecosystem`, `integration`

## Summary

Create an adapter that allows Mintlify to consume OpenPkg specs for generating API reference documentation. Make `openpkg.json` the single source of truth for Mintlify docs.

## Background

Mintlify is a popular documentation platform that typically requires manual MDX files or OpenAPI specs. This adapter would allow TypeScript packages to auto-generate API reference pages from their OpenPkg spec.

## Proposed Usage

### mint.json Configuration

```json
{
  "name": "My Package",
  "navigation": [
    {
      "group": "API Reference",
      "pages": ["api/**"]
    }
  ],
  "integrations": {
    "doccov": {
      "specPath": "./openpkg.json",
      "outputDir": "./api"
    }
  }
}
```

### CLI Command

```bash
# Generate Mintlify pages from spec
doccov mintlify --spec openpkg.json --output ./docs/api

# Watch mode for development
doccov mintlify --watch
```

### Output Structure

```
docs/
├── api/
│   ├── functions/
│   │   ├── createClient.mdx
│   │   ├── fetchUser.mdx
│   │   └── index.mdx
│   ├── classes/
│   │   ├── Client.mdx
│   │   └── index.mdx
│   └── types/
│       ├── ClientOptions.mdx
│       └── index.mdx
```

## Generated MDX Format

```mdx
---
title: createClient
description: Creates a new API client instance
---

## Signature

```typescript
function createClient(options: ClientOptions): Client
```

## Parameters

<ParamField path="options" type="ClientOptions" required>
  Configuration options for the client
</ParamField>

<ParamField path="options.baseUrl" type="string" required>
  The base URL for API requests
</ParamField>

<ParamField path="options.timeout" type="number">
  Request timeout in milliseconds. Default: 30000
</ParamField>

## Returns

<ResponseField name="Client" type="Client">
  A configured client instance
</ResponseField>

## Example

```typescript
const client = createClient({
  baseUrl: 'https://api.example.com',
  timeout: 5000
});
```
```

## Implementation

### SDK: MDX Generator

```typescript
// packages/sdk/src/adapters/mintlify.ts

export interface MintlifyAdapterOptions {
  specPath: string;
  outputDir: string;
  groupBy?: 'kind' | 'module' | 'flat';
  includeExamples?: boolean;
  customComponents?: Record<string, string>;
}

export function generateMintlifyDocs(
  spec: Spec,
  options: MintlifyAdapterOptions
): Promise<void>;

export function generateMintlifyPage(
  export: SpecExport
): string;
```

### CLI Command

```typescript
// packages/cli/src/commands/mintlify.ts

export const mintlifyCommand = new Command('mintlify')
  .description('Generate Mintlify documentation from OpenPkg spec')
  .option('--spec <path>', 'Path to openpkg.json', 'openpkg.json')
  .option('--output <dir>', 'Output directory', './docs/api')
  .option('--watch', 'Watch for spec changes')
  .action(async (options) => {
    // ...
  });
```

## Features

| Feature | Description |
|---------|-------------|
| Auto-generate pages | Create MDX files from spec exports |
| Mintlify components | Use `<ParamField>`, `<ResponseField>`, etc. |
| Grouping | Group by kind, module, or flat structure |
| Examples | Include @example blocks as code snippets |
| Coverage badge | Show coverage inline on each page |
| Watch mode | Re-generate on spec changes |

## Acceptance Criteria

- [ ] `doccov mintlify` command generates MDX files
- [ ] Uses Mintlify-native components (`<ParamField>`, etc.)
- [ ] Respects Mintlify project structure conventions
- [ ] Includes examples from @example blocks
- [ ] `--watch` mode for development workflow
- [ ] Documentation with setup instructions
