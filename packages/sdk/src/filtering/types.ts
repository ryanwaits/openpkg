export interface FilterOptions {
  include?: string[];
  exclude?: string[];
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
  const { include, exclude } = options;
  return Boolean((include && include.length > 0) || (exclude && exclude.length > 0));
};
