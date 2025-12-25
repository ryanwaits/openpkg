# @openpkg-ts/docs

API documentation generator that consumes openpkg specs. The TypeDoc alternative for modern doc frameworks.

## Vision

**Input**: `openpkg.json` (quality-enforced by doccov)
**Output**: Framework-native components OR standalone pages

No more context-switching between API docs and prose docs. Embed API reference directly in your Fumadocs/Mintlify/Docusaurus site with your brand and style.

---

## Core Differentiator

| | TypeDoc | @openpkg-ts/docs |
|--|---------|------------------|
| Input | Raw TypeScript | Quality-enforced spec |
| Output | Standalone HTML | Composable components |
| Integration | Theme system (all-or-nothing) | Framework adapters |
| Brand/Style | TypeDoc themes | Your existing design system |
| Quality | None | Inherited from doccov |

---

## Package Structure

```
packages/docs/
├── src/
│   ├── core/           # Spec parsing, transforms
│   │   ├── parser.ts   # openpkg.json → internal model
│   │   ├── group.ts    # Group by kind, module, tag
│   │   └── search.ts   # Build search index
│   │
│   ├── render/         # Output renderers
│   │   ├── markdown.ts # MDX/MD output
│   │   ├── html.ts     # Standalone HTML
│   │   └── json.ts     # Structured JSON for custom rendering
│   │
│   ├── adapters/       # Framework integrations
│   │   ├── fumadocs/   # (migrate from fumadocs-adapter)
│   │   ├── mintlify/
│   │   ├── docusaurus/
│   │   └── nextra/
│   │
│   ├── components/     # Headless React components
│   │   ├── TypeSignature.tsx
│   │   ├── ParamTable.tsx
│   │   ├── ExportCard.tsx
│   │   ├── ExampleBlock.tsx
│   │   └── SearchDialog.tsx
│   │
│   └── cli/            # CLI for standalone generation
│       └── index.ts
│
├── templates/          # Starter templates
│   ├── standalone/     # Full static site
│   └── embedded/       # Drop-in page for existing site
│
└── package.json
```

---

## API Surface

### Programmatic

```typescript
import { createDocs } from '@openpkg-ts/docs'

const docs = createDocs('./openpkg.json')

// Query
docs.getExport('useState')
docs.getExportsByKind('function')
docs.getExportsByTag('@beta')
docs.search('hook')

// Render
docs.toMarkdown()           // MDX string
docs.toHTML()               // Standalone page
docs.toSearchIndex()        // Algolia/Pagefind compatible
```

### CLI

```bash
# Generate standalone site
npx openpkg-docs build ./openpkg.json --out ./api-docs

# Generate MDX files for existing site
npx openpkg-docs generate ./openpkg.json --format mdx --out ./docs/api

# Dev server with hot reload
npx openpkg-docs dev ./openpkg.json
```

### React Components (Headless)

```tsx
import { ExportCard, TypeSignature, ParamTable } from '@openpkg-ts/docs/react'

// Unstyled, composable
<ExportCard export={fn}>
  <ExportCard.Name />
  <ExportCard.Description />
  <TypeSignature signature={fn.signature} />
  <ParamTable params={fn.parameters} />
  <ExportCard.Examples />
</ExportCard>
```

---

## Framework Adapters

Each adapter provides:
1. **File generator** - Creates pages in framework's expected structure
2. **Components** - Styled for framework's design system
3. **Config helper** - Integrates with framework's config

### Fumadocs (migrate existing)

```typescript
import { defineDocs } from '@openpkg-ts/docs/fumadocs'

export default defineDocs({
  spec: './openpkg.json',
  basePath: '/api',
  // Uses fumadocs styling automatically
})
```

### Mintlify

```typescript
import { defineDocs } from '@openpkg-ts/docs/mintlify'

export default defineDocs({
  spec: './openpkg.json',
  // Generates mint.json navigation entries
  // Creates MDX files matching Mintlify structure
})
```

### Docusaurus

```typescript
import { definePlugin } from '@openpkg-ts/docs/docusaurus'

export default {
  plugins: [
    definePlugin({
      spec: './openpkg.json',
      routeBasePath: 'api',
    })
  ]
}
```

---

## Standalone Site

For libs that just want hosted API docs without a full doc framework:

```bash
npx openpkg-docs init
# Creates:
# - openpkg-docs.config.ts
# - Basic theme config
# - Deploy scripts (Vercel/Netlify)
```

Output: Static site with:
- Search (Pagefind)
- Dark mode
- Mobile responsive
- SEO optimized
- Badge from doccov

---

## Migration Path

### From TypeDoc

```bash
# 1. Generate spec with doccov
npx doccov spec --out openpkg.json

# 2. Generate docs from spec
npx openpkg-docs build ./openpkg.json
```

### From existing fumadocs-adapter

```typescript
// Before (@doccov/fumadocs-adapter)
import { createOpenPkg } from '@doccov/fumadocs-adapter'

// After (@openpkg-ts/docs/fumadocs)
import { createDocs } from '@openpkg-ts/docs/fumadocs'
// Same API, just re-exported
```

---

## Phased Rollout

### v0.1 - Core + Fumadocs
- [ ] Migrate fumadocs-adapter into packages/docs
- [ ] Core parser and query API
- [ ] Markdown renderer
- [ ] Fumadocs adapter (existing functionality)

### v0.2 - Standalone
- [ ] CLI with build/dev commands
- [ ] Standalone HTML renderer
- [ ] Basic theme (clean, minimal)
- [ ] Search integration (Pagefind)

### v0.3 - More Frameworks
- [ ] Docusaurus adapter
- [ ] Mintlify adapter
- [ ] Nextra adapter

### v0.4 - Headless Components
- [ ] React component library
- [ ] Unstyled/headless pattern
- [ ] Composition examples

### v1.0 - Stable
- [ ] API stable
- [ ] All major frameworks supported
- [ ] Migration guides from TypeDoc

---

## Non-Goals

- **TypeScript analysis** - That's doccov's job. We consume openpkg.json.
- **Quality enforcement** - Doccov handles coverage/drift. We trust the spec.
- **Badge generation** - Doccov API serves badges.
- **CI integration** - Doccov GitHub Action handles that.

We are a **rendering layer**. Clean separation.

---

## Naming

| Package | Description |
|---------|-------------|
| `@openpkg-ts/spec` | The spec format + validators |
| `@openpkg-ts/docs` | Doc generation from spec |
| `@doccov/sdk` | Analysis + spec generation |
| `@doccov/cli` | CLI for doccov |

The `@openpkg-ts/*` namespace is for spec consumers.
The `@doccov/*` namespace is for spec producers.
