# Phase 7: VS Code Extension & AI Features

**Priority:** Future (2025+)
**Phase:** 7
**Labels:** `enhancement`, `ide`, `ai`, `major-feature`

## Summary

Build a VS Code extension that provides real-time documentation coverage feedback in the editor, plus AI-powered features for detecting stale descriptions.

## Features

### 7.1: VS Code Extension

Real-time gutter icons showing documentation coverage per export.

**Visual Design:**

```
  1 │ /**
  2 │  * Creates a new API client.     ← hover shows "87% coverage"
  3 │  */
🟢4 │ export function createClient(options: ClientOptions): Client {
  5 │   // ...
  6 │ }
  7 │
  8 │ /**
  9 │  * @deprecated
 10 │  */
🟡11│ export function oldClient() {    ← "67% - missing @param descriptions"
 12 │   // ...
 13 │ }
 14 │
🔴15│ export function undocumented() { ← "0% - no documentation"
 16 │   // ...
 17 │ }
```

**Gutter Icon Legend:**
- 🟢 Green: 80%+ coverage
- 🟡 Yellow: 50-79% coverage
- 🔴 Red: <50% coverage or undocumented

**Tasks:**
- [ ] Create VS Code extension scaffold
- [ ] Implement decoration provider for gutter icons
- [ ] Add hover provider showing coverage breakdown
- [ ] Background analysis on file save
- [ ] StatusBar item showing file/project coverage

### Quick Fixes

```
🔴 export function fetchUser(id: string): Promise<User> {
   │
   └─ 💡 Quick Fix: Add JSDoc documentation
      💡 Quick Fix: Add missing @param for 'id'
      💡 Quick Fix: Add missing @returns
```

**Tasks:**
- [ ] Implement CodeAction provider for quick fixes
- [ ] Generate JSDoc stubs from function signature
- [ ] Add missing @param tags
- [ ] Add missing @returns tag

### Diagnostics

Show documentation issues as warnings/errors in Problems panel.

```
Problems
├─ src/client.ts
│  ├─ ⚠️ Line 15: Missing documentation for export 'fetchUser'
│  ├─ ⚠️ Line 23: @param 'userId' not in function signature (renamed to 'id'?)
│  └─ ⚠️ Line 45: @returns type 'string' doesn't match signature 'number'
```

**Tasks:**
- [ ] Implement DiagnosticCollection for drift issues
- [ ] Map drift types to diagnostic severity
- [ ] Auto-refresh diagnostics on save

### 7.2: AI-Powered Stale Description Detection

Use embeddings to detect when descriptions no longer match implementation.

**Concept:**

```typescript
/**
 * Fetches a single user by their email address.  ← Description says "email"
 */
export function fetchUser(id: string): Promise<User> {
  //                      ↑ Param is actually 'id'
  // AI detects: description mentions "email" but param is "id"
  // Suggestion: "Description may be outdated - mentions 'email' but param is 'id'"
}
```

**Implementation:**

```typescript
// Use OpenAI embeddings or local model
const descriptionEmbedding = embed(export.description);
const signatureEmbedding = embed(export.signature);
const similarity = cosineSimilarity(descriptionEmbedding, signatureEmbedding);

if (similarity < 0.7) {
  // Flag as potentially stale
  analyzeMismatch(export.description, export.signature);
}
```

**Tasks:**
- [ ] Integrate AI SDK for embeddings
- [ ] Implement semantic similarity check
- [ ] Create "stale-description" drift type
- [ ] Add CLI flag: `doccov check --ai-analysis`
- [ ] Rate limit and caching for API calls

## Extension Configuration

```json
// .vscode/settings.json
{
  "doccov.enable": true,
  "doccov.coverageThreshold": 80,
  "doccov.showGutterIcons": true,
  "doccov.showHoverDetails": true,
  "doccov.autoAnalyzeOnSave": true,
  "doccov.aiAnalysis": false  // Requires API key
}
```

## Technical Implementation

**Extension Architecture:**

```
┌─────────────────────────────────────────────────┐
│                 VS Code Extension                │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Decoration  │  │   Hover     │  │  Code   │ │
│  │  Provider   │  │  Provider   │  │ Actions │ │
│  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │
│         │                │              │       │
│         └────────────────┼──────────────┘       │
│                          ▼                       │
│              ┌───────────────────┐              │
│              │  Analysis Cache   │              │
│              └─────────┬─────────┘              │
│                        │                         │
│                        ▼                         │
│              ┌───────────────────┐              │
│              │   @doccov/sdk    │              │
│              └───────────────────┘              │
└─────────────────────────────────────────────────┘
```

**Language Server Protocol (Future):**
- Consider LSP for better performance and multi-editor support
- Would enable JetBrains, Neovim, Sublime Text support

## Acceptance Criteria

### VS Code Extension
- [ ] Extension published to VS Code Marketplace
- [ ] Gutter icons show coverage status per export
- [ ] Hover shows coverage breakdown and drift issues
- [ ] Quick fixes generate JSDoc stubs
- [ ] Problems panel shows drift diagnostics
- [ ] Extension settings for customization
- [ ] Performance: <100ms analysis for typical files

### AI Features
- [ ] `--ai-analysis` flag for semantic checking
- [ ] "stale-description" drift type implemented
- [ ] Caching to minimize API calls
- [ ] Works without API key (graceful degradation)
