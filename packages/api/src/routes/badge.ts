import { Hono } from 'hono';
import { fetchSpecFromGitHub } from '../utils/github';

export const badgeRoute = new Hono();

type BadgeColor =
  | 'brightgreen'
  | 'green'
  | 'yellowgreen'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'lightgrey';

interface BadgeOptions {
  label: string;
  message: string;
  color: BadgeColor;
}

function getColorForScore(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellowgreen';
  if (score >= 60) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

function generateBadgeSvg(options: BadgeOptions): string {
  const { label, message, color } = options;

  const colors: Record<BadgeColor, string> = {
    brightgreen: '#4c1',
    green: '#97ca00',
    yellowgreen: '#a4a61d',
    yellow: '#dfb317',
    orange: '#fe7d37',
    red: '#e05d44',
    lightgrey: '#9f9f9f',
  };

  const bgColor = colors[color];

  // Simple badge dimensions
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${bgColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

// GET /badge/:owner/:repo
badgeRoute.get('/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();
  const branch = c.req.query('branch') ?? 'main';

  try {
    const spec = await fetchSpecFromGitHub(owner, repo, branch);

    if (!spec) {
      const svg = generateBadgeSvg({
        label: 'docs',
        message: 'not found',
        color: 'lightgrey',
      });

      return c.body(svg, 404, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      });
    }

    const coverageScore = spec.docs?.coverageScore ?? 0;
    const svg = generateBadgeSvg({
      label: 'docs',
      message: `${coverageScore}%`,
      color: getColorForScore(coverageScore),
    });

    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    });
  } catch {
    const svg = generateBadgeSvg({
      label: 'docs',
      message: 'error',
      color: 'red',
    });

    return c.body(svg, 500, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    });
  }
});

// GET /badge/:owner/:repo.svg (alias)
badgeRoute.get('/:owner/:repo.svg', async (c) => {
  const { owner, repo } = c.req.param();
  const repoName = repo.replace(/\.svg$/, '');
  return c.redirect(`/badge/${owner}/${repoName}`);
});
