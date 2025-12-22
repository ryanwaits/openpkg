# Quality Rules

Rule-based documentation quality evaluation.

## Overview

```typescript
import { evaluateExportQuality, CORE_RULES, TSDOC_RULES } from '@doccov/sdk';

const result = evaluateExportQuality(exportData, rawJSDoc, {
  rules: { 'has-description': 'error', 'has-examples': 'warn' }
});
```

## Rule Categories

### Core Rules (Affect Coverage)

| Rule ID | Description |
|---------|-------------|
| `has-description` | Export has description comment |
| `has-params` | Function parameters are documented |
| `has-returns` | Return value is documented |
| `has-examples` | Has @example block |

### TSDoc Rules

| Rule ID | Description |
|---------|-------------|
| `require-release-tag` | Has @public/@beta/@alpha/@internal |
| `internal-underscore` | @internal exports start with _ |
| `no-conflicting-tags` | No @internal + @public mixed |
| `no-forgotten-export` | Referenced types are exported |

## Configuration

```typescript
interface QualityConfig {
  rules?: Record<string, QualitySeverity>;
}

type QualitySeverity = 'error' | 'warn' | 'off';
```

### Default Severities

```typescript
const defaults = {
  'has-description': 'error',
  'has-params': 'error',
  'has-returns': 'error',
  'has-examples': 'off',
  'require-release-tag': 'off',
  'internal-underscore': 'warn',
  'no-conflicting-tags': 'error',
  'no-forgotten-export': 'warn',
};
```

## Evaluation Result

```typescript
interface QualityResult {
  coverageScore: number;  // 0-100
  coverage: {
    satisfied: string[];   // Rule IDs that passed
    missing: string[];     // Rule IDs that failed
    applicable: string[];  // All applicable rules
  };
  violations: QualityViolation[];
  summary: {
    errorCount: number;
    warningCount: number;
    fixableCount: number;
  };
}

interface QualityViolation {
  ruleId: string;
  message: string;
  severity: QualitySeverity;
  fixable: boolean;
  fix?: JSDocPatch;
}
```

## Usage in Enrichment

```typescript
import { enrichSpec } from '@doccov/sdk';

const enriched = await enrichSpec(spec, {
  qualityConfig: {
    rules: {
      'has-description': 'error',
      'has-examples': 'warn',
      'require-release-tag': 'error',
    }
  }
});

// Each export now has:
// enriched.exports[i].docs.coverageScore
// enriched.exports[i].docs.missing (failed rule IDs)
```

## Custom Rules

Rules implement `QualityRule` interface:

```typescript
interface QualityRule {
  id: string;
  name: string;
  description: string;
  appliesTo?: SpecExportKind[];  // ['function', 'class']
  affectsCoverage: boolean;
  defaultSeverity: QualitySeverity;
  check(ctx: RuleContext): boolean;
  getViolation?(ctx: RuleContext): QualityViolation;
  fix?(ctx: RuleContext): JSDocPatch | null;
}
```

## Coverage Calculation

Coverage score = (satisfied rules / applicable rules) × 100

Only rules with `affectsCoverage: true` are counted.
