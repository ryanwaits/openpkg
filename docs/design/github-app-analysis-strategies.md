# GitHub App Analysis Strategies

Decision doc for how the GitHub App webhook should analyze repos.

---

## Context

When a GitHub App webhook fires (push to main, PR opened), we need to analyze the repo and return coverage results. The challenge: TypeScript analysis often requires installed dependencies and build output.

---

## Current Implementation

**Approach:** Shallow clone + direct SDK analysis

```
webhook → clone repo (depth=1) → detect entry point → run SDK → cleanup
```

**Pros:**
- Simple, fast for small repos
- No external dependencies (Sandbox API)
- Works for self-contained packages

**Cons:**
- No `npm install` - misses types from node_modules
- No build step - fails for packages needing compilation
- Path aliases, barrel exports may not resolve

**When it works:**
- Single-file packages
- Packages with inline types
- Simple src/index.ts exports

**When it fails:**
- Re-exports from node_modules types
- tsconfig path aliases
- Build-generated .d.ts files

---

## Alternative: Vercel Sandbox

**Approach:** Spin up sandbox, install, build, run CLI

```
webhook → Sandbox.create() → install deps → build → doccov check → return output
```

**Pros:**
- Full environment - deps installed, build runs
- Uses same CLI users run locally
- Handles complex setups (monorepos, path aliases)

**Cons:**
- Slower (install + build time)
- Sandbox API dependency
- Cost per analysis

**Two sub-approaches:**

### A. Known build steps (onboarded projects)

Store project config when user sets up integration:
```json
{
  "projectId": "abc",
  "buildSteps": ["bun install", "bun run build"],
  "entryPoint": "packages/sdk/src/index.ts"
}
```

Webhook uses stored config - no guessing.

### B. AI-inferred steps (new projects)

AI analyzes package.json, tsconfig, etc. to determine steps.

**Risk:** Could infer wrong steps, cause failures, inconsistent results.

---

## Hybrid Strategy (Proposed)

Different approaches for different scenarios:

| Scenario | Approach | Why |
|----------|----------|-----|
| **Push to main** | Sandbox (full) | Accuracy matters, updates baseline |
| **PR checks** | Clone (quick) | Speed matters, delta is good enough |
| **First analysis** | Sandbox + store config | Learn the build steps, save for later |
| **Badge requests** | Cached result | No analysis, just return last known |

---

## Implementation Options

### Option 1: Keep clone-only (current)

Accept limitations. Works for ~60% of packages. Fast.

Good if: Most users have simple packages, speed > accuracy.

### Option 2: Add Sandbox path

Wire up Sandbox for push events. Keep clone for PRs.

```typescript
if (event === 'push' && isMainBranch) {
  return await analyzeSandbox(repo, sha);
} else {
  return await analyzeClone(repo, sha);
}
```

Good if: Accuracy matters, willing to add Sandbox dependency.

### Option 3: Configurable per-project

Let users choose during setup:
- "Quick mode" (clone) - faster, less accurate
- "Full mode" (sandbox) - slower, accurate

Store preference in project settings.

---

## Open Questions

1. **Cost:** What's the Sandbox cost per analysis? Matters at scale.

2. **Latency:** GitHub expects check run within 60s. Can Sandbox + install + build finish in time?

3. **Caching:** Can we cache installed node_modules between runs for same repo?

4. **Fallback:** If Sandbox fails, should we fall back to clone approach?

5. **Monorepos:** How do we detect which package changed and only analyze that?

---

## Decision

**TBD** - need to evaluate:
- [ ] Benchmark Sandbox latency for typical repos
- [ ] Measure accuracy difference (clone vs sandbox)
- [ ] Estimate cost at 1k/10k/100k analyses per month

---

## Files

- `packages/api/src/utils/remote-analyzer.ts` - current clone approach
- `packages/sdk/src/detect/filesystem.ts` - SandboxFileSystem (unused in webhook)
- `packages/api/src/routes/github-app.ts` - webhook handlers
