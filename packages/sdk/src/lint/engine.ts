import type { SpecExport } from '@openpkg-ts/spec';
import { consistentParamStyle, noEmptyReturns, requireDescription, requireExample } from './rules';
import type { LintConfig, LintResult, LintRule, LintSeverity, LintViolation } from './types';

/** All available lint rules */
export const allRules: LintRule[] = [
  requireDescription,
  requireExample,
  noEmptyReturns,
  consistentParamStyle,
];

/** Default configuration with rule defaults */
export function getDefaultConfig(): LintConfig {
  const rules: Record<string, LintSeverity> = {};
  for (const rule of allRules) {
    rules[rule.name] = rule.defaultSeverity;
  }
  return { rules };
}

/** Get a rule by name */
export function getRule(name: string): LintRule | undefined {
  return allRules.find((r) => r.name === name);
}

/** Lint a single export */
export function lintExport(
  exp: SpecExport,
  rawJSDoc?: string,
  config: LintConfig = getDefaultConfig(),
): LintViolation[] {
  const violations: LintViolation[] = [];

  for (const rule of allRules) {
    const severity = config.rules[rule.name];
    if (severity === 'off') continue;

    const ruleViolations = rule.check(exp, rawJSDoc);
    for (const v of ruleViolations) {
      violations.push({
        ...v,
        severity: severity === 'error' ? 'error' : 'warn',
      });
    }
  }

  return violations;
}

/** Lint multiple exports and aggregate results */
export function lintExports(
  exports: Array<{ export: SpecExport; rawJSDoc?: string }>,
  config: LintConfig = getDefaultConfig(),
): LintResult {
  const violations: LintViolation[] = [];

  for (const { export: exp, rawJSDoc } of exports) {
    violations.push(...lintExport(exp, rawJSDoc, config));
  }

  return {
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warn').length,
    fixableCount: violations.filter((v) => v.fixable).length,
  };
}

/** Merge user config with defaults */
export function mergeConfig(userConfig: Partial<LintConfig>): LintConfig {
  const defaults = getDefaultConfig();
  return {
    rules: {
      ...defaults.rules,
      ...userConfig.rules,
    },
  };
}
