'use client';

import { Button } from '@doccov/ui/button';
import { cn } from '@/lib/utils';

export interface AnalysisSummary {
  packageName: string;
  version: string;
  coverage: number;
  exportCount: number;
  documentedCount: number;
  undocumentedCount: number;
  driftCount: number;
  topUndocumented: string[];
  topDrift: Array<{ name: string; issue: string }>;
}

interface ResultCardProps {
  summary: AnalysisSummary;
}

export function ResultCard({ summary }: ResultCardProps) {
  const coverageColor =
    summary.coverage >= 80
      ? 'text-green-500'
      : summary.coverage >= 50
        ? 'text-yellow-500'
        : 'text-red-500';

  const coverageBg =
    summary.coverage >= 80
      ? 'bg-green-500/10'
      : summary.coverage >= 50
        ? 'bg-yellow-500/10'
        : 'bg-red-500/10';

  return (
    <div className="mt-6 p-6 rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg">{summary.packageName}</h3>
          <p className="text-sm text-muted-foreground">v{summary.version}</p>
        </div>
        <div className={cn('text-4xl font-bold px-4 py-2 rounded-lg', coverageColor, coverageBg)}>
          {summary.coverage}%
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center mb-6">
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-2xl font-bold">{summary.exportCount}</div>
          <div className="text-xs text-muted-foreground">Exports</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-2xl font-bold">{summary.undocumentedCount}</div>
          <div className="text-xs text-muted-foreground">Undocumented</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-2xl font-bold">{summary.driftCount}</div>
          <div className="text-xs text-muted-foreground">Drift Issues</div>
        </div>
      </div>

      {(summary.topUndocumented.length > 0 || summary.topDrift.length > 0) && (
        <div className="space-y-4 pt-4 border-t">
          {summary.topUndocumented.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                Undocumented Exports
              </h4>
              <div className="flex flex-wrap gap-2">
                {summary.topUndocumented.map((name, i) => (
                  <code
                    key={i}
                    className="px-2 py-1 text-xs bg-muted rounded font-mono"
                  >
                    {name}
                  </code>
                ))}
              </div>
            </div>
          )}

          {summary.topDrift.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Top Drift Issues</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {summary.topDrift.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <code className="text-foreground font-mono text-xs shrink-0">{d.name}</code>
                    <span className="text-xs">{d.issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <a href="/pricing">
          <Button size="sm">Get Full Report</Button>
        </a>
        <a
          href={`https://github.com/${summary.packageName.startsWith('@') ? summary.packageName.slice(1) : summary.packageName}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" variant="secondary">View Source</Button>
        </a>
      </div>
    </div>
  );
}
