/**
 * GitHub Check Runs and PR Comments
 */

import { getTokenByInstallationId } from './github-app';

interface AnalysisResult {
  coveragePercent: number;
  documentedCount: number;
  totalCount: number;
  driftCount: number;
  qualityErrors?: number;
  qualityWarnings?: number;
}

interface AnalysisDiff {
  coverageDelta: number;
  documentedDelta: number;
  totalDelta: number;
  driftDelta: number;
}

/**
 * Format a delta value with sign and styling
 */
function formatDelta(delta: number, suffix = ''): string {
  if (delta === 0) return '';
  const sign = delta > 0 ? '+' : '';
  return ` (${sign}${delta}${suffix})`;
}

/**
 * Create or update a check run
 */
export async function createCheckRun(
  installationId: string,
  owner: string,
  repo: string,
  sha: string,
  result: AnalysisResult,
  diff?: AnalysisDiff | null,
): Promise<boolean> {
  const token = await getTokenByInstallationId(installationId);
  if (!token) return false;

  const coverageDelta = diff ? formatDelta(diff.coverageDelta, '%') : '';

  // Determine conclusion based on drift and quality
  const hasIssues = result.driftCount > 0 || (result.qualityErrors ?? 0) > 0;
  const conclusion = hasIssues ? 'neutral' : 'success';

  const title = `Coverage: ${result.coveragePercent.toFixed(1)}%${coverageDelta}`;

  const summaryLines = [
    `## Documentation Coverage`,
    '',
    `\`\`\``,
    `Coverage: ${result.coveragePercent.toFixed(1)}%${coverageDelta}`,
    `├─ Documented: ${result.documentedCount}/${result.totalCount} exports`,
    `├─ Drift: ${result.driftCount} issue${result.driftCount !== 1 ? 's' : ''}${diff ? formatDelta(-diff.driftDelta) : ''}`,
  ];

  const qualityIssues = (result.qualityErrors ?? 0) + (result.qualityWarnings ?? 0);
  if (qualityIssues > 0) {
    summaryLines.push(
      `└─ Quality: ${result.qualityErrors ?? 0} error${(result.qualityErrors ?? 0) !== 1 ? 's' : ''}, ${result.qualityWarnings ?? 0} warning${(result.qualityWarnings ?? 0) !== 1 ? 's' : ''}`,
    );
  } else {
    summaryLines.push(`└─ Quality: ✓ No issues`);
  }

  summaryLines.push(`\`\`\``);

  if (diff) {
    summaryLines.push('', '### Changes vs base');
    summaryLines.push('| Metric | Delta |');
    summaryLines.push('|--------|-------|');
    summaryLines.push(
      `| Coverage | ${diff.coverageDelta >= 0 ? '📈' : '📉'} ${diff.coverageDelta >= 0 ? '+' : ''}${diff.coverageDelta.toFixed(1)}% |`,
    );
    if (diff.documentedDelta !== 0) {
      summaryLines.push(
        `| Documented | ${diff.documentedDelta >= 0 ? '+' : ''}${diff.documentedDelta} |`,
      );
    }
    if (diff.driftDelta !== 0) {
      const driftChange = -diff.driftDelta; // Positive driftDelta means drift increased (bad)
      summaryLines.push(`| Drift issues | ${driftChange >= 0 ? '+' : ''}${driftChange} |`);
    }
  }

  summaryLines.push('', `[View full report →](https://doccov.com/r/${owner}/${repo}/${sha})`);

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/check-runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'DocCov',
        head_sha: sha,
        status: 'completed',
        conclusion,
        output: {
          title,
          summary: summaryLines.join('\n'),
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to create check run:', await response.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error creating check run:', err);
    return false;
  }
}

/**
 * Post or update a PR comment
 */
export async function postPRComment(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number,
  result: AnalysisResult,
  diff?: AnalysisDiff | null,
): Promise<boolean> {
  const token = await getTokenByInstallationId(installationId);
  if (!token) return false;

  const coverageEmoji = diff
    ? diff.coverageDelta > 0
      ? '📈'
      : diff.coverageDelta < 0
        ? '📉'
        : '➡️'
    : '📊';

  const bodyLines = [`## ${coverageEmoji} DocCov Report`, ''];

  // Summary table
  if (diff) {
    bodyLines.push('| Metric | This PR | Base | Δ |');
    bodyLines.push('|--------|---------|------|---|');
    bodyLines.push(
      `| Coverage | **${result.coveragePercent.toFixed(1)}%** | ${(result.coveragePercent - diff.coverageDelta).toFixed(1)}% | ${diff.coverageDelta >= 0 ? '+' : ''}${diff.coverageDelta.toFixed(1)}% |`,
    );
    bodyLines.push(
      `| Documented | ${result.documentedCount} | ${result.documentedCount - diff.documentedDelta} | ${diff.documentedDelta >= 0 ? '+' : ''}${diff.documentedDelta} |`,
    );
    bodyLines.push(
      `| Total exports | ${result.totalCount} | ${result.totalCount - diff.totalDelta} | ${diff.totalDelta >= 0 ? '+' : ''}${diff.totalDelta} |`,
    );
    const baseDrift = result.driftCount - diff.driftDelta;
    const driftSign = diff.driftDelta >= 0 ? '+' : '';
    bodyLines.push(
      `| Drift issues | ${result.driftCount} | ${baseDrift} | ${driftSign}${diff.driftDelta} |`,
    );
  } else {
    bodyLines.push('| Metric | Value |');
    bodyLines.push('|--------|-------|');
    bodyLines.push(`| Coverage | **${result.coveragePercent.toFixed(1)}%** |`);
    bodyLines.push(`| Documented | ${result.documentedCount} / ${result.totalCount} |`);
    bodyLines.push(`| Drift issues | ${result.driftCount} |`);
  }

  bodyLines.push('');

  // Quality summary
  const qualityErrors = result.qualityErrors ?? 0;
  const qualityWarnings = result.qualityWarnings ?? 0;
  if (qualityErrors > 0 || qualityWarnings > 0) {
    bodyLines.push(
      `**Quality**: ${qualityErrors} error${qualityErrors !== 1 ? 's' : ''}, ${qualityWarnings} warning${qualityWarnings !== 1 ? 's' : ''}`,
    );
    bodyLines.push('');
  }

  // Status message
  if (result.driftCount > 0) {
    bodyLines.push('⚠️ Documentation drift detected. Run `doccov check --fix` to update.');
  } else if (qualityErrors > 0) {
    bodyLines.push('❌ Quality errors found. Run `doccov check` for details.');
  } else {
    bodyLines.push('✅ Documentation is in sync.');
  }

  bodyLines.push('');
  bodyLines.push('---');
  bodyLines.push('*Generated by [DocCov](https://doccov.com)*');

  const body = bodyLines.join('\n');

  try {
    // Check for existing comment
    const existingId = await findExistingComment(token, owner, repo, prNumber);

    if (existingId) {
      // Update existing comment
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existingId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        },
      );
      return response.ok;
    }

    // Create new comment
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      },
    );

    return response.ok;
  } catch (err) {
    console.error('Error posting PR comment:', err);
    return false;
  }
}

/**
 * Find existing DocCov comment on a PR
 */
async function findExistingComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) return null;

    const comments = (await response.json()) as Array<{ id: number; body: string }>;
    const existing = comments.find((c) => c.body.includes('DocCov Report'));

    return existing?.id ?? null;
  } catch {
    return null;
  }
}
