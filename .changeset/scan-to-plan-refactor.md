---
"@doccov/sdk": minor
"@doccov/cli": patch
"@openpkg-ts/spec": minor
---

refactor: replace scan architecture with plan/execute model

**@doccov/sdk**
- Add `fetchGitHubContext()` for fetching repository metadata via GitHub API
- Add `BuildPlan` types for describing build/analysis execution plans
- Export new scan types: `BuildPlan`, `BuildPlanStep`, `BuildPlanExecutionResult`, `GitHubProjectContext`
- Remove legacy scan orchestrator in favor of external execution

**@doccov/cli**
- Remove `scan` command (moved to API service)
- Update `spec` command with improved analysis

**@openpkg-ts/spec**
- Add `BuildPlan` and related types to schema
- Extend spec schema for plan-based analysis
