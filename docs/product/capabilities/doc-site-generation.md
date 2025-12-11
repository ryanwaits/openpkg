# API Reference Site Generation

> Last updated: 2024-12-08

DocCov provides a complete solution for rendering API reference documentation via the Fumadocs adapter and UI component library.

---

## Overview

DocCov isn't just about quality enforcement - it also generates beautiful, interactive API reference documentation. The Fumadocs adapter (`@doccov/fumadocs-adapter`) provides React components that render OpenPkg specs as polished documentation pages.

**Key differentiator**: Unlike TypeDoc or api-documenter, DocCov embeds quality signals (coverage badges, drift indicators) directly into the rendered documentation.

---

## Packages

| Package | Purpose |
|---------|---------|
| `@doccov/fumadocs-adapter` | React components for Fumadocs integration |
| `@doccov/ui` | Shared UI component library (50+ components) |

---

## Fumadocs Adapter

### Server-Side Setup

```typescript
// lib/openpkg.ts
import { createOpenPkg } from '@doccov/fumadocs-adapter/server';

// Load from JSON file
export const openpkg = createOpenPkg('./openpkg.json');

// Or from spec object
export const openpkg = createOpenPkg(specObject);
```

### API

```typescript
interface OpenPkgInstance {
  // Query single items
  getExport(id: string): SpecExport | undefined;
  getType(id: string): SpecType | undefined;

  // Filter by kind
  getExportsByKind(kind: SpecExportKind): SpecExport[];

  // Get all
  getAllExports(): SpecExport[];
  getAllTypes(): SpecType[];
}
```

### Page Components

#### APIPage
Main entry point - dispatches to the appropriate page component based on export kind.

```tsx
import { APIPage } from '@doccov/fumadocs-adapter';

export default function Page({ params }) {
  const exp = openpkg.getExport(params.slug);
  if (!exp) return <NotFound />;
  return <APIPage export={exp} />;
}
```

#### FunctionPage
Renders function documentation with:
- Full signature with generics
- Two-column layout: parameters left, examples right
- Return type documentation
- Coverage badge

#### ClassPage
Renders class documentation with:
- Class declaration with extends/implements
- Constructor section
- Collapsible methods (accordion UI)
- Properties section
- Visibility modifiers (public/private/protected)
- Static/readonly/abstract flags
- Sticky examples pane

#### InterfacePage
Renders interface/type documentation with:
- Type signature
- Extends clause
- Properties in TypeTable format
- Method signatures

#### EnumPage
Renders enum documentation with:
- Enum signature
- Members table (name, value, description)
- Examples

#### VariablePage
Renders const/variable documentation with:
- Type definition
- Description
- Usage examples

---

## Shared Components

### Signature
Renders TypeScript signatures with full syntax highlighting.

```tsx
<Signature
  signature={exp.signatures[0]}
  typeParams={exp.typeParameters}
  deprecated={exp.deprecated}
/>
```

Features:
- Generic type parameters with constraints/defaults
- CodeHike syntax highlighting
- Deprecated flag display

### TypeTable
Tabular display for parameters and properties.

```tsx
<TypeTable params={signature.params} />
```

Features:
- Name, Type, Description columns
- Required (*) vs optional (?) indicators
- Compact schema formatting

### ParameterCard
Card-based parameter documentation for visual emphasis.

```tsx
<ParameterCard param={param} />
```

### CodeExample
Renders code examples with syntax highlighting.

```tsx
<CodeExample example={example} />
```

Features:
- Cleans markdown fences
- CodeHike integration
- Copy button
- Line numbers

### ExamplesSection
Tabbed interface for multiple examples.

```tsx
<ExamplesSection examples={exp.examples} />
```

### CoverageBadge
Visual coverage score with quality signals.

```tsx
<CoverageBadge docs={exp.docs} />
```

Features:
- 0-100% score display
- Color-coded: green (80+), yellow (60+), red (<60)
- Lists missing documentation signals
- Shows drift issues with suggestions
- Expandable details

### CollapsibleMethod
Accordion UI for method documentation.

```tsx
<CollapsibleMethod method={method} className={className} />
```

Features:
- Compact signature when collapsed
- Full parameter details when expanded
- URL hash linking (#methodName)
- Visibility/static/async/abstract flags

### MembersSection
Groups class members by kind.

```tsx
<MembersSection members={exp.members} className={exp.name} />
```

---

## UI Component Library (@doccov/ui)

The `@doccov/ui` package provides 50+ components used by the Fumadocs adapter and available for custom implementations.

### DocsKit Components (31 files)

**Code Rendering:**
- `DocsKitCode` - Server-side syntax highlighting
- `ClientDocsKitCode` - Client-side rendering
- `MultiCode` - Tabbed code blocks
- `Terminal` - Terminal/shell styling
- `PackageInstall` - npm/yarn install snippets
- `InlineCode` - Inline syntax highlighting

**Interactive:**
- `Collapse` - Collapsible sections
- `Expandable` - Toggle content
- `Tabs` - Tabbed interface
- `Hover` - Hover-triggered content
- `Tooltip` - Tooltips

**Documentation:**
- `Callout` - Info/warning/error boxes
- `Notes` - Footnotes/side notes
- `Diff` - Side-by-side diffs
- `Link` - Styled links

### Basic Components

- `Button` - Multiple variants (primary, secondary, ghost, nav, danger)
- `Badge` - Status/tag display
- `Input` - Form inputs
- `Breadcrumb` - Navigation
- `Collapsible` - Accordion primitive

---

## Styling

### Theme Integration
CSS variables mapped to Fumadocs color system:
- Light and dark mode support
- GitHub-style syntax highlighting
- Tailwind utility classes

### CodeHike Integration
26 color tokens for syntax highlighting:
- Comments, keywords, strings, numbers
- Function names, class names, types
- Operators, punctuation, brackets

**Source**: `packages/fumadocs-adapter/src/docskit.css`

---

## Example Integration

### 1. Install Packages

```bash
npm install @doccov/fumadocs-adapter @doccov/ui
```

### 2. Generate Spec

```bash
doccov spec -o openpkg.json
```

### 3. Create OpenPkg Instance

```typescript
// lib/openpkg.ts
import { createOpenPkg } from '@doccov/fumadocs-adapter/server';
export const openpkg = createOpenPkg('./openpkg.json');
```

### 4. Create API Routes

```tsx
// app/api/reference/[slug]/page.tsx
import { APIPage } from '@doccov/fumadocs-adapter';
import { openpkg } from '@/lib/openpkg';
import { notFound } from 'next/navigation';

export default function Page({ params }: { params: { slug: string } }) {
  const exp = openpkg.getExport(params.slug);
  if (!exp) notFound();
  return <APIPage export={exp} />;
}

export function generateStaticParams() {
  return openpkg.getAllExports().map(exp => ({ slug: exp.id }));
}
```

### 5. Add Navigation

```tsx
// Generate sidebar from exports
const apiNav = openpkg.getAllExports().map(exp => ({
  title: exp.name,
  href: `/api/reference/${exp.id}`,
}));
```

---

## Comparison with Alternatives

| Feature | DocCov | TypeDoc | api-documenter |
|---------|:------:|:-------:|:--------------:|
| Framework integration | Fumadocs | Standalone | Standalone |
| React components | Yes | No | No |
| Coverage badges | Yes | No | No |
| Drift indicators | Yes | No | No |
| Collapsible methods | Yes | No | No |
| Two-column layouts | Yes | No | No |
| CodeHike highlighting | Yes | No | No |
| Customizable | Highly | Moderate | Limited |

---

## Status

**Production-ready** for:
- Function documentation
- Class documentation
- Interface/type documentation
- Enum documentation
- Variable documentation

**In progress**:
- Namespace pages
- Module pages
- Additional interactive features

---

## Source Files

**Fumadocs Adapter:**
- `packages/fumadocs-adapter/src/server.ts` - Server utilities
- `packages/fumadocs-adapter/src/components/` - All page components
- `packages/fumadocs-adapter/src/docskit.css` - Styling

**UI Library:**
- `packages/ui/src/components/docskit/` - 31 DocsKit components
- `packages/ui/src/components/` - Basic UI components
