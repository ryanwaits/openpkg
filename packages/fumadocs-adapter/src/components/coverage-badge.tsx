'use client';

import type { SpecDocsMetadata } from '@openpkg-ts/spec';

export interface CoverageBadgeProps {
  docs: SpecDocsMetadata;
  showMissing?: boolean;
  showDrift?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20';
  if (score >= 60)
    return 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';
}

function formatSignal(signal: string): string {
  return signal.charAt(0).toUpperCase() + signal.slice(1);
}

export function CoverageBadge({ docs, showMissing = true, showDrift = true }: CoverageBadgeProps): React.ReactNode {
  const score = docs.coverageScore;
  const hasMissing = showMissing && docs.missing && docs.missing.length > 0;
  const hasDrift = showDrift && docs.drift && docs.drift.length > 0;

  if (score == null && !hasMissing && !hasDrift) return null;

  return (
    <div className="my-6 space-y-3">
      {score != null && (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium ${getScoreColor(score)}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Coverage: {score}%
        </div>
      )}

      {hasMissing && (
        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">
            Missing Documentation
          </p>
          <ul className="text-sm text-yellow-600/80 dark:text-yellow-400/80 list-disc list-inside">
            {docs.missing!.map((signal) => (
              <li key={signal}>{formatSignal(signal)}</li>
            ))}
          </ul>
        </div>
      )}

      {hasDrift && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
            Documentation Drift
          </p>
          <ul className="text-sm text-red-600/80 dark:text-red-400/80 space-y-1">
            {docs.drift!.map((drift, index) => (
              <li key={index} className="flex flex-col">
                <span className="font-medium">{drift.type}</span>
                <span className="text-xs opacity-80">{drift.issue}</span>
                {drift.suggestion && (
                  <span className="text-xs text-fd-muted-foreground mt-0.5">
                    Suggestion: {drift.suggestion}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
