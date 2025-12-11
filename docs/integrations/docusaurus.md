# Docusaurus Integration

Generate API documentation pages from OpenPkg specs.

## Installation

```bash
npm install docusaurus-plugin-doccov
```

## Setup

Add to `docusaurus.config.js`:

```javascript
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-doccov',
      {
        specPath: './openpkg.json',
        routeBasePath: '/api',
        showCoverage: true,
        coverageThreshold: 80,
      },
    ],
  ],
};
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `specPath` | `string` | `'./openpkg.json'` | Path to OpenPkg spec |
| `routeBasePath` | `string` | `'/api'` | Base URL for API docs |
| `showCoverage` | `boolean` | `true` | Show coverage badges |
| `coverageThreshold` | `number` | `80` | Threshold for green badge |

## Generated Pages

### Index Page

At `/{routeBasePath}`:

- Lists all exports
- Shows coverage stats per export
- Groups by kind (functions, classes, etc.)

### Export Pages

At `/{routeBasePath}/{exportId}`:

- Full documentation for each export
- Signatures with parameters
- Return types
- Examples
- Coverage status

## Workflow

### 1. Generate Spec

```bash
doccov spec -o openpkg.json
```

### 2. Configure Plugin

```javascript
// docusaurus.config.js
module.exports = {
  plugins: [
    ['docusaurus-plugin-doccov', { specPath: './openpkg.json' }],
  ],
};
```

### 3. Build Docs

```bash
npm run build
```

### 4. Commit Spec

```bash
git add openpkg.json
git commit -m "Update API spec"
```

## Theme Components

The plugin provides theme components you can swizzle:

### DocCovIndexPage

The API index page.

```bash
npm run swizzle docusaurus-plugin-doccov DocCovIndexPage
```

### DocCovExportPage

Individual export pages.

```bash
npm run swizzle docusaurus-plugin-doccov DocCovExportPage
```

## Customization

### Custom Index

```jsx
// src/theme/DocCovIndexPage/index.tsx
import React from 'react';
import { usePluginData } from '@docusaurus/useGlobalData';

export default function CustomIndexPage() {
  const { spec } = usePluginData('docusaurus-plugin-doccov');
  
  return (
    <div>
      <h1>API Reference</h1>
      <p>Coverage: {spec.docs?.coverageScore}%</p>
      {/* Custom rendering */}
    </div>
  );
}
```

### Styling

Override CSS:

```css
/* src/css/custom.css */
.doccov-coverage-badge {
  /* custom badge styles */
}

.doccov-export-card {
  /* custom card styles */
}
```

## CI/CD Integration

Regenerate spec before building:

```yaml
- name: Generate spec
  run: npx @doccov/cli spec -o openpkg.json

- name: Build docs
  run: npm run build
```

## Multiple Packages

For monorepos, generate multiple specs:

```javascript
module.exports = {
  plugins: [
    ['docusaurus-plugin-doccov', {
      specPath: './packages/core/openpkg.json',
      routeBasePath: '/api/core',
    }],
    ['docusaurus-plugin-doccov', {
      specPath: './packages/react/openpkg.json',
      routeBasePath: '/api/react',
    }],
  ],
};
```

## Example

Full `docusaurus.config.js`:

```javascript
module.exports = {
  title: 'My Library',
  url: 'https://mylib.dev',
  baseUrl: '/',
  
  presets: [
    ['@docusaurus/preset-classic', {
      docs: {
        sidebarPath: require.resolve('./sidebars.js'),
      },
    }],
  ],
  
  plugins: [
    ['docusaurus-plugin-doccov', {
      specPath: './openpkg.json',
      routeBasePath: '/api',
      showCoverage: true,
      coverageThreshold: 80,
    }],
  ],
};
```

## See Also

- [spec Command](../cli/commands/spec.md) - Create spec
- [Spec Overview](../spec/overview.md) - OpenPkg format
- [Badges & Widgets](./badges-widgets.md) - Embed coverage

