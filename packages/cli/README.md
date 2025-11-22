# @openpkg-ts/cli

Command-line interface for emitting `openpkg.json` files from TypeScript projects.

## Install
```bash
npm install -g @openpkg-ts/cli
```

## Common Commands
```bash
# Generate openpkg.json in the current package
openpkg generate

# Point at a specific entry file
openpkg generate src/index.ts --output openpkg.json

# Scaffold a config to pin defaults
openpkg init

# Fail CI if docs coverage dips below 90%
openpkg check --min-coverage 90 --require-examples
```

## Flags at a Glance
- `--include <id>` / `--exclude <id>` – narrow the surface area
- `--package <name>` – target a workspace package from the monorepo root
- `--no-external-types` – skip pulling types from installed deps
- `--output <file>` – write somewhere other than `openpkg.json`

## Config File
Optional `openpkg.config.(ts|js|mjs)` keeps CLI defaults alongside your project:
```ts
// openpkg.config.ts
import { defineConfig } from '@openpkg-ts/cli/config';

export default defineConfig({
  include: ['createUser'],
  exclude: ['internalHelper'],
  resolveExternalTypes: true,
});
```
CLI flags always win over config values.

## More
Full command reference and troubleshooting tips live in the repository:
- [Usage docs](../../packages/cli/src) (source)
- [Fixtures](../../tests/fixtures/README.md)

MIT License
