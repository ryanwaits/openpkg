import type { OpenPkg } from '@openpkg-ts/spec';

export type BadgeStyle = 'flat' | 'flat-square' | 'for-the-badge';

/**
 * Fetch an OpenPkg spec from GitHub raw.
 * Edge-compatible - uses only fetch.
 */
export async function fetchSpec(
  owner: string,
  repo: string,
  options: { ref?: string; path?: string } = {}
): Promise<OpenPkg | null> {
  const ref = options.ref ?? 'main';
  const specPath = options.path ?? 'openpkg.json';

  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${specPath}`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/${specPath}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return (await res.json()) as OpenPkg;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}

export type BadgeColor =
  | 'brightgreen'
  | 'green'
  | 'yellowgreen'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'lightgrey';

export interface BadgeOptions {
  label: string;
  message: string;
  color: BadgeColor;
  style?: BadgeStyle;
}

export function getColorForScore(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellowgreen';
  if (score >= 60) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

export function getDriftColor(score: number): BadgeColor {
  // Inverse of coverage - lower is better
  if (score <= 5) return 'brightgreen';
  if (score <= 10) return 'green';
  if (score <= 20) return 'yellowgreen';
  if (score <= 30) return 'yellow';
  if (score <= 50) return 'orange';
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

export function generateBadgeSvg(options: BadgeOptions): string {
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

export function computeCoverageScore(spec: { exports?: { description?: string }[] }): number {
  const exports = spec.exports ?? [];
  if (exports.length === 0) return 0;

  const documented = exports.filter((e) => e.description && e.description.trim().length > 0);
  return Math.round((documented.length / exports.length) * 100);
}
