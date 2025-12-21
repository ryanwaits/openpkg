// PR Coverage View Types

export type PRStatus = 'passing' | 'warning' | 'failing' | 'pending';
export type ChangeType = '+' | '~' | '-';
export type ExportKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable';
export type DriftSeverity = 'high' | 'medium' | 'low';

export interface PRInfo {
  number: number;
  title: string;
  base: string;
  head: string;
  author: string;
  authorUrl?: string;
  url: string;
  openedAt: string;
}

export interface PRMetrics {
  patchCoverage: number;
  patchCoverageTarget: number;
  projectCoverage: {
    before: number;
    after: number;
  };
  newExports: {
    total: number;
    documented: number;
    undocumented: number;
  };
  driftDelta: {
    introduced: number;
    resolved: number;
  };
}

export interface ExportItem {
  name: string;
  kind: ExportKind;
  changeType: ChangeType;
  coverage: number;
  status: 'documented' | 'partial' | 'undocumented';
  missing?: string[];
  line?: number;
}

export interface FileChange {
  path: string;
  filename: string;
  exports: ExportItem[];
  stats: {
    added?: number;
    modified?: number;
    removed?: number;
  };
}

export interface DriftIssue {
  id: string;
  type: string;
  severity: DriftSeverity;
  description: string;
  filePath: string;
  line: number;
  functionName?: string;
  status?: 'introduced' | 'resolved';
}

export interface DocsIssue {
  line: number;
  description: string;
  before?: string;
  after?: string;
}

export interface DocsImpactFile {
  path: string;
  issues: DocsIssue[];
}

export interface PRCoverageData {
  pr: PRInfo;
  status: PRStatus;
  updatedAt: string;
  metrics: PRMetrics;
  changes: FileChange[];
  drift: {
    introduced: DriftIssue[];
    resolved: DriftIssue[];
  };
  docsImpact: DocsImpactFile[];
}
