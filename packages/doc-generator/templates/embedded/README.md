# Embedded API Docs Template

This template shows how to integrate generated MDX files into existing documentation sites.

## Usage

Generate MDX files for your API:

```bash
npx openpkg-docs generate ./openpkg.json --format mdx --out ./docs/api --nav fumadocs
```

## Fumadocs Integration

1. Copy generated files to `content/docs/api/`
2. Use the generated `meta.json` for navigation
3. Import and use components in your MDX

```tsx
// Example: content/docs/api/functions/use-state.mdx
---
title: useState
description: React state hook
---

# useState

\`function useState<T>(initial: T): [T, (value: T) => void]\`

...
```

## Docusaurus Integration

1. Copy generated files to `docs/api/`
2. Use generated `sidebars.js` for navigation

```js
// sidebars.js
const apiSidebar = require('./docs/api/sidebars.js');

module.exports = {
  docs: [
    // ... your existing sidebar
    {
      type: 'category',
      label: 'API Reference',
      items: apiSidebar,
    },
  ],
};
```

## File Structure

After generation:

```
docs/api/
├── meta.json          # Fumadocs navigation
├── sidebars.js        # Docusaurus navigation
├── functions/
│   ├── use-state.mdx
│   └── use-effect.mdx
├── classes/
│   └── store.mdx
├── interfaces/
│   └── options.mdx
└── types/
    └── config.mdx
```

## Customization

Override frontmatter in generated files or use the JSON output for custom rendering:

```bash
npx openpkg-docs generate ./openpkg.json --format json --out ./api.json
```

Then build your own components using the JSON data.
