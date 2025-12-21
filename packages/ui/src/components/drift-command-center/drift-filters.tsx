'use client';

import { Filter, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DriftFilterState, DriftSeverity, DriftType } from './types';
import { DRIFT_TYPE_LABELS } from './types';

interface DriftFiltersProps {
  filters: DriftFilterState;
  onFiltersChange: (filters: DriftFilterState) => void;
  availableTypes: DriftType[];
  availableFiles: string[];
  className?: string;
}

const severityOptions: { value: DriftSeverity; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const fixableOptions: { value: DriftFilterState['fixable']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'auto-fixable', label: 'Auto-fixable' },
  { value: 'manual', label: 'Manual' },
];

export function DriftFilters({
  filters,
  onFiltersChange,
  availableTypes,
  availableFiles,
  className,
}: DriftFiltersProps) {
  const hasActiveFilters =
    filters.severity.length > 0 ||
    filters.types.length > 0 ||
    filters.fixable !== 'all' ||
    filters.file !== '' ||
    filters.search !== '';

  const updateFilter = <K extends keyof DriftFilterState>(key: K, value: DriftFilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleSeverity = (severity: DriftSeverity) => {
    const current = filters.severity;
    const updated = current.includes(severity)
      ? current.filter((s) => s !== severity)
      : [...current, severity];
    updateFilter('severity', updated);
  };

  const toggleType = (type: DriftType) => {
    const current = filters.types;
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    updateFilter('types', updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      severity: [],
      types: [],
      fixable: 'all',
      file: '',
      search: '',
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search issues..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className={cn(
            'w-full h-9 pl-9 pr-3 text-sm rounded-md',
            'bg-[var(--input-bg)] border border-[var(--input-border)]',
            'placeholder:text-[var(--input-placeholder)]',
            'focus:outline-none focus:border-[var(--input-border-focus)]',
          )}
        />
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Filter className="size-3" />
          Filters:
        </span>

        {/* Severity toggles */}
        {severityOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleSeverity(opt.value)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
              filters.severity.includes(opt.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {opt.label}
          </button>
        ))}

        {/* Fixable dropdown */}
        <select
          value={filters.fixable}
          onChange={(e) => updateFilter('fixable', e.target.value as DriftFilterState['fixable'])}
          className={cn(
            'px-2.5 py-1 text-xs rounded-md',
            'bg-muted border-none',
            'text-muted-foreground focus:outline-none',
          )}
        >
          {fixableOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* File dropdown */}
        {availableFiles.length > 0 && (
          <select
            value={filters.file}
            onChange={(e) => updateFilter('file', e.target.value)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md max-w-32 truncate',
              'bg-muted border-none',
              'text-muted-foreground focus:outline-none',
            )}
          >
            <option value="">All files</option>
            {availableFiles.map((file) => (
              <option key={file} value={file}>
                {file.split('/').pop()}
              </option>
            ))}
          </select>
        )}

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="size-3" />
            Clear
          </button>
        )}
      </div>

      {/* Type chips (show only if types available) */}
      {availableTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                'px-2 py-0.5 text-[11px] font-mono rounded transition-colors',
                filters.types.includes(type)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {DRIFT_TYPE_LABELS[type] || type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
