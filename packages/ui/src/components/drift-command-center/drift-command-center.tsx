'use client';

import { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { BatchActionsHeader } from './batch-actions-header';
import { DriftFilters } from './drift-filters';
import { DriftGroupList } from './drift-group-list';
import { DriftOverview } from './drift-overview';
import { DriftTypeChart } from './drift-type-chart';
import {
  computeDriftStats,
  type DriftCommandCenterProps,
  type DriftFilterState,
  type DriftType,
} from './types';

export function DriftCommandCenter({
  issues,
  packageName,
  onViewIssue,
  onFixIssue,
  onIgnoreIssue,
  onFixAllAutoFixable,
  className,
}: DriftCommandCenterProps) {
  // Filter state
  const [filters, setFilters] = useState<DriftFilterState>({
    severity: [],
    types: [],
    fixable: 'all',
    file: '',
    search: '',
  });

  // Compute stats
  const stats = useMemo(() => computeDriftStats(issues), [issues]);

  // Get available types and files for filter dropdowns
  const availableTypes = useMemo(() => Object.keys(stats.byType) as DriftType[], [stats.byType]);

  const availableFiles = useMemo(
    () => [...new Set(issues.map((i) => i.filePath))].sort(),
    [issues],
  );

  // Apply filters
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Severity filter
      if (filters.severity.length > 0 && !filters.severity.includes(issue.severity)) {
        return false;
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(issue.type)) {
        return false;
      }

      // Fixable filter
      if (filters.fixable === 'auto-fixable' && !issue.isAutoFixable) {
        return false;
      }
      if (filters.fixable === 'manual' && issue.isAutoFixable) {
        return false;
      }

      // File filter
      if (filters.file && issue.filePath !== filters.file) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesDescription = issue.description.toLowerCase().includes(search);
        const matchesType = issue.type.toLowerCase().includes(search);
        const matchesExport = issue.exportName?.toLowerCase().includes(search);
        const matchesFile = issue.filePath.toLowerCase().includes(search);
        if (!matchesDescription && !matchesType && !matchesExport && !matchesFile) {
          return false;
        }
      }

      return true;
    });
  }, [issues, filters]);

  // Handle type click from chart
  const handleTypeClick = (type: DriftType) => {
    const current = filters.types;
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setFilters({ ...filters, types: updated });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with batch actions */}
      <BatchActionsHeader
        packageName={packageName}
        totalIssues={issues.length}
        autoFixableCount={stats.autoFixable}
        onFixAllAutoFixable={onFixAllAutoFixable}
      />

      {/* Overview stats */}
      <DriftOverview stats={stats} />

      {/* Two column layout: chart + list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Type distribution chart */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">By Type</h3>
            <DriftTypeChart byType={stats.byType} onTypeClick={handleTypeClick} />
          </div>
        </div>

        {/* Right: Filtered issue list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <DriftFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableTypes={availableTypes}
            availableFiles={availableFiles}
          />

          {/* Issue count */}
          {filteredIssues.length !== issues.length && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredIssues.length} of {issues.length} issues
            </p>
          )}

          {/* Grouped list */}
          <DriftGroupList
            issues={filteredIssues}
            onViewIssue={onViewIssue}
            onFixIssue={onFixIssue}
            onIgnoreIssue={onIgnoreIssue}
          />
        </div>
      </div>
    </div>
  );
}
