'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { BatchActionsBar } from './batch-actions-bar';
import { DriftReviewPanel } from './drift-review-panel';
import { EditFixModal } from './edit-fix-modal';
import { FixQueueSidebar } from './fix-queue-sidebar';
import type { CodeFix, DriftIssue } from './types';
import { useFixWorkflow } from './use-fix-workflow';

interface FixWorkflowProps {
  issues: DriftIssue[];
  fixes: Record<string, CodeFix>;
  projectName?: string;
  onCreatePR?: (acceptedFixes: Array<{ issueId: string; fix: string }>) => Promise<void>;
  className?: string;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-success to-warning rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">
        {value} of {max} reviewed
      </span>
    </div>
  );
}

export function FixWorkflow({
  issues,
  fixes,
  projectName = 'Project',
  onCreatePR,
  className,
}: FixWorkflowProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);

  const workflow = useFixWorkflow({
    issues,
    fixes,
    onCreatePR,
  });

  const {
    currentIssue,
    currentFix,
    currentStatus,
    currentIndex,
    viewMode,
    isCreatingPR,
    queueGroups,
    stats,
    accept,
    reject,
    skip,
    edit,
    goToIndex,
    goNext,
    goPrev,
    acceptAllAutoFixable,
    clearDecisions,
    setViewMode,
    createPR,
  } = workflow;

  const handleEditSave = (customFix: string) => {
    edit(customFix);
  };

  if (issues.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">No drift issues found</p>
          <p className="text-sm text-muted-foreground">
            Your documentation is in sync with your code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Sidebar */}
      <aside className="w-72 shrink-0">
        <FixQueueSidebar
          groups={queueGroups}
          currentIndex={currentIndex}
          onItemClick={goToIndex}
          acceptedCount={stats.accepted}
          remainingCount={stats.remaining}
          onAcceptAllAutoFixable={acceptAllAutoFixable}
          onCreatePR={createPR}
          isCreatingPR={isCreatingPR}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {projectName}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="text-foreground font-medium">Fix Drift Issues</span>
          </nav>

          {/* Progress */}
          <ProgressBar value={stats.reviewed} max={stats.total} />
        </header>

        {/* Review panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {currentIssue && currentFix && (
              <DriftReviewPanel
                issue={currentIssue}
                fix={currentFix}
                onAccept={accept}
                onReject={reject}
                onSkip={skip}
                onEdit={() => setEditModalOpen(true)}
                onPrev={goPrev}
                onNext={goNext}
                position={{ current: currentIndex + 1, total: stats.total }}
                status={currentStatus}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            )}
          </div>
        </div>
      </main>

      {/* Batch actions bar */}
      <BatchActionsBar
        acceptedCount={stats.accepted}
        onClearSelection={clearDecisions}
        onCreatePR={createPR}
        isCreatingPR={isCreatingPR}
      />

      {/* Edit modal */}
      {currentIssue && currentFix && (
        <EditFixModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          issue={currentIssue}
          initialFix={currentFix.after}
          language={currentFix.language}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
