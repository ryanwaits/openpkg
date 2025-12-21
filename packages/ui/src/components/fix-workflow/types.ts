/**
 * Fix Workflow Types
 * Types for the Cursor-style accept/reject interface for fixing documentation drift issues.
 */

export type DriftType =
  | 'param-mismatch'
  | 'return-type-mismatch'
  | 'optionality-mismatch'
  | 'deprecated-mismatch'
  | 'example-drift'
  | 'example-runtime-error'
  | 'broken-link'
  | 'visibility-mismatch'
  | 'missing-param'
  | 'extra-param'
  | 'type-mismatch';

export type Priority = 'high' | 'medium' | 'low';

export type DecisionStatus = 'pending' | 'accepted' | 'rejected' | 'skipped';

export interface DriftIssue {
  id: string;
  type: DriftType;
  priority: Priority;
  filePath: string;
  line: number;
  functionName?: string;
  description: string;
  suggestion?: string;
}

export interface CodeFix {
  issueId: string;
  before: string;
  after: string;
  language: string;
}

export interface FixWorkflowState {
  issues: DriftIssue[];
  fixes: Record<string, CodeFix>;
  currentIndex: number;
  decisions: Record<string, DecisionStatus>;
  customFixes: Record<string, string>;
  isCreatingPR: boolean;
  viewMode: 'split' | 'unified';
}

export type FixWorkflowAction =
  | { type: 'ACCEPT'; issueId: string }
  | { type: 'REJECT'; issueId: string }
  | { type: 'SKIP'; issueId: string }
  | { type: 'EDIT'; issueId: string; fix: string }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GO_TO'; index: number }
  | { type: 'ACCEPT_ALL_AUTO_FIXABLE' }
  | { type: 'CLEAR_DECISIONS' }
  | { type: 'SET_VIEW_MODE'; mode: 'split' | 'unified' }
  | { type: 'SET_CREATING_PR'; value: boolean };

export interface QueueItem {
  issue: DriftIssue;
  status: DecisionStatus;
  isActive: boolean;
}

export interface QueueGroup {
  priority: Priority;
  label: string;
  items: QueueItem[];
}

// Props for components
export interface DriftReviewPanelProps {
  issue: DriftIssue;
  fix: CodeFix;
  onAccept: () => void;
  onReject: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onPrev: () => void;
  onNext: () => void;
  position: { current: number; total: number };
  status: DecisionStatus;
  viewMode: 'split' | 'unified';
  onViewModeChange: (mode: 'split' | 'unified') => void;
}

export interface DiffViewerProps {
  before: string;
  after: string;
  language: string;
  mode: 'split' | 'unified';
  className?: string;
}

export interface FixQueueSidebarProps {
  groups: QueueGroup[];
  currentIndex: number;
  onItemClick: (index: number) => void;
  acceptedCount: number;
  remainingCount: number;
  onAcceptAllAutoFixable?: () => void;
  onCreatePR?: () => void;
  isCreatingPR?: boolean;
}

export interface BatchActionsBarProps {
  acceptedCount: number;
  onClearSelection: () => void;
  onCreatePR: () => void;
  isCreatingPR?: boolean;
}

export interface EditFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: DriftIssue;
  initialFix: string;
  language: string;
  onSave: (fix: string) => void;
}
