import { z } from 'zod';

const stringList: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, 'many'>]> = z.union([
  z.string(),
  z.array(z.string()),
]);

export const docCovConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  plugins: z.ZodOptional<z.ZodArray<z.ZodUnknown, 'many'>>;
}> = z.object({
  include: stringList.optional(),
  exclude: stringList.optional(),
  plugins: z.array(z.unknown()).optional(),
});

export type DocCovConfigInput = z.infer<typeof docCovConfigSchema>;

export interface NormalizedDocCovConfig {
  include?: string[];
  exclude?: string[];
  plugins?: unknown[];
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

  return {
    include,
    exclude,
    plugins: input.plugins,
  };
};
