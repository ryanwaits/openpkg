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

/**
 * Check command configuration schema
 */
const checkConfigSchema: z.ZodObject<{
  lint: z.ZodOptional<z.ZodBoolean>;
  typecheck: z.ZodOptional<z.ZodBoolean>;
  exec: z.ZodOptional<z.ZodBoolean>;
  minCoverage: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  /** Enable lint checks (default: true) */
  lint: z.boolean().optional(),
  /** Enable typecheck for examples (default: true) */
  typecheck: z.boolean().optional(),
  /** Enable runtime execution of examples (default: false) */
  exec: z.boolean().optional(),
  /** Minimum coverage percentage required (0-100) */
  minCoverage: z.number().min(0).max(100).optional(),
});

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
  lint: z.ZodOptional<typeof lintConfigSchema>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  plugins: z.array(z.unknown()).optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
  /** Check command configuration */
  check: checkConfigSchema.optional(),
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

  let check: CheckConfig | undefined;
  if (input.check) {
    check = {
      lint: input.check.lint,
      typecheck: input.check.typecheck,
      exec: input.check.exec,
      minCoverage: input.check.minCoverage,
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
