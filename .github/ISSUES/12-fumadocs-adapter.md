# Fumadocs Adapter

**Priority:** P4.3
**Phase:** 4
**Labels:** `enhancement`, `ecosystem`, `integration`

## Summary

Create an adapter that allows Fumadocs to consume OpenPkg specs for generating API reference documentation. Make `openpkg.json` work seamlessly with Fumadocs' file-based routing.

## Background

Fumadocs is a Next.js documentation framework gaining popularity as an alternative to Docusaurus. This adapter would auto-generate API reference MDX pages that integrate with Fumadocs' content layer.

## Proposed Usage

### fumadocs.config.ts

```typescript
import { defineConfig } from 'fumadocs-core/config';
import { doccovSource } from '@doccov/fumadocs-adapter';

export default defineConfig({
  source: doccovSource({
    specPath: './openpkg.json',
    basePath: '/api',
  }),
});
```

### CLI Command

```bash
# Generate Fumadocs pages from spec
doccov fumadocs --spec openpkg.json --output ./content/api

# Watch mode
doccov fumadocs --watch
```

### Output Structure

```
content/
├── api/
│   ├── index.mdx          # API overview with export list
│   ├── createClient.mdx
│   ├── Client.mdx
│   └── meta.json          # Fumadocs navigation config
```

## Generated MDX Format

```mdx
---
title: createClient
description: Creates a new API client instance
---

import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Callout } from 'fumadocs-ui/components/callout';

## Signature

```ts
function createClient(options: ClientOptions): Client
```

## Parameters

<TypeTable
  type={{
    options: {
      type: 'ClientOptions',
      description: 'Configuration options for the client',
      required: true,
    },
  }}
/>

## Returns

Returns a `Client` instance configured with the provided options.

## Example

```ts
const client = createClient({
  baseUrl: 'https://api.example.com',
});
```

<Callout type="info">
  Coverage: 92% • Last updated: 2024-01-15
</Callout>
```

## Implementation

### SDK: Fumadocs Generator

```typescript
// packages/sdk/src/adapters/fumadocs.ts

export interface FumadocsAdapterOptions {
  specPath: string;
  outputDir: string;
  basePath?: string;
  components?: {
    typeTable?: string;
    callout?: string;
  };
}

export function generateFumadocsDocs(
  spec: Spec,
  options: FumadocsAdapterOptions
): Promise<void>;

export function generateFumadocsPage(
  export: SpecExport,
  options?: { showCoverage?: boolean }
): string;

export function generateFumadocsMeta(
  exports: SpecExport[]
): object;
```

### Fumadocs Source Plugin

```typescript
// packages/fumadocs-adapter/src/index.ts

import { createSource } from 'fumadocs-core/source';

export function doccovSource(options: {
  specPath: string;
  basePath?: string;
}) {
  return createSource({
    async load() {
      const spec = JSON.parse(fs.readFileSync(options.specPath, 'utf-8'));
      return spec.exports.map(exp => ({
        path: `${options.basePath}/${exp.name}`,
        data: generateFumadocsPage(exp),
      }));
    },
  });
}
```

## Features

| Feature | Description |
|---------|-------------|
| MDX generation | Create pages with Fumadocs components |
| TypeTable | Use `<TypeTable>` for parameter docs |
| meta.json | Generate navigation config |
| Content source | Optional runtime source integration |
| Coverage display | Show coverage inline |
| Watch mode | Re-generate on changes |

## Package Structure

```
packages/
├── sdk/
│   └── src/adapters/fumadocs.ts    # Core generation logic
└── fumadocs-adapter/               # Optional: npm package
    ├── package.json
    └── src/index.ts                # Fumadocs source plugin
```

## Acceptance Criteria

- [ ] `doccov fumadocs` command generates MDX files
- [ ] Uses Fumadocs components (`<TypeTable>`, `<Callout>`, etc.)
- [ ] Generates `meta.json` for navigation
- [ ] Works with Fumadocs file-based routing
- [ ] Optional: Content source plugin for runtime generation
- [ ] Documentation with setup instructions
