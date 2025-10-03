# OpenPkg Examples

Quick commands for trying the CLI against the sample fixtures. Each command assumes you are in the repo root and the CLI has been built (`bun run build:cli`).

## Simple Math
```bash
openpkg generate examples/simple-math.ts --output tmp/simple-math.json
```

## Blog API (relative imports)
```bash
openpkg generate examples/blog-api/main.ts --output tmp/blog-api.json
```

## Circular Dependencies
```bash
openpkg generate examples/circular-deps/a.ts --output tmp/circular.json
```

## Deep Imports
```bash
openpkg generate examples/deep-imports/index.ts --output tmp/deep-imports.json
```

## Barrel Exports
```bash
openpkg generate examples/barrel-exports/index.ts --output tmp/barrel.json
```

## Mixed Import Styles
```bash
openpkg generate examples/mixed-imports/calculator.ts --output tmp/mixed.json
```

For more advanced behavior (follow imports, depth limits, etc.), see the CLI documentation in `packages/cli/README.md`.
