export interface DocCovOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
  resolveExternalTypes?: boolean;
}

export type NormalizedDocCovOptions = DocCovOptions & {
  includePrivate: boolean;
  followImports: boolean;
  maxDepth: number;
};

/** Default max depth for type conversion (matches TypeDoc's approach) */
export const DEFAULT_MAX_TYPE_DEPTH = 20;

const DEFAULT_OPTIONS: Pick<
  NormalizedDocCovOptions,
  'includePrivate' | 'followImports' | 'maxDepth'
> = {
  includePrivate: false,
  followImports: true,
  maxDepth: DEFAULT_MAX_TYPE_DEPTH,
};

export function normalizeDocCovOptions(options: DocCovOptions = {}): NormalizedDocCovOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_TYPE_DEPTH,
  };
}

/** @deprecated Use DocCovOptions instead */
export type OpenPkgOptions = DocCovOptions;
/** @deprecated Use NormalizedDocCovOptions instead */
export type NormalizedOpenPkgOptions = NormalizedDocCovOptions;
/** @deprecated Use normalizeDocCovOptions instead */
export const normalizeOpenPkgOptions: typeof normalizeDocCovOptions = normalizeDocCovOptions;
