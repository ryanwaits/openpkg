import { z } from 'zod';

const stringList: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, 'many'>]> = z.union([
  z.string(),
  z.array(z.string()),
]);

/**
 * Docs configuration schema
 */
const docsConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
}> = z.object({
  /** Glob patterns for markdown docs to include */
  include: stringList.optional(),
  /** Glob patterns for markdown docs to exclude */
  exclude: stringList.optional(),
});

/** Lint severity levels */
const lintSeveritySchema: z.ZodEnum<['error', 'warn', 'off']> = z.enum(['error', 'warn', 'off']);

/** Example validation mode */
const exampleModeSchema: z.ZodEnum<['exist', 'types', 'run']> = z.enum(['exist', 'types', 'run']);

/**
 * Check command configuration schema (unified config)
 * Supports both 'check' (preferred) and 'analyze' (deprecated) for backwards compatibility
 */
const checkConfigSchema: z.ZodObject<{
  lint: z.ZodOptional<z.ZodBoolean>;
  examples: z.ZodOptional<typeof exampleModeSchema>;
  minCoverage: z.ZodOptional<z.ZodNumber>;
  // Legacy options for backwards compatibility
  typecheck: z.ZodOptional<z.ZodBoolean>;
  exec: z.ZodOptional<z.ZodBoolean>;
}> = z.object({
  /** Enable lint checks (default: true) */
  lint: z.boolean().optional(),
  /** Example validation mode: exist | types | run (default: types) */
  examples: exampleModeSchema.optional(),
  /** Minimum coverage percentage required (0-100) */
  minCoverage: z.number().min(0).max(100).optional(),
  // Legacy options - will be converted to examples mode
  /** @deprecated Use examples: 'types' instead */
  typecheck: z.boolean().optional(),
  /** @deprecated Use examples: 'run' instead */
  exec: z.boolean().optional(),
});

// Alias for backwards compatibility
const analyzeConfigSchema = checkConfigSchema;

/**
 * Lint configuration schema
 */
const lintConfigSchema: z.ZodObject<{
  rules: z.ZodOptional<z.ZodRecord<z.ZodString, typeof lintSeveritySchema>>;
}> = z.object({
  /** Rule severity overrides */
  rules: z.record(lintSeveritySchema).optional(),
});

export const docCovConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  plugins: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
  check: z.ZodOptional<typeof checkConfigSchema>;
  analyze: z.ZodOptional<typeof analyzeConfigSchema>;
  lint: z.ZodOptional<typeof lintConfigSchema>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  plugins: z.array(z.unknown()).optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
  /** Check command configuration (preferred) */
  check: checkConfigSchema.optional(),
  /** @deprecated Use check instead. Analyze is a backwards compatible alias */
  analyze: analyzeConfigSchema.optional(),
  /** Lint configuration */
  lint: lintConfigSchema.optional(),
});

import type { CheckConfig, DocCovConfig, DocsConfig, LintRulesConfig } from '@doccov/sdk';

export type DocCovConfigInput = z.infer<typeof docCovConfigSchema>;

// Re-export types from SDK for backwards compatibility
export type { CheckConfig, DocsConfig, LintRulesConfig };

// NormalizedDocCovConfig is the same as DocCovConfig from SDK
export type NormalizedDocCovConfig = DocCovConfig;

const normalizeList = (value?: string | string[]): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list.map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeConfig = (input: DocCovConfigInput): NormalizedDocCovConfig => {
  const include = normalizeList(input.include);
  const exclude = normalizeList(input.exclude);

  let docs: DocsConfig | undefined;
  if (input.docs) {
    const docsInclude = normalizeList(input.docs.include);
    const docsExclude = normalizeList(input.docs.exclude);
    if (docsInclude || docsExclude) {
      docs = {
        include: docsInclude,
        exclude: docsExclude,
      };
    }
  }

  // Support both check (preferred) and analyze (deprecated) config sections
  // check takes precedence if both are provided
  const checkInput = input.check ?? input.analyze;
  let check: CheckConfig | undefined;
  if (checkInput) {
    check = {
      lint: checkInput.lint,
      // Convert new examples mode to legacy typecheck/exec for SDK compatibility
      typecheck: checkInput.examples === 'exist' ? false : checkInput.typecheck,
      exec: checkInput.examples === 'run' ? true : checkInput.exec,
      minCoverage: checkInput.minCoverage,
    };
  }

  let lint: LintRulesConfig | undefined;
  if (input.lint) {
    lint = {
      rules: input.lint.rules,
    };
  }

  return {
    include,
    exclude,
    plugins: input.plugins,
    docs,
    check,
    lint,
  };
};
