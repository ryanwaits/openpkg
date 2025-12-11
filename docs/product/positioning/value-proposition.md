# DocCov Value Proposition

> Last updated: 2024-12-08

Core messaging and positioning for DocCov.

---

## One-Liner

**DocCov is Codecov for documentation.**

---

## Elevator Pitch

DocCov ensures your TypeScript library documentation is accurate, complete, and stays in sync with your code. Like how Codecov measures test coverage, DocCov measures documentation coverage - and catches when docs drift out of sync with your API.

---

## The Problem

TypeScript library authors face a documentation quality crisis:

### 1. Documentation Drifts
- Function signatures change, but `@param` docs don't get updated
- Methods get renamed, but examples still use old names
- Types evolve, but tutorials reference outdated shapes

### 2. No Visibility
- You don't know which exports lack documentation
- You can't measure if docs are improving or regressing
- External docs (READMEs, tutorials) silently become stale

### 3. Manual Review Fails
- Reviewers miss doc issues in PRs
- No automated enforcement
- Documentation debt accumulates silently

### The Result
Users copy example code that doesn't compile. They reference parameters that don't exist. They lose trust in your library.

---

## The Solution

DocCov brings the rigor of test coverage to documentation.

### Measure
```
Coverage: 72%
| Signal      | Coverage |
|-------------|----------|
| description | 85%      |
| params      | 68%      |
| returns     | 71%      |
| examples    | 42%      |
```

### Detect
```
Drift Issues (3)
  param-mismatch: @param userId but signature has id
  return-type-mismatch: @returns {User} but returns Promise<User>
  example-drift: Example uses deleted method evaluateChainhook()
```

### Enforce
```yaml
- uses: doccov/doccov@v1
  with:
    min-coverage: 80
    strict: regression,drift,breaking
```

### Fix
```bash
doccov check --fix

Fixed 3 issues in src/client.ts
  ✓ Updated @param userId → id
  ✓ Updated @returns {User} → {Promise<User>}
```

---

## Key Differentiators

### 1. Coverage as a Metric
Unlike tools that just warn on missing docs, DocCov gives you a **number**. Track it. Set thresholds. Measure progress.

### 2. Drift Detection
We catch 14 types of docs/code mismatches - from param name typos to examples that reference deleted methods.

### 3. Example Validation
We don't just check that examples exist. We **type-check** them. We **run** them. We validate inline assertions like `// => 5`.

### 4. External Docs Awareness
When your API changes, we tell you which markdown files need updates - with line numbers.

### 5. Auto-Fix
Don't just report problems. Fix them. `doccov check --fix` repairs most drift issues automatically.

### 6. CI-Native
GitHub annotations, PR comments, strict modes. Documentation quality gates that work like test gates.

---

## Who It's For

### Primary: Library Authors
Open source maintainers and internal SDK teams who:
- Publish TypeScript libraries to npm
- Want users to trust their documentation
- Need to maintain docs across breaking changes

### Secondary: DevRel Teams
Developer relations professionals who:
- Own documentation quality
- Need to find stale tutorials after API changes
- Want metrics to prove docs are improving

### Secondary: Platform Teams
Internal platform teams who:
- Build SDKs for other teams
- Need to enforce documentation standards
- Want to reduce support burden from bad docs

---

## Use Cases

### 1. Enforce Minimum Coverage
```yaml
- run: doccov check --min-coverage 80
```
Fail the build if documentation drops below 80%.

### 2. Catch Drift in PRs
```yaml
- run: doccov diff base.json head.json --strict drift
```
Block merge if PR introduces new docs/code mismatches.

### 3. Find Impacted Tutorials
```bash
doccov diff v1.0.json v2.0.json --docs "docs/**/*.md"

Docs Requiring Updates:
  getting-started.mdx (3 issues)
    L45: createUser() signature changed
```

### 4. Validate Examples Work
```bash
doccov check --examples run
```
Every export needs an example, and every example must run without errors.

### 5. Auto-Fix Param Docs
```bash
doccov check --fix
```
Automatically update `@param` types and names to match signatures.

---

## Proof Points

### What You Get
- **Coverage score**: 0-100% documentation coverage
- **14 drift types**: Comprehensive mismatch detection
- **Auto-fix**: Automated repair for most issues
- **Example validation**: Type-check + runtime + assertions
- **Docs impact**: Know which tutorials break
- **CI integration**: GitHub annotations, PR comments

### What You Avoid
- **Stale docs**: Catch drift before users do
- **Copy-paste failures**: Examples that actually compile
- **Silent regression**: Thresholds prevent backsliding
- **Manual review**: Automated enforcement

---

## Positioning Statement

For **TypeScript library authors** who need to **maintain accurate documentation**, DocCov is a **documentation quality platform** that **measures coverage, detects drift, and enforces standards in CI**.

Unlike **TypeDoc** (which generates doc sites) or **API Extractor** (which prevents API changes), DocCov focuses on **documentation correctness and completeness** - ensuring your docs match your code and your examples actually work.

---

## Taglines

- "Codecov for documentation"
- "Your docs should work as well as your tests"
- "Catch docs drift before your users do"
- "Documentation coverage for TypeScript"
- "Because stale docs are broken docs"

---

## Competitive Positioning

| Tool | Category | DocCov Differentiation |
|------|----------|----------------------|
| TypeDoc | Doc site generator | We enforce quality, they generate sites |
| API Extractor | API governance | We cover docs, they cover API contracts |
| TSDoc | Comment standard | We validate compliance, they define it |
| ESLint | Code linting | We lint docs, they lint code |

### Simple Framing
- **TypeDoc**: "How your docs look"
- **API Extractor**: "What your API is"
- **DocCov**: "Whether your docs are correct"

---

## Key Messages by Audience

### For Library Authors
"Stop shipping docs that don't match your code. DocCov catches drift in CI so your users can trust your examples."

### For DevRel Teams
"Know exactly which tutorials break when the API changes. Get a coverage score you can track and report on."

### For Platform Teams
"Enforce documentation standards across all your SDKs. Fail builds that drop below coverage thresholds."

### For Engineering Leadership
"Reduce support tickets from bad docs. Make documentation quality as measurable as test coverage."
