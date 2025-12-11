import type { ReportStats } from './stats';

/**
 * Render a GitHub Actions summary format report.
 *
 * This format is optimized for display in GitHub Actions workflow summaries
 * and pull request comments.
 */
export function renderGithubSummary(
  stats: ReportStats,
  options: {
    coverageScore?: number;
    driftCount?: number;
    qualityIssues?: number;
  } = {},
): string {
  const coverageScore = options.coverageScore ?? stats.coverageScore;
  const driftCount = options.driftCount ?? stats.driftCount;
  const qualityIssues = options.qualityIssues ?? 0;

  let output = `## Documentation Coverage: ${coverageScore}%\n\n`;
  output += `| Metric | Value |\n|--------|-------|\n`;
  output += `| Coverage Score | ${coverageScore}% |\n`;
  output += `| Total Exports | ${stats.totalExports} |\n`;
  output += `| Drift Issues | ${driftCount} |\n`;
  output += `| Quality Issues | ${qualityIssues} |\n`;

  // Add status badge
  const status = coverageScore >= 80 ? '✅' : coverageScore >= 50 ? '⚠️' : '❌';
  output += `\n${status} Coverage ${coverageScore >= 80 ? 'passing' : coverageScore >= 50 ? 'needs improvement' : 'failing'}\n`;

  return output;
}
