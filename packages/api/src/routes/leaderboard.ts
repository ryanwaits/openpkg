import type { OpenPkg } from '@openpkg-ts/spec';
import { Hono } from 'hono';

export const leaderboardRoute = new Hono();

interface LeaderboardEntry {
  owner: string;
  repo: string;
  coverage: number;
  exportCount: number;
  driftCount: number;
  lastUpdated: string;
}

// In-memory cache for demo purposes
// In production, this would be backed by a database
const leaderboardCache = new Map<string, LeaderboardEntry[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let lastCacheUpdate = 0;

// Popular TypeScript libraries to track
const TRACKED_REPOS = [
  { owner: 'tanstack', repo: 'query' },
  { owner: 'trpc', repo: 'trpc' },
  { owner: 'colinhacks', repo: 'zod' },
  { owner: 'drizzle-team', repo: 'drizzle-orm' },
  { owner: 'pmndrs', repo: 'zustand' },
  { owner: 'jaredpalmer', repo: 'formik' },
  { owner: 'react-hook-form', repo: 'react-hook-form' },
  { owner: 'TanStack', repo: 'router' },
  { owner: 'TanStack', repo: 'table' },
  { owner: 'tailwindlabs', repo: 'headlessui' },
];

async function fetchSpecFromGitHub(owner: string, repo: string): Promise<OpenPkg | null> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/main/openpkg.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/openpkg.json`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as OpenPkg;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}

async function buildLeaderboard(category?: string): Promise<LeaderboardEntry[]> {
  const entries: LeaderboardEntry[] = [];

  // Fetch specs for all tracked repos
  const fetchPromises = TRACKED_REPOS.map(async ({ owner, repo }) => {
    const spec = await fetchSpecFromGitHub(owner, repo);
    if (spec) {
      const driftCount = spec.exports.reduce((count, exp) => {
        return count + (exp.docs?.drift?.length ?? 0);
      }, 0);

      entries.push({
        owner,
        repo,
        coverage: spec.docs?.coverageScore ?? 0,
        exportCount: spec.exports.length,
        driftCount,
        lastUpdated: new Date().toISOString(),
      });
    }
  });

  await Promise.allSettled(fetchPromises);

  // Sort by coverage descending
  entries.sort((a, b) => b.coverage - a.coverage);

  return entries;
}

// GET /leaderboard
leaderboardRoute.get('/', async (c) => {
  const category = c.req.query('category');
  const limit = Math.min(Number(c.req.query('limit')) || 100, 100);

  const cacheKey = category ?? 'all';
  const now = Date.now();

  // Check cache
  if (leaderboardCache.has(cacheKey) && now - lastCacheUpdate < CACHE_TTL) {
    const cached = leaderboardCache.get(cacheKey) ?? [];
    return c.json({
      entries: cached.slice(0, limit),
      total: cached.length,
      category: category ?? 'all',
      lastUpdated: new Date(lastCacheUpdate).toISOString(),
    });
  }

  try {
    const entries = await buildLeaderboard(category);
    leaderboardCache.set(cacheKey, entries);
    lastCacheUpdate = now;

    return c.json({
      entries: entries.slice(0, limit),
      total: entries.length,
      category: category ?? 'all',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// GET /leaderboard/:owner/:repo
leaderboardRoute.get('/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();

  try {
    const spec = await fetchSpecFromGitHub(owner, repo);

    if (!spec) {
      return c.json(
        {
          error: 'Not found',
          message: `No openpkg.json found for ${owner}/${repo}`,
        },
        404,
      );
    }

    const driftCount = spec.exports.reduce((count, exp) => {
      return count + (exp.docs?.drift?.length ?? 0);
    }, 0);

    const missingDocs = spec.exports.filter((exp) => (exp.docs?.missing?.length ?? 0) > 0);

    return c.json({
      owner,
      repo,
      coverage: spec.docs?.coverageScore ?? 0,
      exportCount: spec.exports.length,
      driftCount,
      missingDocsCount: missingDocs.length,
      version: spec.meta.version,
      name: spec.meta.name,
      exports: spec.exports.map((exp) => ({
        name: exp.name,
        kind: exp.kind,
        coverage: exp.docs?.coverageScore ?? 0,
        driftCount: exp.docs?.drift?.length ?? 0,
        missing: exp.docs?.missing ?? [],
      })),
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch repo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// POST /leaderboard/submit
// Allow repos to submit themselves to the leaderboard
leaderboardRoute.post('/submit', async (c) => {
  try {
    const body = await c.req.json<{ owner: string; repo: string }>();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return c.json({ error: 'Missing owner or repo' }, 400);
    }

    const spec = await fetchSpecFromGitHub(owner, repo);

    if (!spec) {
      return c.json(
        {
          error: 'Not found',
          message: `No openpkg.json found for ${owner}/${repo}. Generate one with: doccov generate`,
        },
        404,
      );
    }

    return c.json({
      success: true,
      message: `${owner}/${repo} added to leaderboard tracking`,
      coverage: spec.docs?.coverageScore ?? 0,
    });
  } catch (error) {
    return c.json(
      {
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      400,
    );
  }
});
