# `doccov fix` Phase 2: LLM-Powered Documentation Generation

**Priority:** P2 (High)
**Phase:** 10A
**Labels:** `enhancement`, `cli`, `ai`

## Summary

Extend the `doccov fix` command to generate missing documentation using LLM (AI SDK). Phase 1 implemented deterministic fixes for structural drift. Phase 2 adds intelligent generation of descriptions, examples, and complete documentation.

## Current State

Phase 1 complete:
- [x] Deterministic fixes for 9 drift types
- [x] `--dry-run` mode
- [x] `--only <types>` filter
- [x] JSDoc parsing/patching/serialization

## Proposed Implementation

### New CLI Flag

```bash
doccov fix --generate description,examples,returns,params
```

Comma-separated list of what to generate:
- `description` - Generate/improve function descriptions
- `examples` - Generate `@example` code blocks
- `returns` - Generate `@returns` descriptions
- `params` - Generate `@param` descriptions

### Architecture

1. Run deterministic fixes first
2. For exports with `docs.missing[]` signals, use LLM to generate content
3. Use AI SDK with streaming for progress feedback
4. Merge LLM-generated content with existing JSDoc

### Files to Modify

- `packages/sdk/src/fix/llm-generator.ts` (new)
- `packages/cli/src/commands/fix.ts` (add --generate flag)
- `packages/sdk/src/fix/index.ts` (export new functions)

### Acceptance Criteria

- [ ] `--generate` flag accepts comma-separated targets
- [ ] LLM generates contextual descriptions based on function signature and body
- [ ] Generated examples are syntactically valid TypeScript
- [ ] Rate limiting/cost controls for API usage
- [ ] Graceful fallback if LLM unavailable

## Related

- Phase 1 PR: (link to doccov fix implementation)
- AI SDK docs: https://sdk.vercel.ai/docs
