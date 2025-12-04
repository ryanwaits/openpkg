import type { SpecExport } from '@openpkg-ts/spec';
import type { LintRule, LintViolation } from '../types';

export const noEmptyReturns: LintRule = {
  name: 'no-empty-returns',
  defaultSeverity: 'warn',

  check(exp: SpecExport, rawJSDoc?: string): LintViolation[] {
    // Check if @returns tag exists but has no description
    if (!rawJSDoc) return [];

    // Look for @returns or @return tag
    const returnsMatch = rawJSDoc.match(/@returns?\s*(?:\{[^}]*\})?\s*$/m);
    if (returnsMatch) {
      // Tag exists but no description after optional type
      return [
        {
          rule: 'no-empty-returns',
          severity: 'warn',
          message: `Export '${exp.name}' has @returns without a description`,
          fixable: false,
        },
      ];
    }

    // Also check for @returns {type} with nothing after
    const returnsTypeOnly = rawJSDoc.match(/@returns?\s+\{[^}]+\}\s*$/m);
    if (returnsTypeOnly) {
      return [
        {
          rule: 'no-empty-returns',
          severity: 'warn',
          message: `Export '${exp.name}' has @returns without a description`,
          fixable: false,
        },
      ];
    }

    return [];
  },
};
