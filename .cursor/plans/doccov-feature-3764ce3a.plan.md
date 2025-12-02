<!-- 3764ce3a-47f0-40df-825a-cc2b34e81f4e fd8fdd9c-618e-49d0-94b1-5c766ba02c8a -->
# DocCov Master Plan

**Mission**: Build the Codecov for TypeScript documentation. Measure, enforce, and visualize docs health.

---

## Completed Work (v0.2.0 Foundation)

### Drift Detection (All Complete)

- [x] Parameter mismatch detection
- [x] Fuzzy rename suggestions (Levenshtein)
- [x] Return type drift (`@returns {Type}` vs signature)
- [x] Param type drift (`@param {Type}` vs signature)
- [x] Generic constraint drift (`@template T extends X`)
- [x] Optionality drift (`[param]` vs `param?`)
- [x] Deprecated drift (`@deprecated` tag alignment)
- [x] Visibility drift (`@internal/@public` vs TS modifiers)

### Platform Features (All Complete)

- [x] v0.2.0 JSON schema with `docs.coverageScore`, `docs.missing[]`, `docs.drift[]`
- [x] Coverage scoring per export and aggregate
- [x] Rich CLI reporting with colors and suggestions
- [x] `openpkg check` command with `--min-coverage` and `--require-examples`
- [x] Basic `diffSpec()` helper in `packages/spec/src/diff.ts`

---

## Phase 1: Rebranding (OpenPkg -> DocCov) ✅

**Goal**: Separate the open spec (OpenPkg) from the product (DocCov).

| Current | After | Binary |

|---------|-------|--------|

| `@openpkg-ts/spec` | `@openpkg-ts/spec` (unchanged) | - |

| `@openpkg-ts/sdk` | `@doccov/sdk` | - |

| `@openpkg-ts/cli` | `@doccov/cli` | `doccov` |

| (new) | `@doccov/api` | - |

### Tasks

- [x] **1.1** Rename `@openpkg-ts/sdk` to `@doccov/sdk`
  - Update `packages/sdk/package.json` name
  - Rename `OpenPkg` class to `DocCov` (optional)
  - Bump to v0.2.0
- [x] **1.2** Rename `@openpkg-ts/cli` to `@doccov/cli`
  - Update `packages/cli/package.json` name and bin
  - Change `.name('openpkg')` to `.name('doccov')` in cli.ts
  - Rename `openpkg.config.ts` to `doccov.config.ts`
- [x] **1.3** Update cross-package imports
  - CLI: `@openpkg-ts/sdk` -> `@doccov/sdk`
  - Test files
- [x] **1.4** Update documentation
  - Root README with DocCov branding
  - USAGE.md with `doccov` command examples
  - Package READMEs
- [x] **1.5** Publish v0.2.0 to npm
  - `@openpkg-ts/spec@0.2.1`
  - `@doccov/sdk@0.2.1`
  - `@doccov/cli@0.2.1`

---

## Phase 2: SaaS MVP (Viral Loop) ✅

**Goal**: Badge -> Repo -> Click -> Adoption. This is the revenue engine.

### 2A: Enhanced Diff with Coverage Delta

Current `diffSpec()` only tracks structural changes. Add coverage metrics.

```typescript
export type SpecDiff = {
  breaking: string[];
  nonBreaking: string[];
  docsOnly: string[];
  // NEW:
  coverageDelta: number;
  oldCoverage: number;
  newCoverage: number;
  newUndocumented: string[];
  improvedExports: string[];
  regressedExports: string[];
  driftIntroduced: number;
  driftResolved: number;
};
```

### Tasks

- [x] **2.1** Extend `SpecDiff` type with coverage delta fields
  - File: `packages/spec/src/diff.ts`
- [x] **2.2** Update `diffSpec()` to compute coverage changes
- [x] **2.3** Implement `doccov diff` CLI command
  - `doccov diff base.json head.json --output json`
  - Output coverage delta, new undocumented exports, drift counts
- [x] **2.4** Create `packages/api` workspace (Hono + Bun)
- [x] **2.5** Implement badge endpoint `GET /badge/:owner/:repo`
  - Fetch `openpkg.json` from GitHub raw
  - Extract `docs.coverageScore`
  - Return Shields.io-style SVG
- [x] **2.6** Create GitHub Action
  - Run `doccov diff` on PR
  - Post coverage delta comment
  - Set status check (pass/fail)
- [ ] **2.7** Deploy doccov.com landing page
  - Badge generator
  - "Scan any repo" one-click tool

---

## Phase 3: Semantic Drift Detection ✅

**Goal**: Deepen correctness guarantees beyond signature matching.

### Tasks

- [x] **3.1** Example drift detection
  - Parse `@example` code blocks
  - Extract identifiers
  - Check against `spec.exports[].name` registry
  - Flag references to removed/renamed exports
- [x] **3.2** Broken link validation
  - Extract `{@link Target}` from tags
  - Resolve against export registry
  - Add `broken-link` to `SpecDocDrift` type
- [x] **3.3** Add new drift types to schema
  - `example-drift`
  - `broken-link`

---

## Phase 4: Ecosystem Integrations (2/4 Complete)

**Goal**: Make `openpkg.json` the single source of truth for docs tools.

### Tasks

- [x] **4.1** Docusaurus plugin (`docusaurus-plugin-doccov`)
  - Read `openpkg.json` instead of re-parsing TS
  - Auto-generate API reference pages
  - Show inline coverage warnings
- [ ] **4.2** Mintlify adapter
- [ ] **4.3** Fumadocs adapter
- [x] **4.4** `doccov scan <github-url>` CLI command
  - Clones repo, detects entry point, runs analysis
  - Monorepo support with `--package` flag
  - API endpoint at POST /scan with SSE streaming progress
  - GET /scan-stream with real-time stage updates (cloning, installing, building, analyzing)
  - Vercel Sandbox execution for remote repos

---

## Phase 5: Viral Marketing Features ✅

**Goal**: Create competitive pressure and social sharing.

### Tasks

- [x] **5.1** Public leaderboard API
  - `GET /api/leaderboard?category=react`
  - Top 100 libraries by docs coverage
- [x] **5.2** Embeddable coverage breakdown widget
  - GET /widget/:owner/:repo returns SVG with signal breakdown
  - Dark/light theme support, compact mode option
- [x] **5.3** `doccov report` CLI command
  - Generate HTML/Markdown/JSON coverage report
  - Signal coverage breakdown (description, params, returns, examples)
  - Coverage by kind, lowest coverage exports, drift issues
  - --out file output, --limit pagination

---

## Phase 6: Historical Versioning & Dashboard

**Goal**: Track health over time.

### Tasks

- [ ] **6.1** Persist specs to database
- [ ] **6.2** Web dashboard with trend graphs
- [ ] **6.3** Version comparison view

---

## Phase 7: IDE & Advanced Features (Future)

### Tasks

- [ ] **7.1** VS Code extension
  - Gutter icons for coverage per export
  - Quick-fix: "Add missing @param for `foo`"
- [ ] **7.2** AI-powered stale description detection

---

## Phase 8: Executable Documentation ✅ (8A Complete)

**Goal**: Make examples runnable, docs explorable.

### 8A: Runnable Examples (Free) ✅

- [x] **8.1** POST /examples/run endpoint
  - Accept packageName, packageVersion, code
  - Execute in Vercel Sandbox (prod) or local Node spawn (dev)
  - Return stdout/stderr/exitCode/duration
- [x] **8.2** SDK example runner utility
  - `runExample()` and `runExamples()` functions
  - Timeout handling, markdown code block stripping
  - Node 22 `--experimental-strip-types` for direct TS execution
- [x] **8.3** Doctest drift detection
  - New drift type: `example-runtime-error`
  - `detectExampleRuntimeErrors()` function in SDK
  - `doccov check --run-examples` CLI flag
  - Test fixture at `tests/fixtures/example-runner/`

### 8B: Interactive Playground (Premium)

- [ ] **8.4** POST /playground/run endpoint
  - Accept arbitrary code + package target
  - Full sandbox session with npm install
  - Rate limit: 10 free / unlimited premium
- [ ] **8.5** Monaco playground component
  - TypeScript support with generated .d.ts from spec
  - Auto-import package exports
  - Typeahead from spec signatures
- [ ] **8.6** Shareable playground links
  - Encoded state in URL
  - Fork & remix functionality

### 8C: Runnable Examples Enhancements

**Current Limitations:**

- Examples run in isolation (can't `import` the package itself)
- No type checking (runtime-only validation)
- No assertion validation (comments like `// 5` aren't verified)
- Environment dependencies not supported (DOM, APIs, databases)

#### CLI Enhancements (CI/CD Focus)

| Priority | Feature | Description |

|----------|---------|-------------|

| **Must** | Package pre-install | Run `npm install .` before examples so `import { X } from 'pkg'` works |

| **Must** | Comment assertion matching | Validate `// => value` or `// 5` comments as doctests |

| Nice | Type checking (`--typecheck-examples`) | Run tsc on examples, catch type errors |

- [x] **8.7** Package pre-install for CLI ✅
  - Added `runExamplesWithPackage()` function to SDK
  - New types: `RunExamplesWithPackageOptions`, `RunExamplesWithPackageResult`
  - Auto-detects package manager from lockfiles (bun.lockb → bun, pnpm-lock.yaml → pnpm, else npm)
  - CLI `--run-examples` now automatically installs local package before running examples
  - **Implementation details:**
    - Creates temp directory: `os.tmpdir()/doccov-examples-{timestamp}`
    - Writes `{"type":"module"}` to temp `package.json`
    - Resolves package path to absolute (required for bun/npm from temp dir)
    - Runs `<pm> install <absolutePackagePath>` once
    - Creates example files in temp dir (so Node can find node_modules)
    - Runs all examples from temp directory (reuse node_modules)
    - Cleanup: `fs.rmSync(tempDir, { recursive: true, force: true })` in finally block
  - **Performance:** Install once → run N examples → cleanup once
  - **Known limitation:** Requires package manager (npm/pnpm/bun) to be in PATH
- [x] **8.8** Comment assertion matching ✅
  - Parse `// => value` assertions with `parseAssertions()`
  - Compare against actual stdout with `detectExampleAssertionFailures()`
  - New drift type: `example-assertion-failed`
  - Python doctest-style validation for TypeScript
  - LLM fallback for non-standard assertion patterns (via AI SDK)

#### Web/UI Enhancements (Playground Focus)

| Priority | Feature | Description |

|----------|---------|-------------|

| **Must** | Interactive output display | Real-time stdout/stderr, syntax-highlighted |

| **Must** | Error formatting | Parse stack traces, highlight error line |

| Nice | jsdom toggle | Enable DOM examples (`document`, `window`) |

| Nice | Type checking in editor | Show TS errors inline in Monaco |

| Nice | Multiple examples as tabs | Run all examples, show pass/fail badges |

- [ ] **8.9** "Run" button component
  - Read-only code block with play button
  - Real-time output panel with syntax highlighting
  - Error line highlighting in code
- [ ] **8.10** jsdom environment option
  - Toggle for DOM-dependent examples
  - Provide `document`, `window`, basic DOM APIs
- [ ] **8.11** Monaco type checking
  - Run tsc in sandbox, show errors inline
  - TypeScript hover information from spec types

---

## Future Ideas: Sandbox-Powered Features

These ideas leverage Vercel Sandbox for isolated code execution beyond basic scanning.

### Type Compatibility Checker

```
POST /compat/check
{ "package": "zod", "version": "3.22", "targetTs": "5.0" }
```

- Install package in sandbox
- Run `tsc` against spec types with different TS versions
- Detect compatibility range automatically
- Badge output: "TS 4.7+ compatible"
- Use case: Library authors validating TS version support

### Dependency Docs Audit

```
doccov audit <package>
```

- Install package + all dependencies in sandbox
- Run `doccov scan` on each dependency recursively
- Aggregate: "Your deps have 47% avg docs coverage"
- Supply chain visibility for documentation quality
- Enterprise feature: "Your bundle includes 12 undocumented packages"

### Migration Impact Preview

```
POST /migrate/preview
{ "package": "lodash", "from": "4.17", "to": "5.0" }
```

- Install both versions in separate sandbox runs
- Generate openpkg specs for each
- Run `doccov diff` between them
- Output: "12 breaking changes, 3 new undocumented exports"
- Powers upgrade planning and changelog validation

### API Snapshot Testing

```
doccov snapshot --save baseline.json
doccov snapshot --compare baseline.json
```

- CI catches unintentional API changes
- Alert: "You removed `fetchUser()` - was this intentional?"
- Like visual regression testing but for public APIs
- Integrates with GitHub Actions for PR blocking

### Example Test Runner (Doctests)

```
doccov test --examples
```

- Extract all `@example` blocks from openpkg spec
- Run each in isolated Vercel Sandbox
- Assert no throws, optionally assert output matches comments
- New drift type: `example-fails`
- CI integration: fail build if examples are broken
- Like Python doctests but for TypeScript

### Cross-Package Type Resolution

```
POST /resolve/types
{ "package": "@tanstack/query", "export": "useQuery" }
```

- Install package with all `@types/*` peer dependencies
- Extract fully resolved types (no `any` leaks from missing types)
- Show "real" return types including generics
- Catches missing `@types/*` dependencies before users do

### Bundle Size per Export

```
POST /size/:owner/:repo
```

- Install package in sandbox
- Run esbuild tree-shake for each export individually
- Output: `createClient: 2.3kb`, `utils: 14kb`
- Docs can show: "Importing this adds ~2kb to your bundle"
- Viral: Compare against competitors

### Peer Dependency Validator

```
POST /peers/validate
{ "package": "my-plugin", "host": "react@18" }
```

- Install plugin with different host package versions
- Check for runtime errors, type conflicts, missing APIs
- Output: "Works with React 17-18, fails on React 19"
- Essential for plugin/extension ecosystems

### Monorepo Full Coverage

```
doccov scan <github-url> --all-packages
```

- Detect all packages in monorepo
- Scan each package in parallel sandboxes
- Aggregate coverage report with per-package breakdown
- Identify which packages drag down the overall score
- Output: heatmap of docs health across monorepo

### AI Docs Suggestion Engine

```
POST /fix/suggest
{ "spec": {...}, "export": "createClient" }
```

- Load package in sandbox, inspect actual runtime behavior
- Analyze parameter usage patterns from examples
- Generate suggested JSDoc based on real types + behavior
- "Here's a draft description based on what this function does"
- Premium: bulk generate missing docs for entire package

### Priority Matrix

| Idea | Effort | Differentiation | Revenue Potential |

|------|--------|-----------------|-------------------|

| Example test runner | Low | High | Free → Premium |

| Type compat checker | Low | Medium | Badge viral |

| Dependency audit | Medium | Very High | Enterprise |

| Migration preview | Medium | High | Enterprise |

| Bundle size | Medium | Medium | Free viral |

| API snapshots | Medium | High | Enterprise |

| AI suggestions | High | Very High | Premium |

---

## Phase 9: Markdown/MDX Documentation Testing

**Goal**: Extend DocCov's documentation quality guarantees to prose documentation - READMEs, tutorials, API guides, and MDX docs. This is the "full-stack documentation coverage" play.

### Why This Matters

1. **User-facing documentation drifts faster** - JSDoc is next to the code; markdown tutorials are in `/docs` and forgotten
2. **Tutorials break silently** - A renamed export breaks 15 markdown code blocks, no one notices until users complain
3. **No existing tool does this well** - [markdown-doctest](https://www.npmjs.com/package/markdown-doctest) has ~3,800 weekly downloads but hasn't been updated in 5 years and doesn't integrate with TypeScript tooling
4. **Natural extension of DocCov** - We already parse examples, run them, validate assertions. Markdown is just another source.

### Competitive Landscape

| Tool | Downloads | Last Updated | Features |

|------|-----------|--------------|----------|

| markdown-doctest | ~3,800/wk | 5 years ago | Basic code block execution |

| @supabase/doctest-js | ~100/wk | Active | JSDoc only, `//=>` syntax |

| jsdoctest | ~100/wk | 8 years ago | JSDoc + Mocha |

**Gap**: No TypeScript-native tool that validates markdown examples against actual package exports with drift detection, assertions, and coverage scoring.

### 9A: Markdown Code Block Extraction (SDK)

Extract and categorize code blocks from markdown/MDX files.

````typescript
// packages/sdk/src/markdown/parser.ts
export interface MarkdownCodeBlock {
  lang: 'ts' | 'typescript' | 'js' | 'javascript' | 'tsx' | 'jsx' | 'bash' | 'json' | string;
  code: string;
  meta?: string;           // ```ts title="example.ts" <- "title=\"example.ts\""
  startLine: number;
  endLine: number;
  filePath: string;
  assertions: Array<{ lineNumber: number; expected: string }>;
}

export interface MarkdownDocFile {
  path: string;
  codeBlocks: MarkdownCodeBlock[];
  frontmatter?: Record<string, unknown>;  // For MDX
}

export function parseMarkdownFile(filePath: string): MarkdownDocFile;
export function parseMarkdownFiles(glob: string): MarkdownDocFile[];
````

#### Tasks

- [ ] **9.1** Create `packages/sdk/src/markdown/parser.ts`
  - Use `unified` + `remark-parse` + `remark-mdx` for parsing
  - Extract fenced code blocks with language tags
  - Parse `// =>` assertions from code blocks
  - Handle MDX-specific syntax (imports, exports, JSX)
- [ ] **9.2** Add code block metadata parsing
  - Title: ` ```ts title="example.ts" `
  - Skip flag: ` ```ts skip ` or ` ```ts norun `
  - Expected error: ` ```ts error `
- [ ] **9.3** Export from SDK main entry

### 9B: Markdown Drift Detection (SDK)

Detect when markdown examples reference non-existent exports or have runtime errors.

```typescript
// packages/sdk/src/markdown/drift.ts
export type MarkdownDrift = {
  type:
    | 'import-not-found'      // import { foo } from 'pkg' - foo doesn't exist
    | 'example-runtime-error' // Code throws when executed
    | 'assertion-failed'      // // => 5 but got 6
    | 'type-error';           // TypeScript compilation error (with --typecheck)
  file: string;
  line: number;
  code: string;
  issue: string;
  suggestion?: string;
};

export interface MarkdownAnalysisResult {
  files: MarkdownDocFile[];
  drift: MarkdownDrift[];
  stats: {
    totalFiles: number;
    totalCodeBlocks: number;
    executableBlocks: number;  // ts/js blocks
    skippedBlocks: number;     // marked with `skip`
    passedBlocks: number;
    failedBlocks: number;
  };
}

export function analyzeMarkdownDocs(
  docsGlob: string,
  spec: Spec,
  options?: {
    runExamples?: boolean;
    packagePath?: string;  // For import resolution
  }
): Promise<MarkdownAnalysisResult>;
```

#### Tasks

- [ ] **9.4** Implement import validation against spec
  - Parse `import { X } from 'package-name'` statements
  - Validate X exists in `spec.exports[].name`
  - Suggest similar names if fuzzy match found
- [ ] **9.5** Implement markdown example runner
  - Reuse `runExamplesWithPackage()` infrastructure
  - Handle multi-block examples (setup + usage blocks)
  - Support `// =>` assertion validation
- [ ] **9.6** Add type checking option
  - Run `tsc --noEmit` on extracted blocks
  - Report type errors with file/line mapping back to markdown

### 9C: CLI Integration

New command and flag for markdown validation.

```bash
# New command: validate markdown docs
doccov docs [glob] [options]

# Examples:
doccov docs                              # Auto-detect docs/**/*.md
doccov docs "docs/**/*.mdx"              # Custom glob
doccov docs --run-examples               # Execute code blocks
doccov docs --package ./packages/sdk     # For monorepos
doccov docs --typecheck                  # TypeScript validation

# Integrate with check command
doccov check --include-docs              # Check source + docs
doccov check --docs-glob "docs/**/*.md"  # Custom docs location
```

#### Tasks

- [ ] **9.7** Implement `doccov docs` command
  - Default glob: `docs/**/*.{md,mdx}`, `README.md`, `*.md` in root
  - Output: list of drift issues with file:line references
  - Exit code 1 if any drift detected
- [ ] **9.8** Add `--include-docs` flag to `check` command
  - Combined coverage: source + markdown
  - Single CI command for full docs validation
- [ ] **9.9** Add markdown stats to `doccov report`
  - "Docs coverage: 15 code blocks validated, 2 failures"
  - Per-file breakdown in detailed report

### 9D: Advanced Features

#### Multi-Block Examples

Handle tutorials where setup is in one block and usage in another:

```markdown
First, create a client:

` ` `ts
const client = createClient({ url: 'https://api.example.com' });
` ` `

Then fetch data:

` ` `ts continuation
const data = await client.fetch('/users');
console.log(data); // => [{id: 1}]
` ` `
```

- [ ] **9.10** Support `continuation` meta tag
  - Concatenate with previous block before execution
  - Share scope between related blocks

#### Import Rewriting

For tutorials that use the published package name:

```markdown
` ` `ts
import { DocCov } from '@doccov/sdk';  // Published name
` ` `
```

- [ ] **9.11** Auto-resolve package imports
  - Map `@doccov/sdk` → local `./packages/sdk` during validation
  - Support `package.json` name field detection

#### MDX Component Validation

```mdx
import { CodeBlock } from '@/components/CodeBlock';

<CodeBlock language="typescript" runnable>
  const x = add(1, 2);
  console.log(x); // => 3
</CodeBlock>
```

- [ ] **9.12** Parse JSX code block components
  - Extract code from `<CodeBlock>`, `<Code>`, `<Playground>` components
  - Configurable component names via `doccov.config.ts`

### Priority Matrix

| Task | Effort | Impact | Priority |

|------|--------|--------|----------|

| 9.1-9.3 Markdown parser | Medium | High | **P1** |

| 9.4 Import validation | Low | Very High | **P1** |

| 9.5 Example runner | Low | High | **P1** (reuses existing) |

| 9.7 `doccov docs` command | Medium | Very High | **P1** |

| 9.8 `--include-docs` flag | Low | High | **P2** |

| 9.6 Type checking | Medium | Medium | **P2** |

| 9.9 Report integration | Low | Medium | **P2** |

| 9.10 Multi-block | Medium | Medium | **P3** |

| 9.11 Import rewriting | Low | Medium | **P3** |

| 9.12 MDX components | High | Low | **P4** |

### Example Output

```
$ doccov docs --run-examples

Scanning docs/**/*.md, README.md...

✓ README.md (3 code blocks)
✗ docs/getting-started.md (5 code blocks, 2 issues)
  • Line 45: import-not-found - `createUser` is not exported from '@doccov/sdk'
    Suggestion: Did you mean `createClient`?
  • Line 78: assertion-failed - expected "5" but got "6"
    Suggestion: Update assertion to: // => 6
✓ docs/api-reference.md (12 code blocks)

Docs validation: 18/20 code blocks passed
2 drift issues detected
```

---

## Phase 10: CLI & SDK Enhancements

**Goal**: Round out the CLI with auto-fix, watch mode, linting, and expand SDK capabilities.

### 10A: `doccov fix` Command ⭐ Priority 2

**Impact**: Automatically fix documentation drift - the "prettier for docs" play.

```bash
# Auto-fix all drift issues
doccov fix

# Interactive mode - review each change
doccov fix --interactive

# Fix specific types only
doccov fix --only param-mismatch,return-type-mismatch

# Dry run - show what would change
doccov fix --dry-run
```

#### Features

| Feature | Description |

|---------|-------------|

| Auto-generate `@param` | Add missing params from function signature |

| Auto-generate `@returns` | Add return type from signature |

| Fix type mismatches | Update `@param {string}` → `@param {number}` |

| Fix assertion drift | Update `// => 5` → `// => 6` to match actual output |

| Interactive mode | Review each fix before applying (y/n/skip) |

#### Tasks

- [ ] **10.1** Implement `doccov fix` command
  - Parse existing JSDoc, compute minimal diff
  - Generate fix suggestions from drift data
  - Write changes back to source files
- [ ] **10.2** Add `--interactive` mode
  - Prompt for each change (accept/reject/skip)
  - Show before/after preview
- [ ] **10.3** Add `--dry-run` mode
  - Output proposed changes without writing
- [ ] **10.4** Add `--only <types>` filter
  - Comma-separated list of drift types to fix

### 10B: `doccov watch` Command ⭐ Priority 3

**Impact**: Real-time feedback during development.

```bash
# Watch mode with default settings
doccov watch

# Watch with example execution
doccov watch --run-examples

# Watch specific directory
doccov watch src/
```

#### Features

| Feature | Description |

|---------|-------------|

| File watching | Re-run on `.ts`/`.tsx` changes |

| Incremental | Only re-analyze changed files |

| Clear output | Show current status, clear on change |

| Debounce | Avoid rapid re-runs during saves |

#### Tasks

- [ ] **10.5** Implement `doccov watch` command
  - Use `chokidar` or native `fs.watch`
  - Debounce file changes (300ms default)
- [ ] **10.6** Add incremental analysis
  - Cache previous spec, only re-analyze changed exports
- [ ] **10.7** Add clear-screen mode
  - `--clear` flag for clean output on each run

### 10C: `--typecheck-examples` Flag ⭐ Priority 4

**Impact**: Catch type errors in examples before runtime - faster than `--run-examples`.

```bash
# Type check examples without executing
doccov check --typecheck-examples

# Combined: type check + run
doccov check --typecheck-examples --run-examples
```

#### Features

- Use TypeScript compiler API (`ts.createProgram`)
- Extract example code, wrap in temp file with imports
- Report type errors with line mapping back to JSDoc
- New drift type: `example-type-error`

#### Tasks

- [ ] **10.8** Add `--typecheck-examples` flag to `check` command
- [ ] **10.9** Implement example type checker in SDK
  - Create virtual source files from examples
  - Run `ts.getPreEmitDiagnostics()`
  - Map errors back to original JSDoc location
- [ ] **10.10** Add `example-type-error` drift type

### 10D: `doccov lint` Command ⭐ Priority 5

**Impact**: Style and quality enforcement for documentation.

```bash
# Lint with default rules
doccov lint

# Lint with config
doccov lint --config .doccov-lint.json

# Auto-fix lint issues
doccov lint --fix
```

#### Rules (Configurable)

| Rule | Description | Default |

|------|-------------|---------|

| `require-description` | All exports must have description | warn |

| `require-param-description` | `@param` must have description text | off |

| `require-example` | All exports must have `@example` | off |

| `no-empty-returns` | `@returns` must have description | warn |

| `consistent-param-style` | Enforce `@param name -` vs `@param name` | off |

| `no-trailing-period` | Descriptions shouldn't end with period | off |

| `max-description-length` | Limit description length | off |

#### Tasks

- [ ] **10.11** Implement `doccov lint` command
- [ ] **10.12** Create lint rule engine
  - Pluggable rule architecture
  - Severity levels: error, warn, off
- [ ] **10.13** Add config file support (`.doccov-lint.json`)
- [ ] **10.14** Add `--fix` for auto-fixable rules

### 10E: API Snapshot Testing ⭐ Priority 6

**Impact**: Detect unintentional breaking changes in CI.

```bash
# Generate baseline snapshot
doccov snapshot --save api-baseline.json

# Compare against baseline
doccov snapshot --compare api-baseline.json

# Update snapshot
doccov snapshot --update api-baseline.json
```

#### Features

- Generate minimal API surface representation
- Detect: removed exports, changed signatures, new required params
- CI integration: fail PR if breaking changes detected
- `--allow-breaking` flag for intentional changes

#### Tasks

- [ ] **10.15** Implement `doccov snapshot` command
- [ ] **10.16** Create snapshot diff algorithm
  - Identify breaking vs non-breaking changes
  - Generate human-readable diff output
- [ ] **10.17** Add GitHub Action integration
  - Auto-comment on PRs with API diff

### 10F: `analyzeProject()` SDK Function ⭐ Priority 7

**Impact**: Multi-file and monorepo analysis for programmatic use.

```typescript
import { analyzeProject } from '@doccov/sdk';

// Analyze entire project
const result = await analyzeProject({
  root: './packages/sdk',
  include: ['src/**/*.ts'],
  exclude: ['**/*.test.ts'],
});

// Aggregate coverage
console.log(result.aggregateCoverage); // 87%

// Per-file breakdown
for (const file of result.files) {
  console.log(`${file.path}: ${file.coverage}%`);
}
```

#### Features

| Feature | Description |

|---------|-------------|

| Multi-entry | Analyze multiple entry points |

| Glob patterns | Include/exclude with globs |

| Aggregate stats | Combined coverage across files |

| Monorepo support | Analyze all packages |

#### Tasks

- [ ] **10.18** Implement `analyzeProject()` SDK function
- [ ] **10.19** Add glob pattern support for includes/excludes
- [ ] **10.20** Implement coverage aggregation
- [ ] **10.21** Add monorepo detection and multi-package analysis

### Priority Matrix

| Feature | Effort | Impact | Priority |

|---------|--------|--------|----------|

| `doccov fix` | High | Very High | **P2** |

| `doccov watch` | Medium | High | **P3** |

| `--typecheck-examples` | Medium | High | **P4** |

| `doccov lint` | High | Medium | **P5** |

| API snapshots | Medium | High | **P6** |

| `analyzeProject()` | Medium | Medium | **P7** |

---

## Schema Additions for v0.3.0

```typescript
export type SpecDocsMetadata = {
  coverageScore?: number;
  missing?: SpecDocSignal[];
  drift?: SpecDocDrift[];
  // NEW:
  sinceVersion?: string;
  exampleCount?: number;
  linkTargets?: string[];
  stability?: 'stable' | 'beta' | 'experimental' | 'deprecated';
};
```

---

## Priority Execution Order

### Completed Phases

1. **Phase 1** - Rebrand ✅ Complete
2. **Phase 2** - SaaS MVP ✅ Complete (except doccov.com deploy)
3. **Phase 3** - Semantic drift ✅ Complete
4. **Phase 4** - Ecosystem (Docusaurus + scan complete, adapters pending)
5. **Phase 5** - Viral features ✅ (Leaderboard, report, widget complete)
6. **Phase 8A** - Runnable examples ✅ (CLI + API + drift detection + assertions complete)

### Current Feature Priority Queue

| Priority | Feature | Phase | Status |

|----------|---------|-------|--------|

| **P1** | Comment assertion matching (`// => value`) | 8A | ✅ Complete |

| **P2** | `doccov fix` command | 10A | ✅ Phase 1 Complete |

| **P3** | `doccov watch` command | 10B | 🔲 Not started |

| **P4** | `--typecheck-examples` flag | 10C | 🔲 Not started |

| **P5** | `doccov lint` command | 10D | 🔲 Not started |

| **P6** | API snapshot testing | 10E | 🔲 Not started |

| **P7** | `analyzeProject()` SDK function | 10F | 🔲 Not started |

| **P8** | Markdown/MDX documentation testing | 9 | 🔲 Not started |

### Remaining To-dos by Priority

**P2: `doccov fix` Command** ✅ Phase 1 Complete

- [x] 10.1: Core fix command with JSDoc generation (deterministic fixes)
- [ ] 10.2: Interactive mode (--interactive)
- [x] 10.3: Dry run mode (--dry-run)
- [x] 10.4: Filter by drift type (--only)
- [ ] 10.1b: LLM-powered fix generation (--generate description,examples,etc)

**P3: `doccov watch` Command**

- [ ] 10.5: File watching with debounce
- [ ] 10.6: Incremental analysis
- [ ] 10.7: Clear screen mode

**P4: `--typecheck-examples` Flag**

- [ ] 10.8: Add flag to check command
- [ ] 10.9: TypeScript compiler integration
- [ ] 10.10: `example-type-error` drift type

**P5: `doccov lint` Command**

- [ ] 10.11-10.14: Lint command with rules engine

**P6: API Snapshots**

- [ ] 10.15-10.17: Snapshot command with CI integration

**P7: `analyzeProject()` SDK**

- [ ] 10.18-10.21: Multi-file/monorepo analysis

**P8: Markdown/MDX Testing (Phase 9)**

- [ ] 9.1-9.3: Markdown code block parser (SDK)
- [ ] 9.4: Import validation against spec exports
- [ ] 9.5: Markdown example runner (reuse existing infra)
- [ ] 9.7: `doccov docs` command
- [ ] 9.8: `--include-docs` flag for `check` command

**Other Remaining Work**

- [ ] Deploy doccov.com with badge generator + scan UI
- [ ] Mintlify adapter
- [ ] Fumadocs adapter
- [ ] Phase 6-7: Historical versioning & dashboard (2026+)
- [ ] Phase 8B-C: Interactive playground + UI components

### Completed

- [x] Rename @openpkg-ts/sdk to @doccov/sdk (package.json, classes)
- [x] Rename @openpkg-ts/cli to @doccov/cli, binary to doccov
- [x] Rename openpkg.config.ts to doccov.config.ts
- [x] Update all cross-package imports to @doccov/*
- [x] Update READMEs and USAGE.md with DocCov branding
- [x] Extend SpecDiff with coverageDelta, newUndocumented, regressedExports
- [x] Implement doccov diff CLI command
- [x] Create packages/api workspace (Hono + Bun)
- [x] Implement GET /badge/:owner/:repo returning SVG
- [x] Create GitHub Action for PR diff comments
- [x] Add example drift detection (references to non-existent exports)
- [x] Add {@link Target} validation against export registry
- [x] Create docusaurus-plugin-doccov package
- [x] Implement public leaderboard API endpoint
- [x] Implement `doccov scan <github-url>` CLI command with monorepo support
- [x] Add POST /scan API endpoint with async job polling
- [x] Publish v0.2.1 packages to npm (@openpkg-ts/spec, @doccov/sdk, @doccov/cli)
- [x] Deploy API to Vercel with hybrid Edge/Node.js functions
- [x] Implement SSE streaming for /scan-stream with real-time progress
- [x] Auto-detect package manager (npm/pnpm/bun) in sandbox
- [x] Auto-detect and run build step for monorepos
- [x] Add /scan/detect endpoint for monorepo package detection
- [x] Implement `doccov report` CLI command with markdown/html/json output
- [x] Implement embeddable coverage widget endpoint (GET /widget/:owner/:repo)
- [x] Add `example-runtime-error` drift type to spec schema
- [x] Create `runExample()` and `runExamples()` SDK utilities
- [x] Add `detectExampleRuntimeErrors()` to docs-coverage.ts
- [x] Implement `doccov check --run-examples` CLI flag
- [x] Create POST /api/examples/run endpoint with sandbox/local fallback
- [x] Add test fixture at tests/fixtures/example-runner/ with happy/sad path examples
- [x] Implement `runExamplesWithPackage()` SDK function for CLI package pre-install
- [x] Add package manager detection (bun/pnpm/npm) from lockfiles
- [x] Update CLI check command to use `runExamplesWithPackage()` for `--run-examples`
- [x] Fix temp file creation to use cwd (so Node can find node_modules)
- [x] Fix package path resolution to absolute (required for bun add from temp dir)
- [x] Add `example-assertion-failed` drift type to spec schema
- [x] Implement `parseAssertions()` function to extract `// => value` assertions
- [x] Implement `detectExampleAssertionFailures()` for doctest validation
- [x] Implement `hasNonAssertionComments()` helper for LLM fallback trigger
- [x] Create LLM assertion parser fallback (`packages/cli/src/utils/llm-assertion-parser.ts`)
- [x] Wire assertion detection + LLM fallback into CLI check command
- [x] Add test fixture at tests/fixtures/drift-example-assertion/ for assertion failures
- [x] Update docs/cli/commands/check.md with doctest assertion documentation
- [x] Update docs/spec/drift-types.md with example-assertion-failed type
- [x] Implement `doccov fix` command (Phase 1 - deterministic fixes)
- [x] Add JSDoc writer utility for parsing/patching/serializing JSDoc comments
- [x] Add deterministic fix generators for 9 drift types (param-mismatch, param-type-mismatch, optionality-mismatch, return-type-mismatch, generic-constraint-mismatch, example-assertion-failed, deprecated-mismatch, async-mismatch, property-type-drift)
- [x] Add `--dry-run` and `--only <types>` flags to fix command
- [x] Add missing drift types to spec schema (async-mismatch, example-syntax-error, property-type-drift)