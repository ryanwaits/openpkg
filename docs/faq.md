# Frequently Asked Questions

## Entry Point Detection

### How does DocCov find my entry point?

When you run `doccov spec` without specifying a file, it reads your `package.json` and checks these fields in order:

1. `types` or `typings` field (most explicit)
2. `exports["."].types` (modern packages)
3. `main` field
4. `module` field
5. Common fallback paths (`src/index.ts`, `index.ts`, etc.)

### My package.json points to `dist/`, but DocCov uses `src/`. Why?

DocCov automatically resolves output paths back to source files when possible.

If your `package.json` says `"main": "dist/index.js"`, DocCov:
1. Reads that path
2. Uses `tsconfig.json` (or heuristics) to map `dist/` → `src/`
3. Checks if `src/index.ts` exists
4. Uses the source file if found

This is intentional - source files provide richer information than compiled output.

### What does "Detected via" mean in verbose output?

```
Entry point:      src/index.ts
Detected via:     main           ← This field
```

| Value | Meaning |
|-------|---------|
| `types` | Read from `types` or `typings` field |
| `exports` | Read from `exports["."].types` |
| `main` | Read from `main` field |
| `module` | Read from `module` field |
| `fallback` | Found via common path heuristics |
| `explicit` | You specified the file directly |

### What is "Declaration only" mode?

```
Declaration only: yes
```

This means DocCov is analyzing `.d.ts` files instead of `.ts` source files. This happens when:
- Source files aren't available (published npm packages)
- You explicitly specify a `.d.ts` file

Declaration-only mode works but has limitations (see below).

---

## Source vs Declaration Files

### What's the difference between analyzing `src/index.ts` vs `dist/index.d.ts`?

| Aspect | Source (`.ts`) | Declaration (`.d.ts`) |
|--------|----------------|----------------------|
| Type signatures | ✅ Full | ✅ Full |
| JSDoc comments | ✅ Full | ✅ Preserved by tsc |
| Source locations | Points to `src/` | Points to `dist/` |
| Runtime extraction | ✅ Available | ❌ Not available |
| Schema constraints | ✅ With `--runtime` | ❌ Static only |

### Can I analyze `dist/index.js` directly?

**No.** This produces broken output (0 exports). DocCov uses the TypeScript Compiler API which can't properly parse compiled JavaScript.

```bash
# DON'T DO THIS
doccov spec dist/index.js  # → 0 exports!

# DO THIS INSTEAD
doccov spec src/index.ts   # → Works
doccov spec dist/index.d.ts  # → Works (declaration-only)
```

### When should I use declaration files?

Only when source files aren't available - typically when analyzing published npm packages where you only have the distributed `.d.ts` files.

---

## Schema Extraction

### What's the difference between static and runtime extraction?

| Mode | Flag | Requires Build | Output | Constraints |
|------|------|----------------|--------|-------------|
| Static | (default) | No | `type` field | Lost |
| Runtime | `--runtime` | Yes | `schema` field | Preserved |

**Static** uses TypeScript Compiler API to parse source files. Fast, safe, but loses runtime constraints.

**Runtime** executes compiled JavaScript to extract actual JSON Schema. Slower, requires build, but preserves formats/min/max/patterns.

### Why does `--runtime` require built code?

Runtime extraction runs your compiled JavaScript in a subprocess to inspect schema objects at runtime. Without `dist/index.js`, there's nothing to execute.

```bash
# This fails silently (falls back to static)
rm -rf dist
doccov spec src/index.ts --runtime

# This works
npm run build
doccov spec src/index.ts --runtime
```

### How do I know if runtime extraction worked?

Use `--verbose` and look for these lines:

```
Schema extraction: hybrid
Runtime schemas:   4 (typebox)
```

If these lines are missing, runtime extraction didn't run (fell back to static).

### Why is runtime extraction not working with `dist/index.d.ts`?

Runtime extraction needs to correlate the entry point with compiled JavaScript. When you specify `dist/index.d.ts` directly:
- The path mapping breaks
- DocCov can't find the corresponding `.js` file to execute

**Solution:** Analyze source files for runtime extraction:

```bash
doccov spec src/index.ts --runtime  # Works
doccov spec dist/index.d.ts --runtime  # Falls back to static
```

### What schema libraries are supported?

| Library | Version | Static | Runtime | Method |
|---------|---------|--------|---------|--------|
| Zod | 4.2+ | ✅ | ✅ | Standard Schema |
| Zod | <4.2 | ✅ | ❌ | - |
| Valibot | 1.0+ | ✅ | ✅ | Standard Schema |
| TypeBox | any | ✅ | ✅ | Native JSON Schema |
| ArkType | 2.0+ | ✅ | ✅ | Standard Schema |

---

## Common Issues

### I get 0 exports when analyzing my package

**Likely causes:**
1. Analyzing a `.js` file instead of `.ts` or `.d.ts`
2. Entry point has no exports (check your file)
3. TypeScript compilation errors (use `--show-diagnostics`)

```bash
# Debug with diagnostics
doccov spec src/index.ts --show-diagnostics --verbose
```

### Runtime extraction silently fell back to static

**Check:**
1. Is the project built? Run `npm run build`
2. Does `dist/index.js` exist?
3. Are you analyzing source files (not `.d.ts`)?

```bash
# Verify with verbose output
doccov spec src/index.ts --runtime --verbose
# Should show: "Schema extraction: hybrid"
```

### Source locations point to `dist/` instead of `src/`

You're analyzing declaration files. Either:
- Let DocCov auto-detect (it prefers source)
- Explicitly specify source: `doccov spec src/index.ts`

### JSDoc comments are missing

**Check:**
1. Comments use `/** */` format (not `//`)
2. Comments are directly above the export
3. If using `.d.ts`, ensure `tsc` preserved comments (check `removeComments` in tsconfig)

---

## Best Practices

### For local development

```bash
# Quick check (no build needed)
doccov spec src/index.ts

# Full schema extraction
npm run build
doccov spec src/index.ts --runtime --verbose
```

### For CI/CD

```bash
# Ensure build runs first
npm run build
doccov spec --runtime --no-cache
```

### For published packages (no source)

```bash
# Declaration-only mode
doccov spec node_modules/some-package/dist/index.d.ts
```

Note: Runtime extraction not available for published packages.

---

## Quick Reference

### Entry Point Priority

```
1. types/typings field
2. exports["."].types
3. main field (resolved to .ts)
4. module field (resolved to .ts)
5. Fallback paths (src/index.ts, etc.)
```

### File Type Support

| File | Can Analyze | Runtime | Notes |
|------|-------------|---------|-------|
| `.ts` | ✅ | ✅ | Best option |
| `.tsx` | ✅ | ✅ | React components |
| `.d.ts` | ✅ | ❌ | Declaration-only mode |
| `.js` | ❌ | - | Don't use directly |
| `.mts`/`.cts` | ✅ | ✅ | ESM/CJS variants |

### Compiled JS Lookup Paths

For runtime extraction, DocCov looks for compiled JS at:

```
src/index.ts → looks for:
  1. src/index.js
  2. dist/index.js
  3. build/index.js
  4. lib/index.js
```
