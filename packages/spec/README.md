# @openpkg-ts/spec

Shared contract for the OpenPkg specification, including versioned JSON Schema files, TypeScript types, validation helpers, and diff utilities. The package is still under construction; functionality will be filled in as the spec is extracted from the CLI and SDK.

## Development

```bash
bun install
bun run build
```

The build compiles ESM output and type declarations under `dist/`. Schemas are published verbatim from the `schemas/` directory.


## Usage Examples

### Validate & Normalize a Generated Spec
```ts
import { readFile } from 'node:fs/promises';
import { normalize, validateSpec } from '@openpkg-ts/spec';

const raw = await readFile('openpkg.json', 'utf8');
const spec = JSON.parse(raw);
const normalized = normalize(spec);

const result = validateSpec(normalized);
if (!result.ok) {
  for (const err of result.errors) {
    console.error(`schema: ${err.instancePath || '/'} ${err.message}`);
  }
  process.exit(1);
}

console.log('✅ spec is valid and normalized');
```

### Diff Two Spec Snapshots
```ts
import { readFile } from 'node:fs/promises';
import { dereference, diffSpec, normalize } from '@openpkg-ts/spec';

const [currentPath, nextPath] = process.argv.slice(2);
const load = async (file: string) =>
  dereference(normalize(JSON.parse(await readFile(file, 'utf8'))));

const current = await load(currentPath);
const next = await load(nextPath);
const diff = diffSpec(current, next);

console.log('Breaking changes:', diff.breaking);
console.log('Non-breaking changes:', diff.nonBreaking);
console.log('Docs-only changes:', diff.docsOnly);
```

### Assert Valid Specs in Tests
```ts
import { expect, test } from 'bun:test';
import { normalize, validateSpec } from '@openpkg-ts/spec';
import spec from '../openpkg.json' assert { type: 'json' };

test('generated spec stays schema-valid', () => {
  const normalized = normalize(spec);
  const result = validateSpec(normalized);
  expect(result.ok).toBe(true);
});
```
