# DocCov v1 Launch Rollout Plan

> Phased implementation specs for closing MLP gaps before launch.

---

## Overview

Six work items organized into 3 phases:

| Phase | Items | Duration |
|-------|-------|----------|
| **Phase 1: Core UX** | PR Comment UX, Strict Presets | 2-3 days |
| **Phase 2: Config & Docs** | YAML Config, Quickstart, Badge Docs | 2-3 days |
| **Phase 3: Marketing** | Pricing Page | 3-5 days |

---

## Phase 1: Core UX

### 1.1 PR Comment UX Refactor

**Goal:** Match the one-pager mockup format for maximum actionability.

**Current state:** Table-based format in `action/action.yml` lines 164-219.

**Target output:**

```markdown
## ✅ DocCov — Documentation Coverage

**Patch coverage:** 86% (target: 90%) ❌
**New undocumented exports:** 2
**Doc drift issues:** 1

### Undocumented exports in this PR

📁 `packages/client/src/index.ts`
- `export function createClient(options: ClientOptions): Client`
  - Missing: description, `@param options`, `@returns`

📁 `packages/core/src/config.ts`
- `export type RetryPolicy = ...`
  - Missing: type description

### Doc drift detected

⚠️ `docs/api.md` line 45:
```ts
createClient(options: string)  // docs
createClient(options: ClientOptions)  // code
```

### How to fix

1. Add JSDoc/TSDoc to the exports listed above
2. Push your changes — DocCov re-checks automatically

<details>
<summary>View full report</summary>

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Coverage | 80% | 86% | +6% |
| Drift issues | 3 | 1 | -2 |
| Total exports | 45 | 47 | +2 |

</details>
```

**Implementation:**

1. **Create comment template module** - `packages/cli/src/reports/pr-comment.ts`
   - `renderPRComment(diff: SpecDiffWithDocs, options: PRCommentOptions): string`
   - Structured sections: summary line, undocumented list, drift list, how-to-fix
   - Collapsible details for full metrics

2. **Update action.yml** - Replace inline JS with CLI call
   ```yaml
   - name: Generate PR comment
     run: doccov diff base.json head.json --format pr-comment > comment.md
   ```

3. **Add `--format pr-comment`** to diff command
   - Outputs markdown optimized for GitHub PR comments
   - Distinct from `--format markdown` (which is for reports)

**Files to modify:**
- `packages/cli/src/reports/pr-comment.ts` (new)
- `packages/cli/src/reports/index.ts` (export)
- `packages/cli/src/commands/diff.ts` (add format option)
- `action/action.yml` (simplify comment generation)

**Acceptance criteria:**
- [ ] PR comment matches mockup structure
- [ ] "How to fix" section always present
- [ ] File paths are clickable (relative to repo root)
- [ ] Collapsible details for verbose info

---

### 1.2 Strict Mode Presets

**Goal:** Expose named presets in GitHub Action for common CI patterns.

**Current state:** Presets exist in `diff.ts` but not in Action inputs.

```typescript
// packages/cli/src/commands/diff.ts lines 40-44
const STRICT_PRESETS: Record<StrictPreset, Set<string>> = {
  ci: new Set(['breaking', 'regression']),
  release: new Set(['breaking', 'regression', 'drift', 'docs-impact', 'undocumented']),
  quality: new Set(['drift', 'undocumented']),
};
```

**Implementation:**

1. **Document presets in action.yml description:**
   ```yaml
   strict:
     description: |
       Fail conditions. Use preset names or comma-separated checks:
       - ci: breaking, regression
       - release: breaking, regression, drift, docs-impact, undocumented  
       - quality: drift, undocumented
       - Or custom: "breaking,drift"
     required: false
     default: ''
   ```

2. **Add to GitHub Action docs:**
   ```markdown
   ### Strict Mode Presets
   
   | Preset | Checks | Use Case |
   |--------|--------|----------|
   | `ci` | breaking, regression | Default CI protection |
   | `release` | all checks | Pre-release validation |
   | `quality` | drift, undocumented | Documentation hygiene |
   ```

**Files to modify:**
- `action/action.yml` (update description)
- `action/README.md` (document presets)
- `docs/integrations/github-action.md` (add preset table)

**Acceptance criteria:**
- [ ] `--strict ci` works in Action
- [ ] Presets documented in Action README
- [ ] Integration docs updated

---

## Phase 2: Config & Docs

### 2.1 YAML Config Support

**Goal:** Support `doccov.yml` for users who prefer YAML over TypeScript.

**Current state:** Only `doccov.config.ts` supported via `loadDocCovConfig()`.

**Target config format (`doccov.yml`):**

```yaml
# doccov.yml
check:
  min_coverage: 80
  max_drift: 10
  examples: typecheck

docs:
  include:
    - "docs/**/*.md"
    - "README.md"

quality:
  rules:
    has-description: error
    has-examples: warn
```

**Implementation:**

1. **Add YAML loader** - `packages/cli/src/config/yaml-loader.ts`
   ```typescript
   import { parse } from 'yaml';
   
   export async function loadYamlConfig(cwd: string): Promise<DocCovConfig | null> {
     const configPath = path.join(cwd, 'doccov.yml');
     if (!fs.existsSync(configPath)) return null;
     
     const content = fs.readFileSync(configPath, 'utf-8');
     const raw = parse(content);
     
     // Normalize snake_case to camelCase
     return normalizeConfig(raw);
   }
   ```

2. **Update config loader priority:**
   ```typescript
   // packages/cli/src/config/index.ts
   export async function loadDocCovConfig(cwd: string): Promise<DocCovConfig | null> {
     // 1. Try doccov.config.ts (TypeScript - most powerful)
     const tsConfig = await loadTsConfig(cwd);
     if (tsConfig) return tsConfig;
     
     // 2. Try doccov.yml (YAML - simpler)
     const yamlConfig = await loadYamlConfig(cwd);
     if (yamlConfig) return yamlConfig;
     
     // 3. Try package.json "doccov" field
     const pkgConfig = await loadPackageJsonConfig(cwd);
     if (pkgConfig) return pkgConfig;
     
     return null;
   }
   ```

3. **Add `yaml` dependency** to CLI package

**Files to modify:**
- `packages/cli/src/config/yaml-loader.ts` (new)
- `packages/cli/src/config/index.ts` (add to loader chain)
- `packages/cli/package.json` (add yaml dep)

**Acceptance criteria:**
- [ ] `doccov.yml` loaded when present
- [ ] TypeScript config takes precedence
- [ ] Snake_case keys normalized to camelCase
- [ ] Invalid YAML gives helpful error

---

### 2.2 Quickstart Docs

**Goal:** 5-minute path from zero to first PR check.

**Current state:** Docs exist but spread across multiple pages.

**Target quickstart (`docs/getting-started/quick-start.md`):**

```markdown
# Quick Start

Get DocCov running in 5 minutes.

## 1. Install

\`\`\`bash
npm install -D @doccov/cli
\`\`\`

## 2. Add config

\`\`\`bash
npx doccov init
\`\`\`

This creates `doccov.yml`:

\`\`\`yaml
check:
  min_coverage: 80
\`\`\`

## 3. Run locally

\`\`\`bash
npx doccov check
\`\`\`

## 4. Add to CI

\`\`\`yaml
# .github/workflows/docs.yml
name: Docs
on: [push, pull_request]
jobs:
  doccov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: doccov/doccov@v1
\`\`\`

## 5. Add badge

\`\`\`markdown
![DocCov](https://api.doccov.dev/badge/YOUR_ORG/YOUR_REPO)
\`\`\`

---

**Next:** [Configuration Reference](../cli/configuration.md)
```

**Implementation:**

1. Rewrite `docs/getting-started/quick-start.md` with above structure
2. Ensure `doccov init` generates `doccov.yml` (not just .ts)
3. Add copy buttons to code blocks (if using doc site)

**Files to modify:**
- `docs/getting-started/quick-start.md` (rewrite)
- `packages/cli/src/commands/init.ts` (add YAML output option)

**Acceptance criteria:**
- [ ] Quickstart fits on one screen
- [ ] All commands are copy/paste ready
- [ ] Works for both npm and GitHub Action paths

---

### 2.3 Badge Documentation

**Goal:** Make badges discoverable and easy to add.

**Current state:** Badge API exists but undocumented in main README.

**Implementation:**

1. **Add to main README.md:**
   ```markdown
   ## Badges
   
   Add a documentation coverage badge to your README:
   
   ```markdown
   ![DocCov](https://api.doccov.dev/badge/YOUR_ORG/YOUR_REPO)
   ```
   
   | Coverage | Badge |
   |----------|-------|
   | 90%+ | ![90%](https://img.shields.io/badge/docs-90%25-brightgreen) |
   | 80%+ | ![80%](https://img.shields.io/badge/docs-80%25-green) |
   | 70%+ | ![70%](https://img.shields.io/badge/docs-70%25-yellowgreen) |
   | <70% | ![60%](https://img.shields.io/badge/docs-60%25-orange) |
   
   Requires `openpkg.json` committed to your default branch.
   ```

2. **Update `docs/integrations/badges-widgets.md`** with:
   - Badge URL format
   - Query parameters (branch, style)
   - Troubleshooting (404 = no spec found)

**Files to modify:**
- `README.md` (add Badges section)
- `docs/integrations/badges-widgets.md` (expand)

**Acceptance criteria:**
- [ ] Badge section in main README
- [ ] URL format documented
- [ ] Color scale explained

---

## Phase 3: Marketing

### 3.1 Pricing Page

**Goal:** Launch-ready pricing page matching one-pager tiers.

**Target URL:** `/pricing`

**Tier structure (from one-pager):**

| Tier | Price | Key Features |
|------|-------|--------------|
| **Open Source** | Free | Public repos, PR checks, badges |
| **Developer** | Free | 1 private repo, limited analyses |
| **Team** | $X/seat/mo | Merge blocking, CODEOWNERS |
| **Pro** | $Y/seat/mo | Trends, components, policies |
| **Enterprise** | Contact | SSO, self-hosted, support |

**Implementation:**

1. **Create pricing page** - `apps/site/src/app/(marketing)/pricing/page.tsx`

```tsx
import { PricingCard } from '@/components/pricing-card';

const tiers = [
  {
    name: 'Open Source',
    price: 'Free',
    description: 'For public repositories',
    features: [
      'Unlimited public repos',
      'PR checks + summary',
      'Patch coverage + drift detection',
      'README badge',
    ],
    cta: 'Get Started',
    href: '/docs/getting-started/quick-start',
  },
  {
    name: 'Team',
    price: '$19',
    period: '/seat/month',
    description: 'For teams shipping APIs',
    features: [
      'Everything in Open Source',
      'Private repositories',
      'Required checks / merge blocking',
      'CODEOWNERS integration',
      'Priority support',
    ],
    cta: 'Start Trial',
    href: '/signup?plan=team',
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/seat/month',
    description: 'For org-wide governance',
    features: [
      'Everything in Team',
      'Coverage trends + history',
      'Monorepo components',
      'Policy packs',
      'Release comparisons',
    ],
    cta: 'Start Trial',
    href: '/signup?plan=pro',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For compliance & scale',
    features: [
      'Everything in Pro',
      'SSO/SAML + RBAC',
      'Self-hosted option',
      'Audit logs',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    href: '/contact',
  },
];

export default function PricingPage() {
  return (
    <div className="container py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">
          Stop shipping undocumented APIs
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          DocCov adds a required PR check that measures documentation coverage
          and catches doc drift for TypeScript exports.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} {...tier} />
        ))}
      </div>
      
      <FAQ />
    </div>
  );
}
```

2. **Create PricingCard component** - `apps/site/src/components/pricing-card.tsx`

3. **Create FAQ component** with one-pager questions:
   - "What is patch doc coverage?"
   - "Does DocCov require a specific doc format?"
   - "Can it block merges?"

4. **Add pricing link to nav** - Update marketing layout

**Files to create:**
- `apps/site/src/app/(marketing)/pricing/page.tsx`
- `apps/site/src/components/pricing-card.tsx`
- `apps/site/src/components/faq.tsx`

**Files to modify:**
- `apps/site/src/app/(marketing)/layout.tsx` (add nav link)

**Acceptance criteria:**
- [ ] 4 tier cards displayed
- [ ] Feature lists match one-pager
- [ ] FAQ section with 3+ questions
- [ ] Responsive grid layout
- [ ] CTAs link to appropriate flows

---

## Implementation Order

```
Week 1:
├── Day 1-2: Phase 1 (PR Comment + Strict Presets)
├── Day 3-4: Phase 2 (YAML + Quickstart + Badges)
└── Day 5: Review + polish

Week 2:
├── Day 1-3: Phase 3 (Pricing Page)
├── Day 4: Integration testing
└── Day 5: Launch prep
```

---

## Success Metrics

From one-pager Section 9:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first check | < 10 min | Track install → check timestamp |
| PR comment usefulness | Low "fix rate" friction | Survey beta users |
| Pricing page conversion | > 2% visitor → signup | Analytics |

---

## Post-Launch (Deferred)

These items from the one-pager are explicitly v2/Pro:

- GitHub App (OAuth flow)
- Dashboard with project list
- Org-wide analytics
- Coverage trends over time
- Multi-language support
- AI doc generation

