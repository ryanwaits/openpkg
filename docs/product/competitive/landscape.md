# Competitive Landscape

> Last updated: 2024-12-08

Overview of tools in the TypeScript documentation and API governance space.

---

## Market Overview

The TypeScript library tooling market includes several categories:

1. **Documentation Generators** - Create doc sites from code
2. **API Governance** - Prevent breaking changes, enforce contracts
3. **Documentation Quality** - Measure and enforce doc completeness (DocCov's category)
4. **Declaration Bundlers** - Generate `.d.ts` rollups

---

## Key Players

### API Extractor (Microsoft)

| Aspect | Details |
|--------|---------|
| **Category** | API governance, declaration bundling |
| **Primary use** | Prevent accidental API changes |
| **Strengths** | `.d.ts` rollups, Rush Stack integration, release tags |
| **Weaknesses** | No coverage scoring, no drift detection, no example validation |
| **Pricing** | Free (open source) |
| **Adoption** | High in Microsoft ecosystem |

**Key artifacts**: `.api.md` (API review), `.api.json` (doc model), `.d.ts` (rollups)

See: [vs API Extractor](./vs-api-extractor.md)

---

### TypeDoc

| Aspect | Details |
|--------|---------|
| **Category** | Documentation generator |
| **Primary use** | Generate API reference websites |
| **Strengths** | Beautiful output, plugin ecosystem, easy setup |
| **Weaknesses** | No quality enforcement, no drift detection |
| **Pricing** | Free (open source) |
| **Adoption** | Very high, de facto standard |

**Output**: HTML doc sites, JSON output (via plugins)

See: [vs TypeDoc](./vs-typedoc.md)

---

### TSDoc (Microsoft)

| Aspect | Details |
|--------|---------|
| **Category** | Documentation comment standard |
| **Primary use** | Standardize JSDoc syntax for TypeScript |
| **Strengths** | Industry standard, clear spec, parser library |
| **Weaknesses** | Just a standard, not a tool |
| **Pricing** | Free (open standard) |
| **Adoption** | High, used by API Extractor and TypeDoc |

**Note**: TSDoc is a spec, not a product. DocCov parses TSDoc-compliant comments.

See: [vs TSDoc](./vs-tsdoc.md)

---

### ESLint + jsdoc plugin

| Aspect | Details |
|--------|---------|
| **Category** | Linting |
| **Primary use** | Enforce JSDoc presence and format |
| **Strengths** | IDE integration, existing adoption |
| **Weaknesses** | No coverage scoring, no example validation, no drift |
| **Pricing** | Free (open source) |

**Relationship**: Complementary - ESLint for code, DocCov for docs quality

---

### api-documenter (Microsoft)

| Aspect | Details |
|--------|---------|
| **Category** | Documentation generator |
| **Primary use** | Generate docs from API Extractor's `.api.json` |
| **Strengths** | Integrates with API Extractor pipeline |
| **Weaknesses** | Requires API Extractor, limited standalone use |
| **Pricing** | Free (open source) |

**Relationship**: Part of API Extractor toolchain, not a direct competitor

---

## Feature Comparison

See [Feature Matrix](./feature-matrix.md) for detailed comparison.

### Summary Table

| Capability | DocCov | API Extractor | TypeDoc | ESLint/JSDoc |
|------------|:------:|:-------------:|:-------:|:------------:|
| Coverage scoring | Yes | No | No | No |
| Drift detection | Yes (14 types) | No | No | No |
| Example validation | Yes | No | No | No |
| Auto-fix | Yes | No | No | Partial |
| Docs impact | Yes | No | No | No |
| Breaking changes | Yes | Yes | No | No |
| Doc site generation | No | Via api-doc | Yes | No |
| `.d.ts` rollups | No | Yes | No | No |

---

## Positioning Strategy

### Against API Extractor
- "API Extractor catches API changes. DocCov catches doc changes."
- Complementary for teams that need both

### Against TypeDoc
- "TypeDoc generates docs. DocCov validates them."
- Use together: DocCov for quality, TypeDoc for rendering

### Against ESLint
- "ESLint lints code. DocCov lints documentation."
- Different domains, both valuable

### Category Creation
- DocCov creates "Documentation Quality" as a category
- No direct competitor in this space

---

## Market Opportunities

<!-- TODO: Add market sizing -->

1. **Open source libraries** - npm has millions of packages, most lack quality docs
2. **Enterprise SDKs** - Internal platforms need doc standards
3. **DevRel teams** - Need metrics and impact analysis

---

## TODO

- [ ] Add market size estimates
- [ ] Track competitor feature releases
- [ ] Document win/loss reasons
- [ ] Add customer quotes about alternatives
- [ ] Map adoption by company size/type
