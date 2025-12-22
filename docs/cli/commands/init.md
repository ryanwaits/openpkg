# doccov init

Create a DocCov configuration file.

## Usage

```bash
doccov init [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Working directory |
| `--format <fmt>` | Config format: `auto`, `mjs`, `js`, `cjs`, `yaml` |

## Examples

### Auto-detect format

```bash
doccov init
# Creates doccov.yml or doccov.config.js based on package.json type
```

### Force YAML

```bash
doccov init --format yaml
# Creates doccov.yml
```

### Force ESM

```bash
doccov init --format mjs
# Creates doccov.config.mjs
```

## Generated Files

### YAML (doccov.yml)

```yaml
# DocCov Configuration
# https://doccov.dev/docs/cli/configuration

# include:
#   - "MyClass"
#   - "use*"

# exclude:
#   - "*Internal"

check:
  # minCoverage: 80
  # maxDrift: 10
  # examples: presence

quality:
  rules:
    has-description: error
    # has-params: warn
    # has-examples: off
```

### ESM JS (doccov.config.js)

```javascript
// @ts-check
import { defineConfig } from '@doccov/cli';

export default defineConfig({
  // include: ['MyClass', 'use*'],
  // exclude: ['*Internal'],

  check: {
    // minCoverage: 80,
    // maxDrift: 10,
    // examples: 'presence',
  },

  quality: {
    rules: {
      'has-description': 'error',
      // 'has-params': 'warn',
    },
  },
});
```

### CommonJS (doccov.config.cjs)

```javascript
// @ts-check
const { defineConfig } = require('@doccov/cli');

module.exports = defineConfig({
  // ...same structure
});
```

## Format Detection

When `--format auto` (default):
1. Reads `package.json` → `type` field
2. If `"type": "module"` → generates `.js` (ESM)
3. If `"type": "commonjs"` or missing → generates `.mjs`

## Existing Config

If config already exists, command exits with message:
```
Config already exists at: /path/to/doccov.yml
```
