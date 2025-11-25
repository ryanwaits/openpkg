export interface DocCovOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
  resolveExternalTypes?: boolean;
}

export type NormalizedDocCovOptions = DocCovOptions & {
  includePrivate: boolean;
  followImports: boolean;
};

const DEFAULT_OPTIONS: Pick<NormalizedDocCovOptions, 'includePrivate' | 'followImports'> = {
  includePrivate: false,
  followImports: true,
};

export function normalizeDocCovOptions(options: DocCovOptions = {}): NormalizedDocCovOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

/** @deprecated Use DocCovOptions instead */
export type OpenPkgOptions = DocCovOptions;
/** @deprecated Use NormalizedDocCovOptions instead */
export type NormalizedOpenPkgOptions = NormalizedDocCovOptions;
/** @deprecated Use normalizeDocCovOptions instead */
export const normalizeOpenPkgOptions: typeof normalizeDocCovOptions = normalizeDocCovOptions;
