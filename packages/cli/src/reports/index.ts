// Changelog renderer
export { type ChangelogData, type ChangelogOptions, renderChangelog, renderCompactChangelog } from './changelog-renderer';
export { renderDiffHtml } from './diff-html';
// Diff report renderers
export { type DiffReportData, renderDiffMarkdown } from './diff-markdown';
export { renderGithubSummary } from './github';
export { renderHtml } from './html';
export { renderMarkdown } from './markdown';
export { type PRCommentData, type PRCommentOptions, renderPRComment } from './pr-comment';
export { computeStats, type ReportStats, type SignalStats } from './stats';
export {
  ensureReportDir,
  type WriteReportOptions,
  type WriteReportResult,
  type WriteReportsOptions,
  writeReport,
  writeReports,
} from './writer';
