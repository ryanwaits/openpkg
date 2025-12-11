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

/** Quality rule severity levels */
const severitySchema: z.ZodEnum<['error', 'warn', 'off']> = z.enum(['error', 'warn', 'off']);

/** Example validation mode */
const exampleModeSchema: z.ZodEnum<['presence', 'typecheck', 'run']> = z.enum([
  'presence',
  'typecheck',
  'run',
]);

/** Example validation modes - can be single, array, or comma-separated */
const exampleModesSchema: z.ZodUnion<
  [typeof exampleModeSchema, z.ZodArray<typeof exampleModeSchema>, z.ZodString]
> = z.union([
  exampleModeSchema,
  z.array(exampleModeSchema),
  z.string(), // For comma-separated values like "presence,typecheck"
]);

/**
 * Check command configuration schema.
 */
const checkConfigSchema: z.ZodObject<{
  examples: z.ZodOptional<typeof exampleModesSchema>;
  minCoverage: z.ZodOptional<z.ZodNumber>;
  maxDrift: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  /**
   * Example validation modes: presence | typecheck | run
   * Can be single value, array, or comma-separated string
   */
  examples: exampleModesSchema.optional(),
  /** Minimum coverage percentage required (0-100) */
  minCoverage: z.number().min(0).max(100).optional(),
  /** Maximum drift percentage allowed (0-100) */
  maxDrift: z.number().min(0).max(100).optional(),
});

/**
 * Quality rules configuration schema
 */
const qualityConfigSchema: z.ZodObject<{
  rules: z.ZodOptional<z.ZodRecord<z.ZodString, typeof severitySchema>>;
}> = z.object({
  /** Rule severity overrides */
  rules: z.record(severitySchema).optional(),
});

export const docCovConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  plugins: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
  check: z.ZodOptional<typeof checkConfigSchema>;
  quality: z.ZodOptional<typeof qualityConfigSchema>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  plugins: z.array(z.unknown()).optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
  /** Check command configuration */
  check: checkConfigSchema.optional(),
  /** Quality rules configuration */
  quality: qualityConfigSchema.optional(),
});

import type { CheckConfig, DocCovConfig, DocsConfig, QualityRulesConfig } from '@doccov/sdk';

export type DocCovConfigInput = z.infer<typeof docCovConfigSchema>;

// Re-export types from SDK
export type { CheckConfig, DocsConfig, QualityRulesConfig };

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
      examples: input.check.examples,
      minCoverage: input.check.minCoverage,
      maxDrift: input.check.maxDrift,
    };
  }

  let quality: QualityRulesConfig | undefined;
  if (input.quality) {
    quality = {
      rules: input.quality.rules,
    };
  }

  return {
    include,
    exclude,
    plugins: input.plugins,
    docs,
    check,
    quality,
  };
};
