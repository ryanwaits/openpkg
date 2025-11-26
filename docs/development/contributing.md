# Contributing

Guidelines for contributing to DocCov.

## Repository Structure

```
doccov/
├── packages/
│   ├── api/          # Hono API for Vercel
│   ├── cli/          # Command-line interface
│   ├── sdk/          # Core analysis library
│   ├── spec/         # OpenPkg schema & types
│   └── docusaurus-plugin/  # Docusaurus integration
├── tests/
│   └── fixtures/     # Test fixtures
├── action/           # GitHub Action
└── docs/             # Documentation
```

## Prerequisites

- [Bun](https://bun.sh) 1.0+
- Node.js 22+ (for `--run-examples`)
- Git

## Setup

```bash
# Clone
git clone https://github.com/doccov/doccov
cd doccov

# Install dependencies
bun install

# Build all packages
bun run build
```

## Development Workflow

### 1. Create Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Edit code in the relevant package.

### 3. Run Tests

```bash
# All tests
bun test

# Specific package
bun test packages/sdk/test/
bun test packages/cli/test/
bun test packages/spec/test/
```

### 4. Lint

```bash
bun run lint
```

### 5. Build

```bash
bun run build
```

### 6. Commit

```bash
git add .
git commit -m "feat: add feature description"
```

### 7. Push & PR

```bash
git push origin feature/my-feature
```

Open a pull request on GitHub.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new drift detector
fix: handle circular dependencies
docs: update CLI reference
test: add coverage tests
refactor: simplify type resolution
chore: update dependencies
```

## Testing

### Run All Tests

```bash
bun test
```

### Watch Mode

```bash
bun test --watch
```

### Coverage

```bash
bun test --coverage
```

### Test Fixtures

Add fixtures to `tests/fixtures/`:

```
tests/fixtures/
├── my-feature/
│   ├── index.ts        # Entry file
│   └── expected.json   # Expected output (optional)
```

## Package Development

### CLI

```bash
# Run CLI from source
bun run packages/cli/src/cli.ts check tests/fixtures/simple-math.ts

# Build
cd packages/cli && bun run build
```

### SDK

```bash
# Run tests
bun test packages/sdk/test/

# Quick test
bun run -e "
  import { DocCov } from './packages/sdk/src';
  const dc = new DocCov();
  const r = await dc.analyzeFileWithDiagnostics('tests/fixtures/simple-math.ts');
  console.log(r.spec.docs);
"
```

### API

```bash
# Local dev
cd packages/api && bun run dev

# Vercel simulation
cd packages/api && vercel dev
```

### Spec

```bash
# Run tests
bun test packages/spec/test/
```

## Code Style

- TypeScript with strict mode
- Biome for formatting/linting
- No explicit `any` types
- JSDoc on public APIs

### Biome Config

See `biome.json` in project root.

### Format

```bash
bun run format
```

## Adding a Feature

### 1. Spec Changes

If adding to OpenPkg schema:

1. Update `packages/spec/src/types.ts`
2. Update JSON schema in `packages/spec/schemas/`
3. Add tests in `packages/spec/test/`

### 2. SDK Changes

If adding analysis features:

1. Add to relevant file in `packages/sdk/src/`
2. Export from `packages/sdk/src/index.ts`
3. Add tests in `packages/sdk/test/`

### 3. CLI Changes

If adding commands/options:

1. Modify `packages/cli/src/commands/`
2. Update `packages/cli/src/cli.ts` if new command
3. Add tests in `packages/cli/test/`

### 4. API Changes

If adding endpoints:

1. Add route in `packages/api/src/routes/`
2. Register in `packages/api/src/index.ts`
3. Add Vercel function if needed

### 5. Documentation

1. Update relevant docs in `docs/`
2. Update README if needed

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Documentation updated

### PR Description

Include:
- What changed
- Why it changed
- How to test
- Breaking changes (if any)

### Review Process

1. Automated checks run
2. Maintainer reviews code
3. Address feedback
4. Squash and merge

## Release Process

Maintainers only:

```bash
# Update versions
bun run version:patch  # or :minor, :major

# Publish
bun run publish

# Push tags
git push --tags
```

## Getting Help

- Open an issue for bugs
- Discussions for questions
- Discord for chat (if available)

## Code of Conduct

Be respectful and constructive. See CODE_OF_CONDUCT.md.

## License

Contributions are licensed under MIT.

## See Also

- [Local Testing](./local-testing.md) - Development setup
- [Vercel Deployment](./vercel-deployment.md) - API deployment

