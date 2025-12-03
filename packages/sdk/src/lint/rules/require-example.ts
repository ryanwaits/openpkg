import type { SpecExport } from '@openpkg-ts/spec';
import type { LintRule, LintViolation } from '../types';

export const requireExample: LintRule = {
  name: 'require-example',
  defaultSeverity: 'off',

  check(exp: SpecExport): LintViolation[] {
    // Only check functions/methods
    if (exp.kind !== 'function' && exp.kind !== 'method') {
      return [];
    }

    if (!exp.examples || exp.examples.length === 0) {
      return [
        {
          rule: 'require-example',
          severity: 'warn',
          message: `Function '${exp.name}' is missing an @example`,
          fixable: false,
        },
      ];
    }
    return [];
  },
};

