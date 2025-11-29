# `doccov snapshot`: API Snapshot Testing

**Priority:** P6
**Phase:** 10E
**Labels:** `enhancement`, `cli`, `ci`

## Summary

Add a snapshot command for detecting unintentional breaking changes in CI. Like Jest snapshots but for your public API surface.

## Proposed CLI

```bash
# Generate baseline snapshot
doccov snapshot --save api-baseline.json

# Compare against baseline
doccov snapshot --compare api-baseline.json

# Update snapshot after intentional changes
doccov snapshot --update api-baseline.json

# Allow breaking changes (for PRs that intentionally change API)
doccov snapshot --compare api-baseline.json --allow-breaking
```

## Snapshot Format

```json
{
  "version": "1.0.0",
  "generated": "2024-01-15T10:30:00Z",
  "exports": {
    "createClient": {
      "kind": "function",
      "signature": "(options: ClientOptions) => Client",
      "params": ["options"],
      "returnType": "Client"
    },
    "Client": {
      "kind": "class",
      "methods": ["fetch", "post", "delete"],
      "properties": ["baseUrl", "headers"]
    }
  }
}
```

## Diff Output

```
$ doccov snapshot --compare api-baseline.json

API Snapshot Comparison
=======================

BREAKING CHANGES (3):
  - removed: fetchUser()
  - changed: createClient() - new required param 'apiKey'
  - changed: Client.fetch() - return type changed from Promise<Response> to Promise<Data>

NON-BREAKING (2):
  + added: createAdminClient()
  + added: Client.patch()

Run with --allow-breaking to accept these changes.
Exit code: 1
```

## GitHub Action Integration

```yaml
# .github/workflows/api-check.yml
- name: Check API Compatibility
  run: doccov snapshot --compare api-baseline.json

- name: Update Snapshot (on merge to main)
  if: github.ref == 'refs/heads/main'
  run: |
    doccov snapshot --update api-baseline.json
    git commit -am "chore: update API snapshot"
```

## Implementation

### SDK: Snapshot Types

```typescript
// packages/sdk/src/snapshot/types.ts
export interface ApiSnapshot {
  version: string;
  generated: string;
  packageName: string;
  exports: Record<string, ExportSnapshot>;
}

export interface ExportSnapshot {
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';
  signature?: string;
  params?: string[];
  returnType?: string;
  methods?: string[];
  properties?: string[];
}

export interface SnapshotDiff {
  breaking: BreakingChange[];
  nonBreaking: NonBreakingChange[];
  unchanged: string[];
}

export type BreakingChange =
  | { type: 'removed'; name: string }
  | { type: 'signature-changed'; name: string; old: string; new: string }
  | { type: 'required-param-added'; name: string; param: string };
```

### SDK: Core Functions

```typescript
// packages/sdk/src/snapshot/index.ts
export function generateSnapshot(spec: Spec): ApiSnapshot;
export function diffSnapshots(baseline: ApiSnapshot, current: ApiSnapshot): SnapshotDiff;
export function hasBreakingChanges(diff: SnapshotDiff): boolean;
```

## Use Cases

1. **CI/CD Pipeline**: Fail builds that accidentally remove public exports
2. **PR Reviews**: Auto-comment with API changes for reviewer visibility
3. **Changelog Generation**: Use diff to generate "Breaking Changes" section
4. **SemVer Validation**: Detect when a patch release has breaking changes

## Acceptance Criteria

- [ ] `doccov snapshot --save` generates snapshot file
- [ ] `doccov snapshot --compare` detects breaking vs non-breaking changes
- [ ] `doccov snapshot --update` updates existing snapshot
- [ ] Exit code 1 if breaking changes detected (without --allow-breaking)
- [ ] `--allow-breaking` flag bypasses breaking change failure
- [ ] Human-readable diff output with categorized changes
- [ ] JSON output option for programmatic use
- [ ] Documentation in `docs/cli/commands/snapshot.md`
