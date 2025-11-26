# docusaurus-plugin-doccov

Docusaurus plugin for API documentation from OpenPkg specs.

## Install

```bash
npm install docusaurus-plugin-doccov
```

## Setup

```javascript
// docusaurus.config.js
module.exports = {
  plugins: [
    ['docusaurus-plugin-doccov', {
      specPath: './openpkg.json',
      routeBasePath: '/api',
    }],
  ],
};
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `specPath` | `'./openpkg.json'` | Path to spec |
| `routeBasePath` | `'/api'` | Base URL |
| `showCoverage` | `true` | Show badges |

## Documentation

- [Docusaurus Integration](../../docs/integrations/docusaurus.md)

## License

MIT
