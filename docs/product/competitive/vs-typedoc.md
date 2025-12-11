# DocCov vs TypeDoc

> Last updated: 2024-12-08

A comparison between DocCov and TypeDoc.

---

## Executive Summary

| Tool | Primary Mission |
|------|-----------------|
| **TypeDoc** | "Generate standalone API reference websites from TypeScript" |
| **DocCov** | "Ensure documentation is accurate, complete, and render beautiful API references" |

DocCov now offers **both** documentation quality enforcement **and** API reference site generation via the Fumadocs adapter. This positions DocCov as a potential TypeDoc replacement, not just a complement.

---

## Quick Comparison

| Capability | DocCov | TypeDoc |
|------------|:------:|:-------:|
| API reference site generation | Yes (Fumadocs adapter) | Yes (standalone) |
| Coverage scoring | Yes | No |
| Drift detection | Yes (14 types) | No |
| Auto-fix | Yes | No |
| Example validation | Yes | No |
| Breaking change detection | Yes | No |
| Interactive code examples | Yes (CodeHike) | Partial |
| Coverage badges in docs | Yes | No |
| Drift indicators in docs | Yes | No |
| Framework integration | Yes (Fumadocs) | Standalone only |
| React component library | Yes (@doccov/ui) | No |

---

## Doc Site Generation: Head to Head

### TypeDoc Approach
- **Standalone site**: Generates a complete static site
- **Own theme system**: TypeDoc-specific themes
- **Plugin ecosystem**: Extend via plugins
- **Separate from main docs**: Usually a separate `/api` site

### DocCov Approach
- **Framework integration**: Embeds into your existing Fumadocs site
- **React components**: Use `@doccov/fumadocs-adapter` components
- **Quality signals built-in**: Coverage badges, drift indicators on every page
- **Unified docs**: API reference lives alongside guides and tutorials
- **Modern stack**: CodeHike syntax highlighting, Radix UI primitives

---

## What DocCov Provides for Doc Sites

### Page Components

| Component | Description |
|-----------|-------------|
| `APIPage` | Route dispatcher for all export types |
| `FunctionPage` | Function docs with params, returns, examples |
| `ClassPage` | Class docs with methods, properties, constructor |
| `InterfacePage` | Interface/type docs with members |
| `EnumPage` | Enum docs with member values |
| `VariablePage` | Const/variable documentation |

### Shared Components

| Component | Description |
|-----------|-------------|
| `Signature` | TypeScript signature with generics |
| `TypeTable` | Parameter/property tables |
| `ParameterCard` | Visual parameter documentation |
| `CodeExample` | Syntax-highlighted examples |
| `CoverageBadge` | Coverage score with missing signals |
| `CollapsibleMethod` | Accordion UI for methods |

### Features TypeDoc Doesn't Have

1. **Coverage badges on every page** - See at a glance what's missing
2. **Drift indicators** - Know when docs don't match code
3. **Collapsible method sections** - Better UX for large classes
4. **Two-column layouts** - Examples alongside parameters
5. **Interactive code** - CodeHike-powered syntax highlighting
6. **Deep framework integration** - Lives in your existing Fumadocs site

---

## Why DocCov's Approach is Better

### 1. Unified Documentation
TypeDoc creates a separate API site. DocCov embeds API reference into your existing documentation, so users don't context-switch.

### 2. Quality Signals Everywhere
Every DocCov page shows coverage and drift. Users (and maintainers) can see documentation health at a glance.

### 3. Modern React Architecture
DocCov uses React 19, Radix UI, and Tailwind. TypeDoc uses its own rendering system that's harder to customize.

### 4. Framework-First
DocCov integrates with Fumadocs (and potentially other frameworks). TypeDoc is standalone-only.

### 5. Consistency with Quality Enforcement
The same tool that enforces quality also renders the docs. No disconnect between what's validated and what's displayed.

---

## What TypeDoc Still Does Better

### 1. Zero-Config Standalone Site
```bash
npx typedoc src/index.ts  # Done
```

TypeDoc is faster to get started if you just need a standalone API site.

### 2. Plugin Ecosystem
TypeDoc has years of plugins for various customizations.

### 3. Non-React Projects
If you're not using React/Fumadocs, TypeDoc is still the simpler choice.

---

## Migration Path: TypeDoc to DocCov

### Step 1: Generate OpenPkg Spec
```bash
doccov spec -o openpkg.json
```

### Step 2: Install Fumadocs Adapter
```bash
npm install @doccov/fumadocs-adapter
```

### Step 3: Add to Fumadocs Config
```typescript
// fumadocs.config.ts
import { createOpenPkg } from '@doccov/fumadocs-adapter/server';

export const openpkg = createOpenPkg('./openpkg.json');
```

### Step 4: Create API Routes
```tsx
// app/api/[slug]/page.tsx
import { APIPage } from '@doccov/fumadocs-adapter';
import { openpkg } from '@/fumadocs.config';

export default function Page({ params }) {
  const exp = openpkg.getExport(params.slug);
  return <APIPage export={exp} />;
}
```

---

## When to Use Each

### Use DocCov When
- You want quality enforcement + site generation in one tool
- You're using Fumadocs for documentation
- You want coverage/drift indicators in your API docs
- You want modern React components
- You want unified docs (guides + API reference)

### Use TypeDoc When
- You need a quick standalone API site
- You're not using React/Fumadocs
- You need specific TypeDoc plugins
- You don't need quality enforcement

### Migrate from TypeDoc to DocCov When
- You're adopting Fumadocs
- You want to add coverage tracking
- You want drift detection in CI
- You want a more modern, customizable doc system

---

## Feature Comparison Detail

| Feature | DocCov | TypeDoc |
|---------|:------:|:-------:|
| **Rendering** | | |
| Function pages | Yes | Yes |
| Class pages | Yes | Yes |
| Interface pages | Yes | Yes |
| Enum pages | Yes | Yes |
| Namespace pages | Partial | Yes |
| Module pages | Partial | Yes |
| **UI/UX** | | |
| Syntax highlighting | CodeHike | Shiki |
| Collapsible sections | Yes | No |
| Two-column layout | Yes | No |
| Copy buttons | Yes | Yes |
| Search | Via Fumadocs | Built-in |
| Dark mode | Yes | Yes |
| Mobile responsive | Yes | Yes |
| **Quality Signals** | | |
| Coverage badges | Yes | No |
| Drift indicators | Yes | No |
| Missing docs warnings | Yes | No |
| **Integration** | | |
| Standalone site | No | Yes |
| Framework integration | Fumadocs | No |
| React components | Yes | No |
| Customizable | Highly | Moderate |

---

## Summary

DocCov is no longer just a quality enforcement tool - it's a **full documentation platform** that can replace TypeDoc for teams using Fumadocs. The key differentiator: DocCov shows documentation health (coverage, drift) directly in the rendered docs, creating a feedback loop that keeps documentation accurate.

For new projects using Fumadocs, DocCov is the recommended choice. For existing TypeDoc users, migration is straightforward and unlocks quality enforcement features TypeDoc can't match.
