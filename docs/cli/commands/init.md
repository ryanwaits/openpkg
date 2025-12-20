# doccov init

Create a DocCov configuration file.

## Usage

```bash
doccov init [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `auto` | Config format: `auto`, `mjs`, `js`, `cjs`, `yaml` |
| `--cwd <dir>` | `.` | Working directory |

## Examples

### Auto-detect Format

```bash
doccov init
```

Creates `doccov.config.mjs` (or `.js` based on project type).

### YAML Format (Recommended)

```bash
doccov init --format yaml
```

Creates `doccov.yml` - simpler syntax, no imports needed.

### Specific JS Format

```bash
# ES Module
doccov init --format mjs

# CommonJS
doccov init --format cjs
```

## Generated Config

### YAML

`doccov.yml`:

```yaml
# include:
#   - "MyClass"
#   - "myFunction"
# exclude:
#   - "internal*"

check:
  # minCoverage: 80
  # maxDrift: 20
  # examples: typecheck

quality:
  rules:
    # has-description: warn
    # has-params: off
```

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

