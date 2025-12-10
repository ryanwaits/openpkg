# Market Category

> Last updated: 2024-12-08

Where DocCov fits in the ecosystem.

---

## Category Definition

**DocCov creates the "Documentation Quality" category for TypeScript.**

Like how:
- **Codecov** created "Test Coverage as a Service"
- **Snyk** created "Developer-First Security"
- **Dependabot** created "Automated Dependency Updates"

DocCov creates: **"Documentation Coverage & Drift Detection"**

---

## Adjacent Categories

### API Documentation Generators
- **Players**: TypeDoc, api-documenter, Docusaurus
- **What they do**: Generate doc sites from code
- **Relationship**: Complementary - we enforce quality, they render output

### API Governance Tools
- **Players**: API Extractor, Spectral
- **What they do**: Enforce API contracts, prevent breaking changes
- **Relationship**: Overlap on change detection, we focus on docs

### Code Quality / Linting
- **Players**: ESLint, Biome, SonarQube
- **What they do**: Enforce code standards
- **Relationship**: We lint docs, they lint code

### Test Coverage
- **Players**: Codecov, Coveralls, Istanbul
- **What they do**: Measure test coverage
- **Relationship**: We're "Codecov for docs" - same mental model

---

## Market Map

<!-- TODO: Add visual diagram -->

```
                        API Contracts
                             │
                   ┌─────────┴─────────┐
                   │                   │
              Governance            Docs
                   │                   │
          ┌────────┴────────┐    ┌─────┴─────┐
          │                 │    │           │
     API Extractor      Spectral TypeDoc   [DocCov]
     (TypeScript)       (OpenAPI) (Gen)    (Quality)
```

---

## Competitive Landscape

| Category | Leaders | DocCov Position |
|----------|---------|-----------------|
| API governance (TS) | API Extractor | Better at docs quality |
| API governance (API) | Spectral | Different domain (REST vs TS) |
| Doc generation | TypeDoc | Complementary |
| Code linting | ESLint | Different domain (code vs docs) |
| Test coverage | Codecov | Same model, different domain |

---

## Category Messaging

### Headline
"Documentation Coverage for TypeScript"

### Subhead
"Measure, detect, and enforce documentation quality - like Codecov for your docs."

### Category Creation
DocCov is the first tool to treat TypeScript documentation as a measurable, enforceable quality signal.

---

## TODO

- [ ] Add market size estimates
- [ ] Define category criteria
- [ ] Map competitive positioning visually
- [ ] Identify category evangelism opportunities
- [ ] Draft analyst briefing materials
