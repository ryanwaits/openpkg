import type { SpecExport, SpecExportKind, SpecSchema } from '@openpkg-ts/spec';
import { parseJSDocToPatch } from '../fix/jsdoc-writer';
import type { QualityRule, QualitySeverity, RuleContext } from './types';

/**
 * Built-in type names that should not trigger no-forgotten-export.
 */
const BUILTIN_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'any',
  'unknown',
  'void',
  'never',
  'null',
  'undefined',
  'symbol',
  'bigint',
  'Array',
  'Promise',
  'Map',
  'Set',
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'ReturnType',
  'Parameters',
  'InstanceType',
  'ConstructorParameters',
  'Awaited',
]);

/**
 * Extract type references from an export's schema/signatures/members.
 * Returns a set of type names that are referenced.
 */
function extractTypeReferences(exp: SpecExport): Set<string> {
  const refs = new Set<string>();

  function collectFromSchema(schema: SpecSchema | undefined): void {
    if (!schema) return;

    if (typeof schema === 'string') {
      // Simple type reference like "MyType" or "string"
      if (!BUILTIN_TYPES.has(schema)) {
        refs.add(schema);
      }
      return;
    }

    if (typeof schema === 'object') {
      const obj = schema as Record<string, unknown>;

      // Handle $ref: "#/types/TypeName"
      if (typeof obj.$ref === 'string') {
        const ref = obj.$ref as string;
        const name = ref.startsWith('#/types/') ? ref.slice('#/types/'.length) : ref;
        if (!BUILTIN_TYPES.has(name)) {
          refs.add(name);
        }
      }

      // Handle type property
      if (typeof obj.type === 'string' && !BUILTIN_TYPES.has(obj.type)) {
        refs.add(obj.type);
      }

      // Recurse into items (arrays)
      if (obj.items) {
        collectFromSchema(obj.items as SpecSchema);
      }

      // Recurse into properties (objects)
      if (obj.properties && typeof obj.properties === 'object') {
        for (const prop of Object.values(obj.properties as Record<string, SpecSchema>)) {
          collectFromSchema(prop);
        }
      }

      // Recurse into composite types
      if (Array.isArray(obj.anyOf)) {
        for (const item of obj.anyOf) {
          collectFromSchema(item as SpecSchema);
        }
      }
      if (Array.isArray(obj.oneOf)) {
        for (const item of obj.oneOf) {
          collectFromSchema(item as SpecSchema);
        }
      }
      if (Array.isArray(obj.allOf)) {
        for (const item of obj.allOf) {
          collectFromSchema(item as SpecSchema);
        }
      }

      // Handle additionalProperties
      if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
        collectFromSchema(obj.additionalProperties as SpecSchema);
      }
    }
  }

  // From signatures (function parameters and return types)
  for (const sig of exp.signatures ?? []) {
    for (const param of sig.parameters ?? []) {
      collectFromSchema(param.schema);
    }
    if (sig.returns?.schema) {
      collectFromSchema(sig.returns.schema);
    }
  }

  // From members (class/interface properties and methods)
  for (const member of exp.members ?? []) {
    collectFromSchema(member.schema);
    // Method signatures
    for (const sig of member.signatures ?? []) {
      for (const param of sig.parameters ?? []) {
        collectFromSchema(param.schema);
      }
      if (sig.returns?.schema) {
        collectFromSchema(sig.returns.schema);
      }
    }
  }

  // From export's own schema/type
  collectFromSchema(exp.schema);
  if (typeof exp.type === 'string' && !BUILTIN_TYPES.has(exp.type)) {
    refs.add(exp.type);
  }

  // From extends/implements
  if (exp.extends && !BUILTIN_TYPES.has(exp.extends)) {
    refs.add(exp.extends);
  }
  for (const impl of exp.implements ?? []) {
    if (!BUILTIN_TYPES.has(impl)) {
      refs.add(impl);
    }
  }

  return refs;
}

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
 * TSDoc Strictness rules - match API Extractor's TSDoc compliance.
 * These help maintain consistent, high-quality documentation.
 */
export const TSDOC_RULES: QualityRule[] = [
  {
    id: 'require-release-tag',
    name: 'Require Release Tag',
    description: 'All exports must have @public, @beta, @alpha, or @internal',
    affectsCoverage: false,
    defaultSeverity: 'off',

    check(ctx: RuleContext): boolean {
      const tags = ctx.export.tags ?? [];
      return tags.some((t) => ['public', 'beta', 'alpha', 'internal'].includes(t.name.toLowerCase()));
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'require-release-tag',
        severity: 'warn' as const,
        message: `Export '${ctx.export.name}' is missing a release tag (@public, @beta, @alpha, or @internal)`,
        fixable: true,
      };
    },
  },

  {
    id: 'internal-underscore',
    name: 'Internal Underscore Prefix',
    description: '@internal exports should have underscore prefix',
    affectsCoverage: false,
    defaultSeverity: 'off',

    check(ctx: RuleContext): boolean {
      const tags = ctx.export.tags ?? [];
      const isInternal = tags.some((t) => t.name.toLowerCase() === 'internal');
      if (!isInternal) return true;
      return ctx.export.name.startsWith('_');
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'internal-underscore',
        severity: 'warn' as const,
        message: `Internal export '${ctx.export.name}' should have underscore prefix (_${ctx.export.name})`,
        fixable: false,
      };
    },
  },

  {
    id: 'no-conflicting-tags',
    name: 'No Conflicting Tags',
    description: 'Cannot have both @internal and @public/@beta/@alpha',
    affectsCoverage: false,
    defaultSeverity: 'warn',

    check(ctx: RuleContext): boolean {
      const tags = ctx.export.tags ?? [];
      const tagNames = tags.map((t) => t.name.toLowerCase());
      const hasInternal = tagNames.includes('internal');
      const hasPublicish = tagNames.some((n) => ['public', 'beta', 'alpha'].includes(n));
      return !(hasInternal && hasPublicish);
    },

    getViolation(ctx: RuleContext) {
      return {
        ruleId: 'no-conflicting-tags',
        severity: 'error' as const,
        message: `Export '${ctx.export.name}' has conflicting release tags (@internal with @public/@beta/@alpha)`,
        fixable: false,
      };
    },
  },

  {
    id: 'no-forgotten-export',
    name: 'No Forgotten Export',
    description: 'All referenced types must be exported',
    affectsCoverage: false,
    defaultSeverity: 'off', // Off by default since it can be noisy

    check(ctx: RuleContext): boolean {
      // Can't check without spec-level context
      if (!ctx.exportRegistry) return true;

      const refs = extractTypeReferences(ctx.export);
      for (const ref of refs) {
        if (!ctx.exportRegistry.has(ref)) {
          return false;
        }
      }
      return true;
    },

    getViolation(ctx: RuleContext) {
      const refs = extractTypeReferences(ctx.export);
      const missing = ctx.exportRegistry
        ? [...refs].filter((r) => !ctx.exportRegistry!.has(r))
        : [];

      return {
        ruleId: 'no-forgotten-export',
        severity: 'warn' as const,
        message:
          missing.length > 0
            ? `Export '${ctx.export.name}' references unexported types: ${missing.join(', ')}`
            : `Export '${ctx.export.name}' references types that are not exported`,
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
export const BUILTIN_RULES: QualityRule[] = [...CORE_RULES, ...TSDOC_RULES, ...STYLE_RULES];

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
