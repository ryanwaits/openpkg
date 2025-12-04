import type { SpecExport } from '@openpkg-ts/spec';
import type { JSDocPatch } from '../../fix';
import { parseJSDocToPatch } from '../../fix';
import type { LintRule, LintViolation } from '../types';

export const consistentParamStyle: LintRule = {
  name: 'consistent-param-style',
  defaultSeverity: 'off',

  check(_exp: SpecExport, rawJSDoc?: string): LintViolation[] {
    if (!rawJSDoc) return [];

    const violations: LintViolation[] = [];

    // Find all @param tags and check their format
    // Expected format: @param {type} name - description (with dash separator)
    const paramRegex = /@param\s+(?:\{[^}]+\}\s+)?(\S+)\s+([^@\n]+)/g;
    let match: RegExpExecArray | null;

    while ((match = paramRegex.exec(rawJSDoc)) !== null) {
      const paramName = match[1];
      const rest = match[2].trim();

      // Check if description exists and doesn't start with dash
      if (rest && !rest.startsWith('-') && !rest.startsWith('–')) {
        violations.push({
          rule: 'consistent-param-style',
          severity: 'warn',
          message: `Parameter '${paramName}' should use dash separator: @param ${paramName} - description`,
          fixable: true,
        });
      }
    }

    return violations;
  },

  fix(_exp: SpecExport, rawJSDoc?: string): JSDocPatch | null {
    if (!rawJSDoc) return null;

    // Parse and re-serialize - serializeJSDoc always outputs with dash separator
    const patch = parseJSDocToPatch(rawJSDoc);
    if (!patch.params || patch.params.length === 0) return null;

    return patch;
  },
};
