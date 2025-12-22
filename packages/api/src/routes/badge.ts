import { fetchSpec } from '@doccov/sdk';
import { validateSpec } from '@openpkg-ts/spec';
import { Hono } from 'hono';

export const badgeRoute = new Hono();

type BadgeStyle = 'flat' | 'flat-square' | 'for-the-badge';

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
  style?: BadgeStyle;
}

function getColorForScore(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellowgreen';
  if (score >= 60) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

const BADGE_COLORS: Record<BadgeColor, string> = {
  brightgreen: '#4c1',
  green: '#97ca00',
  yellowgreen: '#a4a61d',
  yellow: '#dfb317',
  orange: '#fe7d37',
  red: '#e05d44',
  lightgrey: '#9f9f9f',
};

function generateFlatBadge(label: string, message: string, bgColor: string): string {
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

function generateFlatSquareBadge(label: string, message: string, bgColor: string): string {
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${bgColor}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

function generateForTheBadge(label: string, message: string, bgColor: string): string {
  const labelUpper = label.toUpperCase();
  const messageUpper = message.toUpperCase();
  const labelWidth = labelUpper.length * 10 + 20;
  const messageWidth = messageUpper.length * 10 + 20;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="28" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="28" fill="${bgColor}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="10" font-weight="bold">
    <text x="${labelWidth / 2}" y="18">${labelUpper}</text>
    <text x="${labelWidth + messageWidth / 2}" y="18">${messageUpper}</text>
  </g>
</svg>`;
}

function generateBadgeSvg(options: BadgeOptions): string {
  const { label, message, color, style = 'flat' } = options;
  const bgColor = BADGE_COLORS[color];

  switch (style) {
    case 'flat-square':
      return generateFlatSquareBadge(label, message, bgColor);
    case 'for-the-badge':
      return generateForTheBadge(label, message, bgColor);
    default:
      return generateFlatBadge(label, message, bgColor);
  }
}

/**
 * Compute coverage score from spec exports if not already present.
 */
function computeCoverageScore(spec: { exports?: { description?: string }[] }): number {
  const exports = spec.exports ?? [];
  if (exports.length === 0) return 0;

  const documented = exports.filter((e) => e.description && e.description.trim().length > 0);
  return Math.round((documented.length / exports.length) * 100);
}

// Cache headers: 5min max-age, stale-if-error for resilience
const CACHE_HEADERS_SUCCESS = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'public, max-age=300, stale-if-error=3600',
};

const CACHE_HEADERS_ERROR = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'no-cache',
};

// GET /badge/:owner/:repo
badgeRoute.get('/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();

  // Query params for customization
  const ref = c.req.query('ref') ?? c.req.query('branch') ?? 'main';
  const specPath = c.req.query('path') ?? c.req.query('package') ?? 'openpkg.json';
  const style = (c.req.query('style') ?? 'flat') as BadgeStyle;

  try {
    const spec = await fetchSpec(owner, repo, { ref, path: specPath });

    if (!spec) {
      const svg = generateBadgeSvg({
        label: 'docs',
        message: 'not found',
        color: 'lightgrey',
        style,
      });

      return c.body(svg, 404, CACHE_HEADERS_ERROR);
    }

    // Validate spec against schema
    const validation = validateSpec(spec);
    if (!validation.ok) {
      const svg = generateBadgeSvg({
        label: 'docs',
        message: 'invalid',
        color: 'lightgrey',
        style,
      });

      return c.body(svg, 422, CACHE_HEADERS_ERROR);
    }

    // Use docs.coverageScore if present (enriched spec), otherwise compute from exports
    // Note: The spec type has changed - check for generation.analysis or similar patterns
    const coverageScore =
      (spec as { docs?: { coverageScore?: number } }).docs?.coverageScore ??
      computeCoverageScore(spec);

    const svg = generateBadgeSvg({
      label: 'docs',
      message: `${coverageScore}%`,
      color: getColorForScore(coverageScore),
      style,
    });

    return c.body(svg, 200, CACHE_HEADERS_SUCCESS);
  } catch {
    const svg = generateBadgeSvg({
      label: 'docs',
      message: 'error',
      color: 'red',
      style,
    });

    return c.body(svg, 500, CACHE_HEADERS_ERROR);
  }
});

// GET /badge/:owner/:repo.svg (alias)
badgeRoute.get('/:owner/:repo.svg', async (c) => {
  const { owner, repo } = c.req.param();
  const repoName = repo.replace(/\.svg$/, '');
  const query = new URL(c.req.url).search;
  return c.redirect(`/badge/${owner}/${repoName}${query}`);
});
