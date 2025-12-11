# Installation

## CLI (Recommended)

Install globally for command-line access:

```bash
# npm
npm install -g @doccov/cli

# pnpm
pnpm add -g @doccov/cli

# bun
bun add -g @doccov/cli
```

Verify installation:

```bash
doccov --version
```

## SDK

Install as a project dependency for programmatic usage:

```bash
# npm
npm install @doccov/sdk

# pnpm
pnpm add @doccov/sdk

# bun
bun add @doccov/sdk
```

## Spec Utilities

For schema validation, normalization, and diffing:

```bash
# npm
npm install @openpkg-ts/spec

# pnpm
pnpm add @openpkg-ts/spec

# bun
bun add @openpkg-ts/spec
```

## Project-Local CLI

For CI/CD, install CLI as a dev dependency:

```bash
npm install -D @doccov/cli
```

Then run via npx or package.json scripts:

```bash
npx doccov check --min-coverage 80
```

Or in `package.json`:

```json
{
  "scripts": {
    "docs:check": "doccov check --min-coverage 80",
    "docs:spec": "doccov spec -o openpkg.json"
  }
}
```

## Requirements

- Node.js 18+ (Node 22+ for `--examples run`)
- TypeScript project with valid `tsconfig.json`

## See Also

- [Quick Start](./quick-start.md) - Generate your first spec
- [CLI Overview](../cli/overview.md) - Available commands
