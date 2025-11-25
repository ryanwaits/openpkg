# docusaurus-plugin-doccov

Docusaurus plugin for generating API documentation from OpenPkg specs.

## Installation

```bash
npm install docusaurus-plugin-doccov
```

## Usage

Add the plugin to your `docusaurus.config.js`:

```js
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
| `specPath` | `string` | `'./openpkg.json'` | Path to the OpenPkg spec file |
| `routeBasePath` | `string` | `'/api'` | Base URL path for API docs |
| `showCoverage` | `boolean` | `true` | Show coverage badges |
| `coverageThreshold` | `number` | `80` | Minimum coverage for green badge |

## Generated Pages

The plugin generates:

- **Index page** at `/{routeBasePath}` - Lists all exports with coverage stats
- **Export pages** at `/{routeBasePath}/{exportId}` - Detailed docs for each export

## Theme Components

The plugin provides two theme components that you can swizzle:

- `DocCovIndexPage` - The API index page
- `DocCovExportPage` - Individual export pages

## Workflow

1. Generate your OpenPkg spec with DocCov CLI:
   ```bash
   doccov generate --output openpkg.json
   ```

2. Add the plugin to your Docusaurus config

3. Build your docs:
   ```bash
   npm run build
   ```

## License

MIT

