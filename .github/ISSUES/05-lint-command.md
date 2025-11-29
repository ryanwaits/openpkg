# `doccov lint`: Documentation Style Enforcement

**Priority:** P5
**Phase:** 10D
**Labels:** `enhancement`, `cli`, `sdk`

## Summary

Add a lint command for enforcing documentation style and quality rules. Like ESLint but for JSDoc.

## Proposed CLI

```bash
# Lint with default rules
doccov lint

# Lint with config
doccov lint --config .doccov-lint.json

# Auto-fix lint issues
doccov lint --fix

# Only specific rules
doccov lint --rule require-description --rule no-empty-returns
```

## Default Rules

| Rule | Description | Default | Fixable |
|------|-------------|---------|---------|
| `require-description` | All exports must have description | warn | no |
| `require-param-description` | `@param` must have description | off | no |
| `require-returns-description` | `@returns` must have description | off | no |
| `require-example` | All functions must have `@example` | off | no |
| `no-empty-returns` | `@returns` without description | warn | no |
| `consistent-param-style` | Enforce `@param name -` format | off | yes |
| `no-trailing-period` | No period at end of descriptions | off | yes |
| `max-description-length` | Limit description length | off (100) | no |
| `require-since` | Require `@since` tag | off | no |

## Configuration

```json
// .doccov-lint.json
{
  "rules": {
    "require-description": "error",
    "require-example": "warn",
    "max-description-length": ["warn", { "max": 120 }],
    "no-trailing-period": "off"
  },
  "exclude": ["**/internal/**"]
}
```

Or in `doccov.config.ts`:

```typescript
export default {
  lint: {
    rules: {
      'require-description': 'error',
      'require-example': 'warn'
    }
  }
};
```

## Example Output

```
$ doccov lint

src/client.ts
  12:1  warning  Missing description for export 'createClient'  require-description
  24:3  warning  @returns has no description                    no-empty-returns

src/utils.ts
  5:1   error    Missing description for export 'formatDate'    require-description
  5:15  warning  @param 'date' has no description               require-param-description

3 warnings, 1 error
```

## Implementation

### SDK: Rule Engine

```typescript
// packages/sdk/src/lint/rules.ts
export interface LintRule {
  name: string;
  check(export: SpecExport): LintViolation[];
  fix?(export: SpecExport): JSDocPatch;  // optional
}

export interface LintViolation {
  rule: string;
  severity: 'error' | 'warn';
  message: string;
  line?: number;
  fixable: boolean;
}
```

## Acceptance Criteria

- [ ] `doccov lint` command implemented
- [ ] Configurable rules via config file
- [ ] Severity levels: error, warn, off
- [ ] `--fix` for auto-fixable rules
- [ ] Exit code 1 if any errors
- [ ] Per-export and per-file output formatting
- [ ] Rule documentation in `docs/cli/commands/lint.md`
