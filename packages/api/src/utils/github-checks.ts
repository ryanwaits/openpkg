/**
 * GitHub Check Runs and PR Comments
 */

import type { SpecDiffWithDocs } from '@doccov/sdk';
import { getTokenByInstallationId } from './github-app';

interface AnalysisResult {
  coverageScore: number;
  documentedExports: number;
  totalExports: number;
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
 * Rich diff result from spec-diff-core
 */
export interface RichDiffResult {
  diff: SpecDiffWithDocs;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
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

  const title = `Coverage: ${result.coverageScore.toFixed(1)}%${coverageDelta}`;

  const summaryLines = [
    `## Documentation Coverage`,
    '',
    `\`\`\``,
    `Coverage: ${result.coverageScore.toFixed(1)}%${coverageDelta}`,
    `├─ Documented: ${result.documentedExports}/${result.totalExports} exports`,
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
      `| Coverage | **${result.coverageScore.toFixed(1)}%** | ${(result.coverageScore - diff.coverageDelta).toFixed(1)}% | ${diff.coverageDelta >= 0 ? '+' : ''}${diff.coverageDelta.toFixed(1)}% |`,
    );
    bodyLines.push(
      `| Documented | ${result.documentedExports} | ${result.documentedExports - diff.documentedDelta} | ${diff.documentedDelta >= 0 ? '+' : ''}${diff.documentedDelta} |`,
    );
    bodyLines.push(
      `| Total exports | ${result.totalExports} | ${result.totalExports - diff.totalDelta} | ${diff.totalDelta >= 0 ? '+' : ''}${diff.totalDelta} |`,
    );
    const baseDrift = result.driftCount - diff.driftDelta;
    const driftSign = diff.driftDelta >= 0 ? '+' : '';
    bodyLines.push(
      `| Drift issues | ${result.driftCount} | ${baseDrift} | ${driftSign}${diff.driftDelta} |`,
    );
  } else {
    bodyLines.push('| Metric | Value |');
    bodyLines.push('|--------|-------|');
    bodyLines.push(`| Coverage | **${result.coverageScore.toFixed(1)}%** |`);
    bodyLines.push(`| Documented | ${result.documentedExports} / ${result.totalExports} |`);
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

/**
 * Post enhanced PR comment with breaking changes and member changes
 */
export async function postEnhancedPRComment(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number,
  richDiff: RichDiffResult,
): Promise<boolean> {
  const token = await getTokenByInstallationId(installationId);
  if (!token) return false;

  const { diff, base, head } = richDiff;

  const coverageEmoji = diff.coverageDelta > 0 ? '📈' : diff.coverageDelta < 0 ? '📉' : '➡️';

  const bodyLines = [`## ${coverageEmoji} DocCov Report`, ''];

  // Coverage summary
  bodyLines.push('### Coverage');
  bodyLines.push('| Metric | This PR | Base | Δ |');
  bodyLines.push('|--------|---------|------|---|');
  bodyLines.push(
    `| Coverage | **${diff.newCoverage.toFixed(1)}%** | ${diff.oldCoverage.toFixed(1)}% | ${diff.coverageDelta >= 0 ? '+' : ''}${diff.coverageDelta.toFixed(1)}% |`,
  );

  if (diff.driftIntroduced > 0 || diff.driftResolved > 0) {
    const driftChange = diff.driftIntroduced - diff.driftResolved;
    bodyLines.push(
      `| Drift | ${diff.driftIntroduced > 0 ? `+${diff.driftIntroduced} new` : '0 new'} | ${diff.driftResolved > 0 ? `${diff.driftResolved} fixed` : '0 fixed'} | ${driftChange >= 0 ? '+' : ''}${driftChange} |`,
    );
  }

  bodyLines.push('');

  // Breaking changes section
  if (diff.breaking.length > 0) {
    bodyLines.push('### ⚠️ Breaking Changes');
    bodyLines.push('');

    // Group by severity if available
    if (diff.categorizedBreaking && diff.categorizedBreaking.length > 0) {
      const high = diff.categorizedBreaking.filter((b) => b.severity === 'high');
      const medium = diff.categorizedBreaking.filter((b) => b.severity === 'medium');
      const low = diff.categorizedBreaking.filter((b) => b.severity === 'low');

      if (high.length > 0) {
        bodyLines.push(`**🔴 High Impact (${high.length})**`);
        for (const b of high.slice(0, 5)) {
          bodyLines.push(`- \`${b.name}\` - ${b.reason}`);
        }
        if (high.length > 5) bodyLines.push(`- ...and ${high.length - 5} more`);
        bodyLines.push('');
      }

      if (medium.length > 0) {
        bodyLines.push(`**🟡 Medium Impact (${medium.length})**`);
        for (const b of medium.slice(0, 5)) {
          bodyLines.push(`- \`${b.name}\` - ${b.reason}`);
        }
        if (medium.length > 5) bodyLines.push(`- ...and ${medium.length - 5} more`);
        bodyLines.push('');
      }

      if (low.length > 0) {
        bodyLines.push(`**🟢 Low Impact (${low.length})**`);
        for (const b of low.slice(0, 3)) {
          bodyLines.push(`- \`${b.name}\` - ${b.reason}`);
        }
        if (low.length > 3) bodyLines.push(`- ...and ${low.length - 3} more`);
        bodyLines.push('');
      }
    } else {
      // Simple list (breaking is string[])
      for (const b of diff.breaking.slice(0, 10)) {
        bodyLines.push(`- \`${b}\``);
      }
      if (diff.breaking.length > 10) {
        bodyLines.push(`- ...and ${diff.breaking.length - 10} more`);
      }
      bodyLines.push('');
    }
  }

  // Member-level changes section
  if (diff.memberChanges && diff.memberChanges.length > 0) {
    bodyLines.push('### Method/Property Changes');
    bodyLines.push('');

    const removed = diff.memberChanges.filter((m) => m.changeType === 'removed');
    const changed = diff.memberChanges.filter((m) => m.changeType === 'signature-changed');
    const added = diff.memberChanges.filter((m) => m.changeType === 'added');

    if (removed.length > 0) {
      bodyLines.push(`**Removed (${removed.length})**`);
      for (const m of removed.slice(0, 5)) {
        bodyLines.push(`- \`${m.className}.${m.memberName}\``);
      }
      if (removed.length > 5) bodyLines.push(`- ...and ${removed.length - 5} more`);
      bodyLines.push('');
    }

    if (changed.length > 0) {
      bodyLines.push(`**Signature Changed (${changed.length})**`);
      for (const m of changed.slice(0, 5)) {
        bodyLines.push(`- \`${m.className}.${m.memberName}\``);
      }
      if (changed.length > 5) bodyLines.push(`- ...and ${changed.length - 5} more`);
      bodyLines.push('');
    }

    if (added.length > 0) {
      bodyLines.push(`**Added (${added.length})**`);
      for (const m of added.slice(0, 3)) {
        bodyLines.push(`- \`${m.className}.${m.memberName}\``);
      }
      if (added.length > 3) bodyLines.push(`- ...and ${added.length - 3} more`);
      bodyLines.push('');
    }
  }

  // New exports section
  if (diff.nonBreaking.length > 0) {
    bodyLines.push(`### ✨ New Exports (${diff.nonBreaking.length})`);
    for (const name of diff.nonBreaking.slice(0, 5)) {
      bodyLines.push(`- \`${name}\``);
    }
    if (diff.nonBreaking.length > 5) {
      bodyLines.push(`- ...and ${diff.nonBreaking.length - 5} more`);
    }
    bodyLines.push('');
  }

  // New undocumented exports warning
  if (diff.newUndocumented.length > 0) {
    bodyLines.push(`### ⚠️ New Undocumented Exports (${diff.newUndocumented.length})`);
    bodyLines.push('');
    bodyLines.push('These new exports are missing documentation:');
    for (const name of diff.newUndocumented.slice(0, 5)) {
      bodyLines.push(`- \`${name}\``);
    }
    if (diff.newUndocumented.length > 5) {
      bodyLines.push(`- ...and ${diff.newUndocumented.length - 5} more`);
    }
    bodyLines.push('');
  }

  // Status message
  if (diff.breaking.length > 0) {
    bodyLines.push('❌ **Breaking changes detected.** Review carefully before merging.');
  } else if (diff.newUndocumented.length > 0) {
    bodyLines.push('⚠️ New exports need documentation. Run `doccov check --fix --generate`.');
  } else if (diff.coverageDelta < 0) {
    bodyLines.push('⚠️ Coverage decreased. Consider adding documentation.');
  } else {
    bodyLines.push('✅ No breaking changes. Documentation is in sync.');
  }

  bodyLines.push('');
  bodyLines.push(
    `<sub>Comparing \`${base.ref}\` (${base.sha.slice(0, 7)}) → \`${head.ref}\` (${head.sha.slice(0, 7)})</sub>`,
  );
  bodyLines.push('');
  bodyLines.push('---');
  bodyLines.push('*Generated by [DocCov](https://doccov.com)*');

  const body = bodyLines.join('\n');

  try {
    const existingId = await findExistingComment(token, owner, repo, prNumber);

    if (existingId) {
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
    console.error('Error posting enhanced PR comment:', err);
    return false;
  }
}
