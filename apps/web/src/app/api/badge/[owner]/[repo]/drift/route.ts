import type { NextRequest } from 'next/server';
import { type BadgeStyle, fetchSpec, generateBadgeSvg, getDriftColor } from '@/lib/badge';

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
        label: 'drift',
        message: 'not found',
        color: 'lightgrey',
        style,
      });
      return new Response(svg, { status: 404, headers: CACHE_HEADERS_ERROR });
    }

    const exports = spec.exports ?? [];
    const exportsWithDrift = exports.filter((e) => {
      const docs = (e as { docs?: { drift?: unknown[] } }).docs;
      return docs?.drift && Array.isArray(docs.drift) && docs.drift.length > 0;
    });
    const driftScore =
      exports.length === 0 ? 0 : Math.round((exportsWithDrift.length / exports.length) * 100);

    const svg = generateBadgeSvg({
      label: 'drift',
      message: `${driftScore}%`,
      color: getDriftColor(driftScore),
      style,
    });

    return new Response(svg, { status: 200, headers: CACHE_HEADERS_SUCCESS });
  } catch {
    const svg = generateBadgeSvg({
      label: 'drift',
      message: 'error',
      color: 'red',
      style,
    });
    return new Response(svg, { status: 500, headers: CACHE_HEADERS_ERROR });
  }
}
