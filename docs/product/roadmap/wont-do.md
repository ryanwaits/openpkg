# Intentional Non-Goals

> Last updated: 2024-12-08

Features we've deliberately decided not to build.

---

## Philosophy

DocCov focuses on **documentation quality** - measuring, validating, and enforcing that docs match code. We intentionally avoid features outside this core mission.

---

## Won't Build

### 1. `.d.ts` Rollup Generation

**What it is**: Bundling TypeScript declarations into a single distributable file.

**Why not**:
- Commodity feature with multiple alternatives
- `dts-bundle-generator`, `rollup-plugin-dts`, `tsup` do this well
- TypeScript may absorb this natively
- Not aligned with documentation quality mission
- Significant complexity for limited value-add

**Alternatives**: Use API Extractor, dts-bundle-generator, or tsup.

---

### ~~2. Documentation Site Generation~~ NOW IMPLEMENTED

**What it is**: Generating API reference documentation websites.

**Status**: **We built this!** DocCov now includes:
- `@openpkg-ts/fumadocs-adapter` - React components for Fumadocs
- `@doccov/ui` - 50+ shared UI components
- Full page components for functions, classes, interfaces, enums, variables
- Coverage badges and drift indicators in rendered docs

**Why we changed our mind**:
- TypeDoc and api-documenter output is messy and unpolished
- We can do this better with quality signals built-in
- Natural extension of our OpenPkg spec

See: [Doc Site Generation Capabilities](../capabilities/doc-site-generation.md)

---

### 3. Rush Stack Integration

**What it is**: Deep integration with Microsoft's Rush monorepo toolchain.

**Why not**:
- Niche ecosystem (Microsoft-centric)
- Would create maintenance burden
- DocCov works with any TypeScript project
- API Extractor already fills this role

**Alternatives**: API Extractor is purpose-built for Rush Stack.

---

### 4. OpenAPI/REST API Support

**What it is**: Validating OpenAPI specs or REST API documentation.

**Why not**:
- Different domain (REST vs TypeScript)
- Spectral already does this well
- Would require entirely different parsing infrastructure
- Outside core competency

**Alternatives**: Use Spectral for OpenAPI linting.

---

### 5. Multi-Language Support

**What it is**: Supporting Python, Go, Rust, etc.

**Why not**:
- Each language has different doc conventions
- Would require separate parsers for each
- TypeScript-specific features (type inference) are core to value prop
- Better to be excellent at one thing

**Alternatives**: Language-specific tools exist for each ecosystem.

---

### 6. Documentation Hosting

**What it is**: Hosting generated documentation sites.

**Why not**:
- Commodity infrastructure
- GitHub Pages, Netlify, Vercel do this well
- Would require significant infrastructure investment
- Not differentiated

**Alternatives**: Deploy to any static hosting.

---

## Might Reconsider

Features we're not building now but might reconsider:

### Release Tag Filtering
- Currently parse release tags but don't filter output
- Might add `--visibility` flag if demand is high
- See [Gaps](./gaps.md)

### IDE Extension
- VS Code extension for real-time drift detection
- Significant investment, might be worth it
- See [Gaps](./gaps.md)

---

## Decision Framework

When evaluating new features, we ask:

1. **Does it improve documentation quality?** If no, probably won't do.
2. **Is there an established alternative?** If yes, consider integration instead.
3. **Does it dilute our focus?** If yes, default to no.
4. **Is it 10x better than alternatives?** If no, probably not worth the investment.

---

## See Also

- [Gaps](./gaps.md) - Features we want to add
- [Opportunities](./opportunities.md) - Future expansion areas
