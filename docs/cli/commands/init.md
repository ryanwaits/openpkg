# doccov init

Create a DocCov configuration file.

## Usage

```bash
doccov init [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `auto` | Config format: `auto`, `mjs`, `js`, `cjs` |
| `--cwd <dir>` | `.` | Working directory |

## Examples

### Auto-detect Format

```bash
doccov init
```

Creates `doccov.config.ts` (or `.js` based on project type).

### Specific Format

```bash
# ES Module
doccov init --format mjs

# CommonJS
doccov init --format cjs
```

## Generated Config

### TypeScript (default)

`doccov.config.ts`:

```typescript
import { defineConfig } from '@doccov/cli/config';

export default defineConfig({
  // Filter which exports to include
  // include: ['createUser', 'updateUser'],
  
  // Exclude specific exports
  // exclude: ['_internal*', 'debug*'],
});
```

### ES Module

`doccov.config.mjs`:

```javascript
import { defineConfig } from '@doccov/cli/config';

export default defineConfig({
  // include: [],
  // exclude: [],
});
```

### CommonJS

`doccov.config.cjs`:

```javascript
const { defineConfig } = require('@doccov/cli/config');

module.exports = defineConfig({
  // include: [],
  // exclude: [],
});
```

## Config Options

See [Configuration](../configuration.md) for all options.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Config created |
| 1 | Config already exists or error |

## Local Testing

```bash
bun run packages/cli/src/cli.ts init --cwd /tmp/test-project
```

## See Also

- [Configuration](../configuration.md) - Full config reference
- [generate](./generate.md) - Uses config for filtering
- [check](./check.md) - Uses config for filtering

