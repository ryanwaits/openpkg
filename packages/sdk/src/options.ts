export interface OpenPkgOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
  resolveExternalTypes?: boolean;
}

export type NormalizedOpenPkgOptions = OpenPkgOptions & {
  includePrivate: boolean;
  followImports: boolean;
};

const DEFAULT_OPTIONS: Pick<NormalizedOpenPkgOptions, 'includePrivate' | 'followImports'> = {
  includePrivate: false,
  followImports: true,
};

export function normalizeOpenPkgOptions(options: OpenPkgOptions = {}): NormalizedOpenPkgOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}
