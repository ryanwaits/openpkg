# Examples

Run examples from the `packages/doc-generator` directory:

```bash
# Core API - loading specs, querying exports
bun examples/01-core-api.ts

# Markdown rendering
bun examples/02-render-markdown.ts

# Navigation generation (Fumadocs, Docusaurus)
bun examples/03-navigation.ts

# Search index generation (Pagefind, Algolia)
bun examples/04-search-index.ts

# Query utilities (formatting, filtering)
bun examples/05-query-utils.ts

# JSON output
bun examples/06-json-output.ts
```

## Sample Spec

The examples use `sample-spec.json` which contains:

- **Functions**: `greet`, `deprecatedFn`
- **Interfaces**: `GreetOptions`
- **Classes**: `Logger`
- **Enums**: `LogLevel`
- **Variables**: `VERSION`

## Quick Start

```typescript
import { createDocs } from '@openpkg-ts/doc-generator';

// Load from file or object
const docs = createDocs('./openpkg.json');
// or: createDocs(specObject)

// Query
docs.getExport('myFunction');
docs.getExportsByKind('function');
docs.search('config');
docs.getDeprecated();

// Render
docs.toMarkdown();
docs.toMarkdown({ export: 'myFunction' });
docs.toNavigation({ format: 'fumadocs' });
docs.toSearchIndex();
```

## React Components

```tsx
import { FunctionPage, ClassPage } from '@openpkg-ts/doc-generator/react/styled';

// Styled components (ready to use)
<FunctionPage export={fn} spec={spec} />

// Headless components (composable)
import { Signature, ParamTable } from '@openpkg-ts/doc-generator/react';
<Signature signature={sig} />
<ParamTable params={params} />
```
