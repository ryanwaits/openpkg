'use client';

import { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { Tabs } from '../tabs';
import { DocsImpactSection } from './docs-impact-card';
import { DriftSection } from './drift-card';
import { FileSection } from './file-section';
import { MetricsGrid } from './metrics-grid';
import { PRHeader } from './pr-header';
import type { DriftIssue, PRCoverageData } from './types';
import { type UndocumentedExport, UndocumentedSection } from './undocumented-card';

interface PRCoverageViewProps {
  data: PRCoverageData;
  onViewGitHub?: () => void;
  onRerunAnalysis?: () => void;
  onFixIssues?: () => void;
  onViewSource?: (filePath: string, line?: number) => void;
  onAddDocs?: (filePath: string, exportName: string) => void;
  onFixDrift?: (issue: DriftIssue) => void;
  onViewDrift?: (issue: DriftIssue) => void;
  onFixAllDrift?: () => void;
  onOpenDocsFile?: (path: string) => void;
  onGenerateDocsUpdates?: (path: string) => void;
  className?: string;
}

type TabId = 'changed' | 'undocumented' | 'drift' | 'docs-impact';

export function PRCoverageView({
  data,
  onViewGitHub,
  onRerunAnalysis,
  onFixIssues,
  onViewSource,
  onAddDocs,
  onFixDrift,
  onViewDrift,
  onFixAllDrift,
  onOpenDocsFile,
  onGenerateDocsUpdates,
  className,
}: PRCoverageViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('changed');

  // Build status message
  const statusMessage = useMemo(() => {
    const parts = [];
    parts.push(
      `Coverage: ${data.metrics.patchCoverage}% (target: ${data.metrics.patchCoverageTarget}%)`,
    );

    const totalDrift = data.drift.introduced.length;
    if (totalDrift > 0) {
      parts.push(`Drift: ${totalDrift} ${totalDrift === 1 ? 'issue' : 'issues'}`);
    }

    if (data.docsImpact.length > 0) {
      parts.push(
        `Docs Impact: ${data.docsImpact.length} ${data.docsImpact.length === 1 ? 'file' : 'files'}`,
      );
    }

    return parts.join(' · ');
  }, [data]);

  // Calculate tab counts
  const changedCount = data.changes.reduce((sum, f) => sum + f.exports.length, 0);

  const undocumentedExports: UndocumentedExport[] = useMemo(() => {
    const exports: UndocumentedExport[] = [];
    for (const file of data.changes) {
      for (const exp of file.exports) {
        if (exp.status === 'undocumented' || exp.status === 'partial') {
          exports.push({
            ...exp,
            filePath: `${file.path}${file.filename}`,
          });
        }
      }
    }
    return exports;
  }, [data.changes]);

  const driftCount = data.drift.introduced.length + data.drift.resolved.length;
  const docsImpactCount = data.docsImpact.reduce((sum, f) => sum + f.issues.length, 0);

  const tabs = [
    { id: 'changed', label: 'Changed', count: changedCount },
    { id: 'undocumented', label: 'Undocumented', count: undocumentedExports.length },
    { id: 'drift', label: 'Drift', count: driftCount },
    { id: 'docs-impact', label: 'Docs Impact', count: docsImpactCount },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <PRHeader
        pr={data.pr}
        status={data.status}
        statusMessage={statusMessage}
        updatedAt={data.updatedAt}
        onViewGitHub={onViewGitHub}
        onRerunAnalysis={onRerunAnalysis}
        onFixIssues={
          data.drift.introduced.length > 0 || undocumentedExports.length > 0
            ? onFixIssues
            : undefined
        }
      />

      {/* Metrics */}
      <MetricsGrid
        metrics={data.metrics}
        onFixDrift={data.drift.introduced.length > 0 ? onFixAllDrift : undefined}
      />

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'changed' && (
          <div className="space-y-4">
            {data.changes.map((file) => (
              <FileSection key={`${file.path}${file.filename}`} file={file} />
            ))}
            {data.changes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="font-medium">No changes in this PR</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'undocumented' && (
          <UndocumentedSection
            exports={undocumentedExports}
            onViewSource={onViewSource ? (exp) => onViewSource(exp.filePath, exp.line) : undefined}
            onAddDocs={onAddDocs ? (exp) => onAddDocs(exp.filePath, exp.name) : undefined}
          />
        )}

        {activeTab === 'drift' && (
          <DriftSection
            introduced={data.drift.introduced}
            resolved={data.drift.resolved}
            onViewIssue={onViewDrift}
            onFixIssue={onFixDrift}
            onFixAll={onFixAllDrift}
          />
        )}

        {activeTab === 'docs-impact' && (
          <DocsImpactSection
            files={data.docsImpact}
            onOpenFile={onOpenDocsFile}
            onGenerateUpdates={onGenerateDocsUpdates}
          />
        )}
      </div>
    </div>
  );
}
