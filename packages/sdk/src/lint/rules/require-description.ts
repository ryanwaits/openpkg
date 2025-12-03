import type { SpecExport } from '@openpkg-ts/spec';
import type { LintRule, LintViolation } from '../types';

export const requireDescription: LintRule = {
  name: 'require-description',
  defaultSeverity: 'warn',

  check(exp: SpecExport): LintViolation[] {
    if (!exp.description || exp.description.trim() === '') {
      return [
        {
          rule: 'require-description',
          severity: 'warn',
          message: `Export '${exp.name}' is missing a description`,
          fixable: false,
        },
      ];
    }
    return [];
  },
};

