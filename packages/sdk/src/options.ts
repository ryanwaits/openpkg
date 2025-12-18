export interface DocCovOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
  resolveExternalTypes?: boolean;
  /** Enable spec caching (default: true) */
  useCache?: boolean;
  /** Working directory for cache operations (default: process.cwd()) */
  cwd?: string;
}

export type NormalizedDocCovOptions = DocCovOptions & {
  includePrivate: boolean;
  followImports: boolean;
  maxDepth: number;
  useCache: boolean;
  cwd: string;
};

/** Default max depth for type conversion (matches TypeDoc's approach) */
export const DEFAULT_MAX_TYPE_DEPTH = 20;

const DEFAULT_OPTIONS: Pick<
  NormalizedDocCovOptions,
  'includePrivate' | 'followImports' | 'maxDepth' | 'useCache'
> = {
  includePrivate: false,
  followImports: true,
  maxDepth: DEFAULT_MAX_TYPE_DEPTH,
  useCache: true,
};

export function normalizeDocCovOptions(options: DocCovOptions = {}): NormalizedDocCovOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_TYPE_DEPTH,
    useCache: options.useCache ?? true,
    cwd: options.cwd ?? process.cwd(),
  };
}
