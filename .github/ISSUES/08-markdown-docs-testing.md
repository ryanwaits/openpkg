# Phase 9: Markdown/MDX Documentation Testing

**Priority:** P8
**Phase:** 9
**Labels:** `enhancement`, `cli`, `sdk`, `major-feature`

## Summary

Extend DocCov's documentation quality guarantees to prose documentation - READMEs, tutorials, API guides, and MDX docs. This is the "full-stack documentation coverage" play.

User-facing documentation drifts faster than code comments. A renamed export can break 15 markdown code blocks silently. No existing tool does this well for TypeScript.

## Competitive Landscape

| Tool | Downloads | Last Updated | Features |
|------|-----------|--------------|----------|
| markdown-doctest | ~3,800/wk | 5 years ago | Basic code block execution |
| @supabase/doctest-js | ~100/wk | Active | JSDoc only, `//=>` syntax |
| jsdoctest | ~100/wk | 8 years ago | JSDoc + Mocha |

**Gap**: No TypeScript-native tool that validates markdown examples against actual package exports with drift detection, assertions, and coverage scoring.

## Proposed CLI

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

## Example Output

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

## Implementation Phases

### 9A: Markdown Code Block Extraction (SDK)

Extract and categorize code blocks from markdown/MDX files.

```typescript
// packages/sdk/src/markdown/parser.ts
export interface MarkdownCodeBlock {
  lang: 'ts' | 'typescript' | 'js' | 'javascript' | 'tsx' | 'jsx' | string;
  code: string;
  meta?: string;           // ```ts title="example.ts"
  startLine: number;
  endLine: number;
  filePath: string;
  assertions: Array<{ lineNumber: number; expected: string }>;
}

export interface MarkdownDocFile {
  path: string;
  codeBlocks: MarkdownCodeBlock[];
  frontmatter?: Record<string, unknown>;
}

export function parseMarkdownFile(filePath: string): MarkdownDocFile;
export function parseMarkdownFiles(glob: string): MarkdownDocFile[];
```

**Tasks:**
- [ ] 9.1: Create `packages/sdk/src/markdown/parser.ts` using unified + remark-parse + remark-mdx
- [ ] 9.2: Add code block metadata parsing (title, skip, error flags)
- [ ] 9.3: Export from SDK main entry

### 9B: Markdown Drift Detection (SDK)

Detect when markdown examples reference non-existent exports or have runtime errors.

```typescript
// packages/sdk/src/markdown/drift.ts
export type MarkdownDrift = {
  type:
    | 'import-not-found'      // import { foo } from 'pkg' - foo doesn't exist
    | 'example-runtime-error' // Code throws when executed
    | 'assertion-failed'      // // => 5 but got 6
    | 'type-error';           // TypeScript compilation error
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
    executableBlocks: number;
    passedBlocks: number;
    failedBlocks: number;
  };
}

export function analyzeMarkdownDocs(
  docsGlob: string,
  spec: Spec,
  options?: { runExamples?: boolean; packagePath?: string }
): Promise<MarkdownAnalysisResult>;
```

**Tasks:**
- [ ] 9.4: Implement import validation against spec exports
- [ ] 9.5: Implement markdown example runner (reuse `runExamplesWithPackage()`)
- [ ] 9.6: Add type checking option with tsc

### 9C: CLI Integration

**Tasks:**
- [ ] 9.7: Implement `doccov docs` command
- [ ] 9.8: Add `--include-docs` flag to `check` command
- [ ] 9.9: Add markdown stats to `doccov report`

### 9D: Advanced Features

**Multi-Block Examples:**

```markdown
First, create a client:

```ts
const client = createClient({ url: 'https://api.example.com' });
```

Then fetch data:

```ts continuation
const data = await client.fetch('/users');
console.log(data); // => [{id: 1}]
```
```

- [ ] 9.10: Support `continuation` meta tag for multi-block examples

**Import Rewriting:**
- [ ] 9.11: Auto-resolve package imports (map `@doccov/sdk` → local `./packages/sdk`)

**MDX Component Validation:**
- [ ] 9.12: Parse JSX code block components (`<CodeBlock>`, `<Playground>`)

## Priority Matrix

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

## Acceptance Criteria

- [ ] `doccov docs` command validates markdown code blocks
- [ ] Import validation catches references to non-existent exports
- [ ] Example runner executes code blocks with `--run-examples`
- [ ] Assertion validation for `// => value` comments
- [ ] Exit code 1 if any drift detected
- [ ] `--include-docs` flag for combined source + docs check
- [ ] Per-file output with line numbers
- [ ] Documentation in `docs/cli/commands/docs.md`
