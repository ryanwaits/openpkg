import type { SpecExport } from '@openpkg-ts/spec';
import type { JSDocPatch } from '../fix';

export type LintSeverity = 'error' | 'warn' | 'off';

export interface LintViolation {
  rule: string;
  severity: 'error' | 'warn';
  message: string;
  line?: number;
  fixable: boolean;
}

export interface LintRule {
  name: string;
  defaultSeverity: LintSeverity;
  check(exp: SpecExport, rawJSDoc?: string): LintViolation[];
  fix?(exp: SpecExport, rawJSDoc?: string): JSDocPatch | null;
}

export interface LintConfig {
  rules: Record<string, LintSeverity>;
}

export interface LintResult {
  violations: LintViolation[];
  errorCount: number;
  warningCount: number;
  fixableCount: number;
}
