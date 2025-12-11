/**
 * Build Plan types for AI-powered repository scanning.
 */

/**
 * Target repository information for a build plan.
 */
export interface BuildPlanTarget {
  /** Target type (currently only GitHub is supported) */
  type: 'github';
  /** Full GitHub repository URL */
  repoUrl: string;
  /** Git ref (branch, tag, or commit) */
  ref: string;
  /** Root path within the repository (for monorepos) */
  rootPath?: string;
  /** Entry point files to analyze */
  entryPoints: string[];
}

/**
 * Runtime environment configuration for executing a build plan.
 */
export interface BuildPlanEnvironment {
  /** Node.js or Bun runtime */
  runtime: 'node20' | 'node22' | 'bun';
  /** Package manager to use */
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  /** Additional tools required (e.g., 'wasm-pack', 'cargo') */
  requiredTools?: string[];
}

/**
 * A single step in the build plan.
 */
export interface BuildPlanStep {
  /** Unique identifier for this step */
  id: string;
  /** Human-readable step name */
  name: string;
  /** Command to execute */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory (relative to repo root) */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** If true, failure won't stop the plan execution */
  optional?: boolean;
}

/**
 * AI-generated build plan for analyzing a repository.
 */
export interface BuildPlan {
  /** Build plan schema version */
  version: '1.0.0';
  /** When the plan was generated */
  generatedAt: string;
  /** Target repository information */
  target: BuildPlanTarget;
  /** Environment configuration */
  environment: BuildPlanEnvironment;
  /** Ordered list of steps to execute */
  steps: BuildPlanStep[];
  /** AI reasoning about the plan */
  reasoning: {
    /** Brief summary of the approach */
    summary: string;
    /** Why this approach was chosen */
    rationale: string;
    /** Potential issues or concerns */
    concerns: string[];
  };
  /** AI confidence in the plan */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Result of executing a single build plan step.
 */
export interface BuildPlanStepResult {
  /** Step ID that was executed */
  stepId: string;
  /** Whether the step succeeded */
  success: boolean;
  /** Duration in milliseconds */
  duration: number;
  /** Command output (stdout) */
  output?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of executing a complete build plan.
 */
export interface BuildPlanExecutionResult {
  /** Whether all required steps succeeded */
  success: boolean;
  /** Generated OpenPkg spec (if successful) */
  spec?: import('@openpkg-ts/spec').OpenPkg;
  /** Results for each step */
  stepResults: BuildPlanStepResult[];
  /** Total execution time in milliseconds */
  totalDuration: number;
  /** Overall error message if failed */
  error?: string;
}
