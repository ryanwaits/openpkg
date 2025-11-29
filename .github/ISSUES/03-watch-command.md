# `doccov watch`: Real-time Documentation Feedback

**Priority:** P3
**Phase:** 10B
**Labels:** `enhancement`, `cli`, `dx`

## Summary

Add a watch mode that re-runs analysis on file changes, providing real-time feedback during development.

## Proposed CLI

```bash
# Watch mode with defaults
doccov watch

# Watch with example execution
doccov watch --run-examples

# Watch specific directory
doccov watch src/

# Clear screen between runs
doccov watch --clear
```

## Features

| Feature | Description |
|---------|-------------|
| File watching | Re-run on `.ts`/`.tsx` changes |
| Debounce | Avoid rapid re-runs (300ms default) |
| Incremental | Only re-analyze changed files (future) |
| Clear output | `--clear` flag for clean terminal |
| Example running | Support `--run-examples` flag |

## Implementation

### Phase 1: Basic Watch
- Use `chokidar` for file watching
- Debounce file changes (configurable via `--debounce <ms>`)
- Re-run full `doccov check` on changes
- Show timestamp of each run

### Phase 2: Incremental (Future)
- Cache previous spec
- Only re-analyze changed exports
- Show delta: "Coverage: 85% (+2%)"

## Example Output

```
[14:32:05] Watching src/**/*.ts...

[14:32:05] Analysis complete
  Coverage: 85%
  Drift: 3 issues
  Press Ctrl+C to exit

[14:32:15] File changed: src/utils.ts

[14:32:15] Analysis complete
  Coverage: 87% (+2%)
  Drift: 2 issues (-1)
```

## Acceptance Criteria

- [ ] `doccov watch` command implemented
- [ ] Debounce works correctly (default 300ms)
- [ ] `--clear` clears terminal between runs
- [ ] Shows diff from previous run (coverage delta)
- [ ] Graceful Ctrl+C handling
- [ ] Works with `--run-examples` flag
