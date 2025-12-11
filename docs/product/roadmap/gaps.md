# Known Gaps & Opportunities

> Last updated: 2024-12-08

Prioritized list of feature gaps compared to competitors, with recommendations.

---

## Gap Prioritization Framework

| Priority | Criteria |
|----------|----------|
| **P0** | Blocking adoption, competitive disadvantage |
| **P1** | Frequently requested, clear value add |
| **P2** | Nice to have, differentiator |
| **P3** | Low demand, consider later |

| Effort | Definition |
|--------|------------|
| **S** | < 1 week |
| **M** | 1-3 weeks |
| **L** | 1+ month |

---

## Gaps vs API Extractor

### 1. Git-Trackable API Surface File

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Status** | Not started |

**Gap**: API Extractor generates `.api.md` - a deterministic, sorted file showing the public API surface. Teams track this in git and use CODEOWNERS to require API review approval.

**Current state**: DocCov's diff reports serve a similar purpose but aren't designed for git tracking.

**Recommendation**: Add `--format api-surface` to generate a minimal, deterministic file:

```bash
doccov spec --format api-surface --output api-surface.md
```

Output would be sorted, minimal (just signatures), and stable for git diffs:
```markdown
# API Surface: @mypackage/core v1.0.0

## Functions

### createUser
```ts
function createUser(name: string, options?: CreateOptions): Promise<User>
```

### deleteUser
```ts
function deleteUser(id: string): Promise<void>
```
```

---

### 2. Release Stage Filtering

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | S |
| **Status** | Not started |

**Gap**: API Extractor can filter exports by release tag (`@alpha`, `@beta`, `@public`) when generating outputs.

**Current state**: DocCov parses release tags and detects visibility mismatches, but doesn't filter based on them.

**Recommendation**: Add `--visibility` or `--release-stage` flags:

```bash
# Only analyze public API
doccov spec --visibility public

# Include beta but exclude alpha/internal
doccov check --visibility public,beta
```

This gives teams governance without requiring `.d.ts` rollups.

---

### 3. More TSDoc Strictness Warnings

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Status** | Not started |

**Gap**: API Extractor emits 50+ message IDs covering TSDoc compliance:
- `ae-forgotten-export` - Referenced type not exported
- `ae-internal-missing-underscore` - `@internal` without `_` prefix
- `ae-missing-release-tag` - No release tag specified
- `ae-extra-release-tag` - Conflicting release tags

**Current state**: DocCov has 4 lint rules focused on documentation completeness.

**Recommendation**: Add lint rules for TSDoc compliance:
- `no-forgotten-export` - All referenced types must be exported
- `require-release-tag` - All exports need @public/@beta/@internal
- `internal-underscore` - @internal exports should have _ prefix
- `no-conflicting-tags` - Can't have both @internal and @public

---

### 4. `.d.ts` Rollup Generation

| Attribute | Value |
|-----------|-------|
| **Priority** | P3 |
| **Effort** | L |
| **Status** | Won't do |

**Gap**: API Extractor bundles declarations into single `.d.ts` files with release stage trimming.

**Recommendation**: Don't build. This is commodity infrastructure:
- Alternatives exist: `dts-bundle-generator`, `rollup-plugin-dts`, `tsup`
- TypeScript may absorb this natively
- Not aligned with DocCov's core value prop

See: [Won't Do](./wont-do.md)

---

## ~~Gaps vs TypeDoc~~ (Resolved)

### 5. ~~Doc Site Generation~~ IMPLEMENTED

| Attribute | Value |
|-----------|-------|
| **Priority** | ~~P3~~ |
| **Effort** | ~~L~~ |
| **Status** | **Implemented** |

**Former gap**: TypeDoc generates complete API reference websites.

**Current state**: DocCov now provides full API reference site generation via:
- `@doccov/fumadocs-adapter` - React components for Fumadocs integration
- `@doccov/ui` - 50+ shared UI components
- Page components for functions, classes, interfaces, enums, variables
- Coverage badges and drift indicators embedded in docs
- CodeHike-powered syntax highlighting
- Two-column layouts, collapsible methods, interactive features

**DocCov advantage over TypeDoc**: Quality signals (coverage, drift) are built into the rendered documentation, not bolted on.

See: [Doc Site Generation Capabilities](../capabilities/doc-site-generation.md)

---

## Enhancement Opportunities

### 6. Coverage Trends Over Time

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Effort** | M |
| **Status** | Not started |

**Opportunity**: Track coverage changes across versions/commits.

**Value**: Teams can see if documentation is improving or regressing over time.

**Implementation ideas**:
- Store historical specs
- Generate trend reports
- Show graphs in HTML reports
- PR comments with sparklines

---

### 7. Documentation Coverage Badges

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Effort** | S |
| **Status** | Partial (API exists) |

**Opportunity**: Generate badges like Codecov does for test coverage.

**Current state**: `@doccov/api` has badge endpoint. Needs polish and promotion.

**Improvements needed**:
- Hosted badge service
- README integration docs
- Multiple badge styles

---

### 8. Auto-Generate Missing Documentation

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Status** | Not started |

**Opportunity**: Use AI to generate initial documentation for undocumented exports.

**Current state**: `--ai` flag exists for analysis summaries.

**Extension**:
```bash
doccov fix --generate

# Generates:
#   src/client.ts:
#     ✓ createUser [line 45]
#       + Generated @description
#       + Generated @param name
#       + Generated @returns
```

---

### 9. More Lint Rules

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Status** | Not started |

**Opportunity**: Expand lint rule library.

**Candidates**:
- `max-line-length` - Description shouldn't exceed N chars
- `no-todo-in-docs` - No TODO/FIXME in shipped docs
- `require-since` - All exports need @since tag
- `require-category` - Exports should be categorized
- `no-html-in-docs` - Prefer markdown
- `spell-check` - Catch typos in documentation

---

### 10. IDE Integration

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | L |
| **Status** | Not started |

**Opportunity**: VS Code extension for real-time drift detection.

**Features**:
- Inline squiggles for drift issues
- Quick fixes
- Coverage gutter indicators
- Hover to see coverage status

---

### 11. Changelogs from Diffs

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | M |
| **Status** | Not started |

**Opportunity**: Auto-generate changelogs from spec diffs.

```bash
doccov diff v1.0.0.json v1.1.0.json --format changelog

# Output:
## Breaking Changes
- Removed `legacyFetch()` - use `fetch()` instead

## New Features
- Added `createUser()`, `updateUser()`, `deleteUser()`

## Documentation
- Improved coverage from 72% to 85%
- Fixed 3 drift issues
```

---

### 12. Semantic Versioning Recommendations

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Effort** | S |
| **Status** | Not started |

**Opportunity**: Suggest version bump based on changes.

```bash
doccov diff v1.0.0.json head.json --recommend-version

# Output:
Recommended version: 2.0.0 (MAJOR)
Reason: 3 breaking changes detected
  - legacyFetch removed
  - ChainhooksClient.evaluateChainhook signature changed
  - UserOptions interface changed
```

---

## Prioritized Roadmap

### Next Up (P0-P1)

| # | Feature | Priority | Effort |
|---|---------|----------|--------|
| 1 | Git-trackable API surface file | P1 | S |
| 6 | Coverage trends over time | P1 | M |
| 7 | Coverage badges (polish) | P1 | S |

### Medium Term (P2)

| # | Feature | Priority | Effort |
|---|---------|----------|--------|
| 2 | Release stage filtering | P2 | S |
| 3 | TSDoc strictness rules | P2 | M |
| 8 | Auto-generate docs (AI) | P2 | M |
| 9 | More lint rules | P2 | M |
| 11 | Changelogs from diffs | P2 | M |
| 12 | Semver recommendations | P2 | S |
| 10 | IDE integration | P2 | L |

### Won't Do (P3)

| # | Feature | Reason |
|---|---------|--------|
| 4 | `.d.ts` rollups | Commodity feature, alternatives exist |
| 5 | Doc site generation | Not our category, TypeDoc does this |

---

## How to Update This Document

1. When identifying new gaps, add them with priority/effort assessment
2. When completing a gap, move it to capabilities doc and mark complete here
3. Review quarterly to re-prioritize based on user feedback
4. Link to relevant GitHub issues/PRs when work begins
