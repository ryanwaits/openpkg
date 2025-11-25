# @doccov/cli

Command-line interface for documentation coverage and drift detection in TypeScript.

## Install
```bash
npm install -g @doccov/cli
```

## Common Commands
```bash
# Check documentation coverage (fail if below 80%)
doccov check --min-coverage 80

# Generate openpkg.json spec
doccov generate

# Point at a specific entry file
doccov generate src/index.ts --output openpkg.json

# Scaffold a config to pin defaults
doccov init

# Strict mode: require examples and 90% coverage
doccov check --min-coverage 90 --require-examples
```

## Flags at a Glance
- `--min-coverage <percentage>` – fail if coverage drops below threshold
- `--require-examples` – require `@example` blocks on all exports
- `--include <id>` / `--exclude <id>` – narrow the surface area
- `--package <name>` – target a workspace package from the monorepo root
- `--no-external-types` – skip pulling types from installed deps
- `--output <file>` – write somewhere other than `openpkg.json`

## Config File
Optional `doccov.config.(ts|js|mjs)` keeps CLI defaults alongside your project:
```ts
// doccov.config.ts
import { defineConfig } from '@doccov/cli/config';

export default defineConfig({
  include: ['createUser'],
  exclude: ['internalHelper'],
});
```
CLI flags always win over config values.

## Drift Detection

DocCov detects when your TSDoc comments drift from your code:

```
✖ Docs coverage 72% fell below required 80%.

Missing documentation details:
  • createUser: missing params, examples
  • updateUser: JSDoc documents parameter "userId" which is not present in the signature.
    Suggestion: Did you mean "id"?
```

## More
Full command reference and troubleshooting tips live in the repository:
- [Usage docs](../../USAGE.md)
- [Fixtures](../../tests/fixtures/README.md)

MIT License
