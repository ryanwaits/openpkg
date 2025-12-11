# Diffing

Compare two OpenPkg specs to detect changes in API and documentation.

## Usage

```typescript
import { diffSpec } from '@openpkg-ts/spec';

const oldSpec = JSON.parse(fs.readFileSync('old.json', 'utf-8'));
const newSpec = JSON.parse(fs.readFileSync('new.json', 'utf-8'));

const diff = diffSpec(oldSpec, newSpec);
```

## SpecDiff Type

```typescript
type SpecDiff = {
  // Structural changes
  breaking: string[];      // Removed exports
  nonBreaking: string[];   // Added exports
  docsOnly: string[];      // Only docs changed
  
  // Coverage delta
  coverageDelta: number;   // e.g., +5 or -3
  oldCoverage: number;     // e.g., 80
  newCoverage: number;     // e.g., 85
  
  // Docs health changes
  newUndocumented: string[];    // New exports without docs
  improvedExports: string[];    // Exports with better coverage
  regressedExports: string[];   // Exports with worse coverage
  driftIntroduced: number;      // New drift issues
  driftResolved: number;        // Fixed drift issues
};
```

## Examples

### Basic Diff

```typescript
const diff = diffSpec(oldSpec, newSpec);

console.log(`Coverage: ${diff.oldCoverage}% → ${diff.newCoverage}%`);
console.log(`Delta: ${diff.coverageDelta > 0 ? '+' : ''}${diff.coverageDelta}%`);
```

### Check for Breaking Changes

```typescript
if (diff.breaking.length > 0) {
  console.log('Breaking changes:');
  for (const id of diff.breaking) {
    console.log(`  - Removed: ${id}`);
  }
}
```

### Check for New Undocumented Exports

```typescript
if (diff.newUndocumented.length > 0) {
  console.log('New exports need documentation:');
  for (const id of diff.newUndocumented) {
    console.log(`  - ${id}`);
  }
}
```

### Check Drift Changes

```typescript
if (diff.driftIntroduced > 0) {
  console.log(`⚠️ ${diff.driftIntroduced} new drift issues introduced`);
}

if (diff.driftResolved > 0) {
  console.log(`✓ ${diff.driftResolved} drift issues resolved`);
}
```

## CLI Usage

Compare specs from command line:

```bash
doccov diff old.json new.json
```

Output format options:

```bash
# Human-readable text (default)
doccov diff old.json new.json --format text

# JSON output
doccov diff old.json new.json --format json
```

Fail on regression:

```bash
doccov diff old.json new.json --fail-on-regression
```

Fail on new drift:

```bash
doccov diff old.json new.json --fail-on-drift
```

## Change Categories

### Breaking Changes

Exports that were removed or had incompatible signature changes:

```typescript
// Old: export function getUser(id: string): User
// New: (removed)
diff.breaking // ['getUser']
```

### Non-Breaking Changes

New exports added:

```typescript
// New: export function createUser(name: string): User
diff.nonBreaking // ['createUser']
```

### Docs-Only Changes

Only documentation changed, not the API:

```typescript
// Old: export function getUser(id: string): User
// New: /** Gets a user by ID */ export function getUser(id: string): User
diff.docsOnly // ['getUser']
```

## Use Cases

### CI/CD Pipeline

```yaml
- name: Check docs regression
  run: |
    doccov spec -o new.json
    doccov diff openpkg.json new.json --fail-on-regression
```

### PR Comments

```typescript
const diff = diffSpec(baseSpec, headSpec);

let comment = `## DocCov Report\n\n`;
comment += `Coverage: ${diff.oldCoverage}% → ${diff.newCoverage}%\n`;

if (diff.newUndocumented.length > 0) {
  comment += `\n⚠️ ${diff.newUndocumented.length} new undocumented exports\n`;
}
```

### Version Comparison

```typescript
// Compare v1.0.0 to v2.0.0
const v1Spec = await fetchSpec('v1.0.0');
const v2Spec = await fetchSpec('v2.0.0');
const diff = diffSpec(v1Spec, v2Spec);

console.log(`Breaking changes: ${diff.breaking.length}`);
console.log(`New exports: ${diff.nonBreaking.length}`);
```

## Local Testing

```bash
# Generate two specs
bun run packages/cli/src/cli.ts spec tests/fixtures/v1 -o /tmp/v1.json
bun run packages/cli/src/cli.ts spec tests/fixtures/v2 -o /tmp/v2.json

# Diff them
bun run packages/cli/src/cli.ts diff /tmp/v1.json /tmp/v2.json
```

## See Also

- [diff Command](../cli/commands/diff.md) - CLI reference
- [Types Reference](./types.md) - `SpecDiff` type
- [GitHub Action](../integrations/github-action.md) - PR integration

