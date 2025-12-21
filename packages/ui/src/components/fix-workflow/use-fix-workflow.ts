'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type {
  CodeFix,
  DecisionStatus,
  DriftIssue,
  FixWorkflowAction,
  FixWorkflowState,
  QueueGroup,
} from './types';

function fixWorkflowReducer(state: FixWorkflowState, action: FixWorkflowAction): FixWorkflowState {
  switch (action.type) {
    case 'ACCEPT':
      return {
        ...state,
        decisions: { ...state.decisions, [action.issueId]: 'accepted' },
      };

    case 'REJECT':
      return {
        ...state,
        decisions: { ...state.decisions, [action.issueId]: 'rejected' },
      };

    case 'SKIP':
      return {
        ...state,
        decisions: { ...state.decisions, [action.issueId]: 'skipped' },
      };

    case 'EDIT':
      return {
        ...state,
        decisions: { ...state.decisions, [action.issueId]: 'accepted' },
        customFixes: { ...state.customFixes, [action.issueId]: action.fix },
      };

    case 'NEXT':
      return {
        ...state,
        currentIndex: Math.min(state.currentIndex + 1, state.issues.length - 1),
      };

    case 'PREV':
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
      };

    case 'GO_TO':
      return {
        ...state,
        currentIndex: Math.max(0, Math.min(action.index, state.issues.length - 1)),
      };

    case 'ACCEPT_ALL_AUTO_FIXABLE': {
      const autoAccepted: Record<string, DecisionStatus> = {};
      state.issues.forEach((issue) => {
        if (state.fixes[issue.id] && !state.decisions[issue.id]) {
          autoAccepted[issue.id] = 'accepted';
        }
      });
      return {
        ...state,
        decisions: { ...state.decisions, ...autoAccepted },
      };
    }

    case 'CLEAR_DECISIONS':
      return {
        ...state,
        decisions: {},
        customFixes: {},
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.mode,
      };

    case 'SET_CREATING_PR':
      return {
        ...state,
        isCreatingPR: action.value,
      };

    default:
      return state;
  }
}

export interface UseFixWorkflowOptions {
  issues: DriftIssue[];
  fixes: Record<string, CodeFix>;
  onCreatePR?: (acceptedFixes: Array<{ issueId: string; fix: string }>) => Promise<void>;
}

export function useFixWorkflow(options: UseFixWorkflowOptions) {
  const { issues, fixes, onCreatePR } = options;

  const [state, dispatch] = useReducer(fixWorkflowReducer, {
    issues,
    fixes,
    currentIndex: 0,
    decisions: {},
    customFixes: {},
    isCreatingPR: false,
    viewMode: 'split',
  });

  // Current issue and fix
  const currentIssue = state.issues[state.currentIndex];
  const currentFix = currentIssue ? state.fixes[currentIssue.id] : undefined;
  const currentStatus = currentIssue ? (state.decisions[currentIssue.id] ?? 'pending') : 'pending';

  // Stats
  const stats = useMemo(() => {
    const total = state.issues.length;
    const accepted = Object.values(state.decisions).filter((d) => d === 'accepted').length;
    const rejected = Object.values(state.decisions).filter((d) => d === 'rejected').length;
    const skipped = Object.values(state.decisions).filter((d) => d === 'skipped').length;
    const reviewed = accepted + rejected + skipped;
    const remaining = total - reviewed;

    return { total, accepted, rejected, skipped, reviewed, remaining };
  }, [state.decisions, state.issues.length]);

  // Queue groups organized by priority
  const queueGroups: QueueGroup[] = useMemo(() => {
    const priorities: Array<{ key: 'high' | 'medium' | 'low'; label: string }> = [
      { key: 'high', label: 'High Priority' },
      { key: 'medium', label: 'Medium Priority' },
      { key: 'low', label: 'Low Priority' },
    ];

    return priorities.map(({ key, label }) => ({
      priority: key,
      label,
      items: state.issues
        .map((issue, index) => ({
          issue,
          status: (state.decisions[issue.id] ?? 'pending') as DecisionStatus,
          isActive: index === state.currentIndex,
          index,
        }))
        .filter((item) => item.issue.priority === key),
    }));
  }, [state.issues, state.decisions, state.currentIndex]);

  // Actions
  const accept = useCallback(() => {
    if (currentIssue) {
      dispatch({ type: 'ACCEPT', issueId: currentIssue.id });
      dispatch({ type: 'NEXT' });
    }
  }, [currentIssue]);

  const reject = useCallback(() => {
    if (currentIssue) {
      dispatch({ type: 'REJECT', issueId: currentIssue.id });
      dispatch({ type: 'NEXT' });
    }
  }, [currentIssue]);

  const skip = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const edit = useCallback(
    (fix: string) => {
      if (currentIssue) {
        dispatch({ type: 'EDIT', issueId: currentIssue.id, fix });
        dispatch({ type: 'NEXT' });
      }
    },
    [currentIssue],
  );

  const goToIndex = useCallback((index: number) => {
    dispatch({ type: 'GO_TO', index });
  }, []);

  const goNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const goPrev = useCallback(() => {
    dispatch({ type: 'PREV' });
  }, []);

  const acceptAllAutoFixable = useCallback(() => {
    dispatch({ type: 'ACCEPT_ALL_AUTO_FIXABLE' });
  }, []);

  const clearDecisions = useCallback(() => {
    dispatch({ type: 'CLEAR_DECISIONS' });
  }, []);

  const setViewMode = useCallback((mode: 'split' | 'unified') => {
    dispatch({ type: 'SET_VIEW_MODE', mode });
  }, []);

  const createPR = useCallback(async () => {
    if (!onCreatePR || stats.accepted === 0) return;

    dispatch({ type: 'SET_CREATING_PR', value: true });

    try {
      const acceptedFixes = state.issues
        .filter((issue) => state.decisions[issue.id] === 'accepted')
        .map((issue) => ({
          issueId: issue.id,
          fix: state.customFixes[issue.id] ?? state.fixes[issue.id]?.after ?? '',
        }));

      await onCreatePR(acceptedFixes);
    } finally {
      dispatch({ type: 'SET_CREATING_PR', value: false });
    }
  }, [onCreatePR, stats.accepted, state.issues, state.decisions, state.customFixes, state.fixes]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          accept();
          break;
        case 'r':
          e.preventDefault();
          reject();
          break;
        case 's':
          e.preventDefault();
          skip();
          break;
        case 'j':
        case 'arrowright':
          e.preventDefault();
          goNext();
          break;
        case 'k':
        case 'arrowleft':
          e.preventDefault();
          goPrev();
          break;
        case 'enter':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            createPR();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accept, reject, skip, goNext, goPrev, createPR]);

  return {
    // State
    currentIssue,
    currentFix,
    currentStatus,
    currentIndex: state.currentIndex,
    viewMode: state.viewMode,
    isCreatingPR: state.isCreatingPR,
    queueGroups,
    stats,

    // Actions
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
  };
}
