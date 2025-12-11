import type { SpecExportKind } from '@openpkg-ts/spec';
import { parseJSDocToPatch } from '../fix/jsdoc-writer';
import type { QualityRule, QualitySeverity, RuleContext } from './types';

/**
 * Core quality rules - these affect coverage score.
 */
export const CORE_RULES: QualityRule[] = [
  {
    id: 'has-description',
    name: 'Has Description',
    description: 'Export has a description comment',
    affectsCoverage: true,
    defaultSeverity: 'warn',

    check(ctx: RuleContext): boolean {
      return Boolean(ctx.export.description?.trim());
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'has-description',
        severity: 'warn' as const,
        message: `Export '${ctx.export.name}' is missing a description`,
        fixable: false,
      };
    },
  },

  {
    id: 'has-params',
    name: 'Has Parameters',
    description: 'All parameters are documented',
    appliesTo: ['function'] as SpecExportKind[],
    affectsCoverage: true,
    defaultSeverity: 'off',

    check(ctx: RuleContext): boolean {
      const parameters = (ctx.export.signatures ?? []).flatMap((sig) => sig.parameters ?? []);
      if (parameters.length === 0) return true;
      return parameters.every((p) => Boolean(p.description?.trim()));
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'has-params',
        severity: 'warn' as const,
        message: `Function '${ctx.export.name}' has undocumented parameters`,
        fixable: true,
      };
    },
  },

  {
    id: 'has-returns',
    name: 'Has Returns',
    description: 'Return value is documented',
    appliesTo: ['function'] as SpecExportKind[],
    affectsCoverage: true,
    defaultSeverity: 'off',

    check(ctx: RuleContext): boolean {
      const signatures = ctx.export.signatures ?? [];
      if (signatures.length === 0) return true;

      return signatures.every((sig) => {
        const text = sig.returns?.description;
        return Boolean(text?.trim());
      });
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'has-returns',
        severity: 'warn' as const,
        message: `Function '${ctx.export.name}' has undocumented return value`,
        fixable: true,
      };
    },
  },

  {
    id: 'has-examples',
    name: 'Has Examples',
    description: 'Export has at least one @example',
    appliesTo: ['function', 'class'] as SpecExportKind[],
    affectsCoverage: true,
    defaultSeverity: 'off',

    check(ctx: RuleContext): boolean {
      return Boolean(ctx.export.examples?.length);
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'has-examples',
        severity: 'warn' as const,
        message: `Export '${ctx.export.name}' is missing an @example`,
        fixable: false,
      };
    },
  },
];

/**
 * Style rules - these don't affect coverage, only lint.
 */
export const STYLE_RULES: QualityRule[] = [
  {
    id: 'no-empty-returns',
    name: 'No Empty Returns',
    description: '@returns tag must have a description',
    appliesTo: ['function'] as SpecExportKind[],
    affectsCoverage: false,
    defaultSeverity: 'warn',

    check(ctx: RuleContext): boolean {
      if (!ctx.rawJSDoc) return true;

      // Check for @returns or @return tag with no description
      const returnsMatch = ctx.rawJSDoc.match(/@returns?\s*(?:\{[^}]*\})?\s*$/m);
      if (returnsMatch) return false;

      // Also check for @returns {type} with nothing after
      const returnsTypeOnly = ctx.rawJSDoc.match(/@returns?\s+\{[^}]+\}\s*$/m);
      if (returnsTypeOnly) return false;

      return true;
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'no-empty-returns',
        severity: 'warn' as const,
        message: `Export '${ctx.export.name}' has @returns without a description`,
        fixable: false,
      };
    },
  },

  {
    id: 'consistent-param-style',
    name: 'Consistent Param Style',
    description: '@param tags use dash separator',
    appliesTo: ['function'] as SpecExportKind[],
    affectsCoverage: false,
    defaultSeverity: 'off',

    check(ctx: RuleContext): boolean {
      if (!ctx.rawJSDoc) return true;

      // Find all @param tags and check their format
      const paramRegex = /@param\s+(?:\{[^}]+\}\s+)?(\S+)\s+([^@\n]+)/g;
      const matches = ctx.rawJSDoc.matchAll(paramRegex);

      for (const match of matches) {
        const rest = match[2]?.trim();
        if (rest && !rest.startsWith('-') && !rest.startsWith('–')) {
          return false;
        }
      }

      return true;
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'consistent-param-style',
        severity: 'warn' as const,
        message: `Export '${ctx.export.name}' has @param without dash separator`,
        fixable: true,
      };
    },

    fix(ctx: RuleContext) {
      if (!ctx.rawJSDoc) return null;

      // Parse and re-serialize - serializeJSDoc always outputs with dash separator
      const patch = parseJSDocToPatch(ctx.rawJSDoc);
      if (!patch.params || patch.params.length === 0) return null;

      return patch;
    },
  },
];

/**
 * All built-in quality rules.
 */
export const BUILTIN_RULES: QualityRule[] = [...CORE_RULES, ...STYLE_RULES];

/**
 * Get rules that affect coverage calculation.
 */
export function getCoverageRules(): QualityRule[] {
  return BUILTIN_RULES.filter((r) => r.affectsCoverage);
}

/**
 * Get rules applicable to a specific export kind.
 */
export function getRulesForKind(kind: SpecExportKind): QualityRule[] {
  return BUILTIN_RULES.filter((r) => {
    if (!r.appliesTo) return true;
    return r.appliesTo.includes(kind);
  });
}

/**
 * Get a rule by ID.
 */
export function getRule(id: string): QualityRule | undefined {
  return BUILTIN_RULES.find((r) => r.id === id);
}

/**
 * Get default configuration with all rule defaults.
 */
export function getDefaultConfig(): Record<string, QualitySeverity> {
  const config: Record<string, QualitySeverity> = {};
  for (const rule of BUILTIN_RULES) {
    config[rule.id] = rule.defaultSeverity;
  }
  return config;
}
