# @openpkg-ts/spec

Canonical schema, TypeScript types, validation, normalization, deref, diff, and migration helpers for OpenPkg specs.

## Install
```bash
npm install @openpkg-ts/spec
```

## Quick Helpers
```ts
import { normalize, validateSpec } from '@openpkg-ts/spec';

const normalized = normalize(spec);
const result = validateSpec(normalized);
if (!result.ok) {
  throw new Error(result.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('\n'));
}
```

```ts
import { dereference, diffSpec } from '@openpkg-ts/spec';

const left = dereference(specA);
const right = dereference(specB);
const diff = diffSpec(left, right);
```

## See Also
- [SDK generator](../sdk/README.md)
- [CLI usage](../cli/README.md)

MIT License
