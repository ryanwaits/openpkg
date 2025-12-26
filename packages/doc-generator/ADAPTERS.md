# Creating Framework Adapters

Guide for creating adapters that integrate `@openpkg-ts/doc-generator` with doc frameworks.

## Architecture

```
@openpkg-ts/doc-generator (core)
├── Components (headless + styled)
├── Renderers (markdown, html, json)
├── Query utilities
└── Adapter types

@openpkg-ts/fumadocs-adapter (thin wrapper)
├── Re-exports from doc-generator
├── CoverageBadge (doccov-specific)
└── Fumadocs CSS overrides

@your-org/mintlify-adapter (example)
├── Re-exports from doc-generator
├── Mintlify-specific components
└── Mintlify config helpers
```

## Adapter Interface

```typescript
import type { DocFrameworkAdapter } from '@openpkg-ts/doc-generator';

const myAdapter: DocFrameworkAdapter = {
  name: 'my-framework',
  displayName: 'My Framework',
  version: '^2.0.0',

  generate: {
    pages(spec, options) { /* ... */ },
    navigation(spec, options) { /* ... */ },
    searchIndex(spec, options) { /* ... */ },
  },

  components: {
    APIPage,
    FunctionPage,
    ClassPage,
    InterfacePage,
    EnumPage,
    VariablePage,
  },

  config: {
    generateConfig(options) { /* ... */ },
    validateConfig(configPath) { /* ... */ },
  },
};
```

## Minimal Adapter

Most adapters can simply re-export from doc-generator:

```typescript
// src/index.ts
export * from '@openpkg-ts/doc-generator';
export * from '@openpkg-ts/doc-generator/react/styled';

// Framework-specific additions
export { MySpecialComponent } from './components/special';
```

## Framework-Specific Notes

### Fumadocs

Current implementation. Uses:
- Tailwind v4 styling
- fumadocs-ui primitives
- `docskit.css` for overrides

Structure:
```
fumadocs-adapter/
├── src/
│   ├── index.ts           # Re-exports + CoverageBadge
│   ├── components/
│   │   ├── index.ts       # All component exports
│   │   └── coverage-badge.tsx
│   └── styles/
│       └── docskit.css    # Fumadocs-specific CSS
└── package.json
```

### Mintlify (future)

Would need:
- MDX file generation with Mintlify frontmatter
- `mint.json` navigation generation
- Mintlify component wrappers (Accordion, Card, etc.)

Structure:
```
mintlify-adapter/
├── src/
│   ├── index.ts
│   ├── generate/
│   │   ├── pages.ts       # MDX with Mintlify frontmatter
│   │   └── mint-json.ts   # Navigation config
│   └── components/
│       └── wrappers.tsx   # Map to Mintlify components
└── package.json
```

### Docusaurus (future)

Would need:
- MDX file generation with Docusaurus frontmatter
- `sidebars.js` generation
- Docusaurus theme components

Structure:
```
docusaurus-adapter/
├── src/
│   ├── index.ts
│   ├── generate/
│   │   ├── pages.ts       # MDX with Docusaurus frontmatter
│   │   └── sidebars.ts    # Sidebar config
│   └── theme/
│       └── components.tsx # Themed versions
└── package.json
```

### Nextra (future)

Would need:
- MDX file generation
- `_meta.json` files for navigation
- Nextra theme components

Structure:
```
nextra-adapter/
├── src/
│   ├── index.ts
│   ├── generate/
│   │   ├── pages.ts
│   │   └── meta.ts        # _meta.json generation
│   └── components/
└── package.json
```

## Implementation Checklist

- [ ] Re-export core from `@openpkg-ts/doc-generator`
- [ ] Re-export components from `@openpkg-ts/doc-generator/react/styled`
- [ ] Add framework-specific file generators
- [ ] Add framework-specific CSS/styling
- [ ] Add config helpers if needed
- [ ] Test with real projects
- [ ] Document usage

## Using the Adapter Registry

```typescript
import { adapterRegistry } from '@openpkg-ts/doc-generator';
import { myAdapter } from './my-adapter';

// Register
adapterRegistry.register(myAdapter);

// Use
const adapter = adapterRegistry.get('my-framework');
if (adapter) {
  const files = adapter.generate.pages(spec);
}
```
