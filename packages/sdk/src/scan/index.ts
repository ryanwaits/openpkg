/**
 * Scan module - AI-powered build plan generation and execution.
 */

// GitHub context fetcher
export type {
  BuildHints,
  DetectedPackageManager,
  GitHubProjectContext,
  GitHubRepoMetadata,
  WorkspaceConfig,
} from './github-context';
export { fetchGitHubContext, listWorkspacePackages, parseGitHubUrl } from './github-context';
// Summary utilities
export type { SpecSummary, SummaryDriftIssue } from './summary';
export { extractSpecSummary } from './summary';
// Build plan types
export type {
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanExecutionResult,
  BuildPlanStep,
  BuildPlanStepResult,
  BuildPlanTarget,
} from './types';
