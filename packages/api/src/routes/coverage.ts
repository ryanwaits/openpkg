import { getPlanLimits, type Plan } from '@doccov/db';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { auth } from '../auth/config';
import { db } from '../db/client';

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

type Env = {
  Variables: {
    session: NonNullable<Session>;
  };
};

export const coverageRoute = new Hono<Env>();

// Middleware: require auth
coverageRoute.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('session', session);
  await next();
});

// Get coverage history for a project
coverageRoute.get('/projects/:projectId/history', async (c) => {
  const session = c.get('session');
  const { projectId } = c.req.param();
  const { range = '30d', limit = '50' } = c.req.query();

  // Verify user has access to project and get org plan
  const projectWithOrg = await db
    .selectFrom('projects')
    .innerJoin('org_members', 'org_members.orgId', 'projects.orgId')
    .innerJoin('organizations', 'organizations.id', 'projects.orgId')
    .where('projects.id', '=', projectId)
    .where('org_members.userId', '=', session.user.id)
    .select(['projects.id', 'projects.name', 'organizations.plan'])
    .executeTakeFirst();

  if (!projectWithOrg) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Check plan limits for trends access
  const planLimits = getPlanLimits(projectWithOrg.plan as Plan);
  if (planLimits.historyDays === 0) {
    return c.json(
      {
        error: 'Coverage trends require Team plan or higher',
        upgrade: 'https://doccov.com/pricing',
      },
      403,
    );
  }

  // Calculate date filter based on range (capped by plan limit)
  let dateFilter: Date | null = null;
  const now = new Date();
  const maxDays = planLimits.historyDays;

  // Map range to days, capped by plan limit
  const rangeDays: Record<string, number> = {
    '7d': Math.min(7, maxDays),
    '30d': Math.min(30, maxDays),
    '90d': Math.min(90, maxDays),
  };

  if (range in rangeDays) {
    const days = rangeDays[range];
    dateFilter = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  } else if (range === 'all' || range === 'versions') {
    // Still cap by plan limit
    dateFilter = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);
  }

  let query = db
    .selectFrom('coverage_snapshots')
    .where('projectId', '=', projectId)
    .orderBy('createdAt', 'desc')
    .limit(parseInt(limit, 10));

  if (dateFilter) {
    query = query.where('createdAt', '>=', dateFilter);
  }

  const snapshots = await query
    .select([
      'id',
      'version',
      'branch',
      'commitSha',
      'coveragePercent',
      'documentedCount',
      'totalCount',
      'descriptionCount',
      'paramsCount',
      'returnsCount',
      'examplesCount',
      'driftCount',
      'source',
      'createdAt',
    ])
    .execute();

  // Reverse to get chronological order
  const chronological = snapshots.reverse();

  // Calculate insights
  const insights = generateInsights(chronological);

  // Detect regressions
  const regression = detectRegression(chronological);

  return c.json({
    snapshots: chronological,
    insights,
    regression,
  });
});

// Record a new coverage snapshot
coverageRoute.post('/projects/:projectId/snapshots', async (c) => {
  const session = c.get('session');
  const { projectId } = c.req.param();
  const body = await c.req.json<{
    version?: string;
    branch?: string;
    commitSha?: string;
    coveragePercent: number;
    documentedCount: number;
    totalCount: number;
    descriptionCount?: number;
    paramsCount?: number;
    returnsCount?: number;
    examplesCount?: number;
    driftCount?: number;
    source?: 'ci' | 'manual' | 'scheduled';
  }>();

  // Verify user has admin access to project
  const membership = await db
    .selectFrom('projects')
    .innerJoin('org_members', 'org_members.orgId', 'projects.orgId')
    .where('projects.id', '=', projectId)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['projects.id'])
    .executeTakeFirst();

  if (!membership) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const snapshot = await db
    .insertInto('coverage_snapshots')
    .values({
      id: nanoid(21),
      projectId,
      version: body.version || null,
      branch: body.branch || null,
      commitSha: body.commitSha || null,
      coveragePercent: body.coveragePercent,
      documentedCount: body.documentedCount,
      totalCount: body.totalCount,
      descriptionCount: body.descriptionCount || null,
      paramsCount: body.paramsCount || null,
      returnsCount: body.returnsCount || null,
      examplesCount: body.examplesCount || null,
      driftCount: body.driftCount || 0,
      source: body.source || 'manual',
    })
    .returningAll()
    .executeTakeFirst();

  // Update project's latest coverage
  await db
    .updateTable('projects')
    .set({
      coverageScore: body.coveragePercent,
      driftCount: body.driftCount || 0,
      lastAnalyzedAt: new Date(),
    })
    .where('id', '=', projectId)
    .execute();

  return c.json({ snapshot }, 201);
});

// Helper: Generate insights from coverage data
interface Snapshot {
  version: string | null;
  coveragePercent: number;
  documentedCount: number;
  totalCount: number;
  driftCount: number;
}

interface Insight {
  type: 'improvement' | 'regression' | 'prediction' | 'milestone';
  message: string;
  severity: 'info' | 'warning' | 'success';
}

function generateInsights(snapshots: Snapshot[]): Insight[] {
  const insights: Insight[] = [];
  if (snapshots.length < 2) return insights;

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const diff = last.coveragePercent - first.coveragePercent;

  // Overall improvement/regression
  if (diff > 0) {
    insights.push({
      type: 'improvement',
      message: `Coverage increased ${diff.toFixed(0)}% since ${first.version || 'first snapshot'}`,
      severity: 'success',
    });
  } else if (diff < 0) {
    insights.push({
      type: 'regression',
      message: `Coverage decreased ${Math.abs(diff).toFixed(0)}% since ${first.version || 'first snapshot'}`,
      severity: 'warning',
    });
  }

  // Predict time to 100%
  if (diff > 0 && last.coveragePercent < 100) {
    const remaining = 100 - last.coveragePercent;
    const avgGainPerSnapshot = diff / (snapshots.length - 1);
    if (avgGainPerSnapshot > 0) {
      const snapshotsToComplete = Math.ceil(remaining / avgGainPerSnapshot);
      insights.push({
        type: 'prediction',
        message: `At current pace, 100% coverage in ~${snapshotsToComplete} releases`,
        severity: 'info',
      });
    }
  }

  // Check for milestones
  const milestones = [50, 75, 90, 100];
  for (const milestone of milestones) {
    const crossedAt = snapshots.findIndex(
      (s, i) =>
        i > 0 && s.coveragePercent >= milestone && snapshots[i - 1].coveragePercent < milestone,
    );
    if (crossedAt > 0) {
      insights.push({
        type: 'milestone',
        message: `Reached ${milestone}% coverage at ${snapshots[crossedAt].version || `snapshot ${crossedAt + 1}`}`,
        severity: 'success',
      });
    }
  }

  return insights.slice(0, 5); // Limit to 5 insights
}

// Helper: Detect recent regression
function detectRegression(
  snapshots: Snapshot[],
): { fromVersion: string; toVersion: string; coverageDrop: number; exportsLost: number } | null {
  if (snapshots.length < 2) return null;

  // Look at last 5 snapshots for recent regressions
  const recent = snapshots.slice(-5);
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const drop = prev.coveragePercent - curr.coveragePercent;

    if (drop >= 3) {
      // 3% or more drop
      return {
        fromVersion: prev.version || `v${i}`,
        toVersion: curr.version || `v${i + 1}`,
        coverageDrop: Math.round(drop),
        exportsLost: prev.documentedCount - curr.documentedCount,
      };
    }
  }

  return null;
}
