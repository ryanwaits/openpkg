/**
 * Release stage/visibility tags that can be used for filtering.
 * Based on TSDoc release tags.
 */
export type ReleaseTag = 'public' | 'beta' | 'alpha' | 'internal';

export interface FilterOptions {
  /** Include exports matching these patterns */
  include?: string[];
  /** Exclude exports matching these patterns */
  exclude?: string[];
  /** Filter by visibility/release stage (e.g., ['public', 'beta']) */
  visibility?: ReleaseTag[];
}

export type FilterSeverity = 'info' | 'warning' | 'error';

export interface FilterDiagnostic {
  message: string;
  severity: FilterSeverity;
  target?: 'export' | 'type';
  identifier?: string;
}

export interface FilterResult<TSpec> {
  spec: TSpec;
  diagnostics: FilterDiagnostic[];
  changed: boolean;
}

export const hasFilters = (options?: FilterOptions | null): options is FilterOptions => {
  if (!options) {
    return false;
  }
  const { include, exclude, visibility } = options;
  return Boolean(
    (include && include.length > 0) ||
      (exclude && exclude.length > 0) ||
      (visibility && visibility.length > 0),
  );
};
