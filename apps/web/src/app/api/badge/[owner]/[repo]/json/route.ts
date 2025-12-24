import { validateSpec } from '@openpkg-ts/spec';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { computeCoverageScore, fetchSpec, getColorForScore } from '@/lib/badge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const searchParams = request.nextUrl.searchParams;

  const ref = searchParams.get('ref') ?? searchParams.get('branch') ?? 'main';
  const specPath = searchParams.get('path') ?? searchParams.get('package') ?? 'openpkg.json';

  try {
    const spec = await fetchSpec(owner, repo, { ref, path: specPath });

    if (!spec) {
      return NextResponse.json(
        { schemaVersion: 1, label: 'docs', message: 'not found', color: 'lightgrey' },
        { status: 404, headers: { 'Cache-Control': 'no-cache' } }
      );
    }

    const validation = validateSpec(spec);
    if (!validation.ok) {
      return NextResponse.json(
        { schemaVersion: 1, label: 'docs', message: 'invalid', color: 'lightgrey' },
        { status: 422, headers: { 'Cache-Control': 'no-cache' } }
      );
    }

    const coverageScore =
      (spec as { docs?: { coverageScore?: number } }).docs?.coverageScore ??
      computeCoverageScore(spec);

    return NextResponse.json(
      {
        schemaVersion: 1,
        label: 'docs',
        message: `${coverageScore}%`,
        color: getColorForScore(coverageScore),
      },
      { status: 200, headers: { 'Cache-Control': 'public, max-age=300, stale-if-error=3600' } }
    );
  } catch {
    return NextResponse.json(
      { schemaVersion: 1, label: 'docs', message: 'error', color: 'red' },
      { status: 500, headers: { 'Cache-Control': 'no-cache' } }
    );
  }
}
