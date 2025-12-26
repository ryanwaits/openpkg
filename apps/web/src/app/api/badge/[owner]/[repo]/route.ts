import { validateSpec } from '@openpkg-ts/spec';
import type { NextRequest } from 'next/server';
import {
  type BadgeStyle,
  computeCoverageScore,
  fetchSpec,
  generateBadgeSvg,
  getColorForScore,
} from '@/lib/badge';

const CACHE_HEADERS_SUCCESS = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'public, max-age=300, stale-if-error=3600',
};

const CACHE_HEADERS_ERROR = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'no-cache',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  const searchParams = request.nextUrl.searchParams;

  const ref = searchParams.get('ref') ?? searchParams.get('branch') ?? 'main';
  const specPath = searchParams.get('path') ?? searchParams.get('package') ?? 'openpkg.json';
  const style = (searchParams.get('style') ?? 'flat') as BadgeStyle;

  try {
    const spec = await fetchSpec(owner, repo, { ref, path: specPath });

    if (!spec) {
      const svg = generateBadgeSvg({
        label: 'docs',
        message: 'not found',
        color: 'lightgrey',
        style,
      });
      return new Response(svg, { status: 404, headers: CACHE_HEADERS_ERROR });
    }

    const validation = validateSpec(spec);
    if (!validation.ok) {
      const svg = generateBadgeSvg({
        label: 'docs',
        message: 'invalid',
        color: 'lightgrey',
        style,
      });
      return new Response(svg, { status: 422, headers: CACHE_HEADERS_ERROR });
    }

    const coverageScore =
      (spec as { docs?: { coverageScore?: number } }).docs?.coverageScore ??
      computeCoverageScore(spec);

    const svg = generateBadgeSvg({
      label: 'docs',
      message: `${coverageScore}%`,
      color: getColorForScore(coverageScore),
      style,
    });

    return new Response(svg, { status: 200, headers: CACHE_HEADERS_SUCCESS });
  } catch {
    const svg = generateBadgeSvg({
      label: 'docs',
      message: 'error',
      color: 'red',
      style,
    });
    return new Response(svg, { status: 500, headers: CACHE_HEADERS_ERROR });
  }
}
