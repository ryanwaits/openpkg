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

export const docCovConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  plugins: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  plugins: z.array(z.unknown()).optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
});

export type DocCovConfigInput = z.infer<typeof docCovConfigSchema>;

export interface DocsConfig {
  include?: string[];
  exclude?: string[];
}

export interface NormalizedDocCovConfig {
  include?: string[];
  exclude?: string[];
  plugins?: unknown[];
  docs?: DocsConfig;
}

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

  return {
    include,
    exclude,
    plugins: input.plugins,
    docs,
  };
};
