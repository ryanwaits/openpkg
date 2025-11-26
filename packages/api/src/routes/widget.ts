import type { OpenPkg } from '@openpkg-ts/spec';
import { Hono } from 'hono';
import { fetchSpecFromGitHub } from '../utils/github';

export const widgetRoute = new Hono();

type SignalCoverage = {
  description: number;
  params: number;
  returns: number;
  examples: number;
  overall: number;
};

function computeSignalCoverage(spec: OpenPkg): SignalCoverage {
  const exports = spec.exports ?? [];
  const signals = {
    description: { covered: 0, total: 0 },
    params: { covered: 0, total: 0 },
    returns: { covered: 0, total: 0 },
    examples: { covered: 0, total: 0 },
  };

  for (const exp of exports) {
    const missing = exp.docs?.missing ?? [];
    for (const sig of ['description', 'params', 'returns', 'examples'] as const) {
      signals[sig].total++;
      if (!missing.includes(sig)) signals[sig].covered++;
    }
  }

  const pct = (s: { covered: number; total: number }) =>
    s.total ? Math.round((s.covered / s.total) * 100) : 0;

  return {
    description: pct(signals.description),
    params: pct(signals.params),
    returns: pct(signals.returns),
    examples: pct(signals.examples),
    overall: spec.docs?.coverageScore ?? 0,
  };
}

function getColorForScore(score: number): string {
  if (score >= 90) return '#4c1';
  if (score >= 80) return '#97ca00';
  if (score >= 70) return '#a4a61d';
  if (score >= 60) return '#dfb317';
  if (score >= 50) return '#fe7d37';
  return '#e05d44';
}

type WidgetTheme = 'dark' | 'light';

interface WidgetOptions {
  theme: WidgetTheme;
  compact: boolean;
}

function generateWidgetSvg(stats: SignalCoverage, options: WidgetOptions): string {
  const { theme, compact } = options;
  const isDark = theme === 'dark';

  const bg = isDark ? '#0d1117' : '#ffffff';
  const fg = isDark ? '#c9d1d9' : '#24292f';
  const border = isDark ? '#30363d' : '#d0d7de';
  const barBg = isDark ? '#21262d' : '#eaeef2';
  const accent = '#58a6ff';

  const width = compact ? 160 : 200;
  const rowHeight = 18;
  const headerHeight = 28;
  const padding = 8;
  const barWidth = compact ? 60 : 80;
  const labelWidth = compact ? 0 : 70;

  const signals = [
    { key: 'description', label: 'desc', pct: stats.description },
    { key: 'params', label: 'params', pct: stats.params },
    { key: 'returns', label: 'returns', pct: stats.returns },
    { key: 'examples', label: 'examples', pct: stats.examples },
  ];

  const height = headerHeight + signals.length * rowHeight + padding * 2;

  const rows = signals
    .map((s, i) => {
      const y = headerHeight + padding + i * rowHeight;
      const barFill = (s.pct / 100) * barWidth;
      const color = getColorForScore(s.pct);

      if (compact) {
        return `
      <g transform="translate(${padding}, ${y})">
        <rect x="0" y="2" width="${barWidth}" height="12" rx="2" fill="${barBg}"/>
        <rect x="0" y="2" width="${barFill}" height="12" rx="2" fill="${color}"/>
        <text x="${barWidth + 6}" y="12" font-size="10" fill="${fg}">${s.pct}%</text>
      </g>`;
      }

      return `
      <g transform="translate(${padding}, ${y})">
        <text x="0" y="12" font-size="10" fill="${fg}">${s.label}</text>
        <rect x="${labelWidth}" y="2" width="${barWidth}" height="12" rx="2" fill="${barBg}"/>
        <rect x="${labelWidth}" y="2" width="${barFill}" height="12" rx="2" fill="${color}"/>
        <text x="${labelWidth + barWidth + 6}" y="12" font-size="10" fill="${fg}">${s.pct}%</text>
      </g>`;
    })
    .join('');

  const overallColor = getColorForScore(stats.overall);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="6" fill="${bg}" stroke="${border}" stroke-width="1"/>
  <g transform="translate(${padding}, 0)">
    <text x="0" y="18" font-size="12" font-weight="600" fill="${accent}">DocCov</text>
    <text x="${width - padding * 2}" y="18" font-size="12" font-weight="600" fill="${overallColor}" text-anchor="end">${stats.overall}%</text>
  </g>
  <line x1="0" y1="${headerHeight}" x2="${width}" y2="${headerHeight}" stroke="${border}" stroke-width="1"/>
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }</style>
  ${rows}
</svg>`;
}

function generateErrorSvg(message: string, theme: WidgetTheme): string {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0d1117' : '#ffffff';
  const fg = isDark ? '#c9d1d9' : '#24292f';
  const border = isDark ? '#30363d' : '#d0d7de';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50">
  <rect width="160" height="50" rx="6" fill="${bg}" stroke="${border}" stroke-width="1"/>
  <text x="80" y="20" font-size="12" font-weight="600" fill="#58a6ff" text-anchor="middle">DocCov</text>
  <text x="80" y="36" font-size="10" fill="${fg}" text-anchor="middle">${message}</text>
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }</style>
</svg>`;
}

// GET /widget/:owner/:repo
widgetRoute.get('/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();
  const branch = c.req.query('branch') ?? 'main';
  const theme = (c.req.query('theme') ?? 'dark') as WidgetTheme;
  const compact = c.req.query('compact') === 'true';

  try {
    const spec = await fetchSpecFromGitHub(owner, repo, branch);

    if (!spec) {
      const svg = generateErrorSvg('not found', theme);
      return c.body(svg, 404, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      });
    }

    const stats = computeSignalCoverage(spec);
    const svg = generateWidgetSvg(stats, { theme, compact });

    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    });
  } catch {
    const svg = generateErrorSvg('error', theme);
    return c.body(svg, 500, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    });
  }
});

// GET /widget/:owner/:repo.svg (alias)
widgetRoute.get('/:owner/:repo.svg', async (c) => {
  const { owner, repo } = c.req.param();
  const repoName = repo.replace(/\.svg$/, '');
  return c.redirect(`/widget/${owner}/${repoName}?${c.req.url.split('?')[1] ?? ''}`);
});
