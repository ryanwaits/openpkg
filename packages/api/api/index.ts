import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';

export const config = {
  runtime: 'edge',
};

const app = new Hono().basePath('/');

// Middleware
app.use('*', cors());

// Types
type BadgeColor = 'brightgreen' | 'green' | 'yellowgreen' | 'yellow' | 'orange' | 'red' | 'lightgrey';

interface OpenPkgSpec {
  docs?: {
    coverageScore?: number;
  };
  [key: string]: unknown;
}

// Badge helpers
function getColorForScore(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellowgreen';
  if (score >= 60) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

function generateBadgeSvg(label: string, message: string, color: BadgeColor): string {
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

async function fetchSpecFromGitHub(owner: string, repo: string, ref = 'main'): Promise<OpenPkgSpec | null> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/openpkg.json`,
    ...(ref === 'main' ? [`https://raw.githubusercontent.com/${owner}/${repo}/master/openpkg.json`] : []),
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as OpenPkgSpec;
      }
    } catch {
      // Try next URL
    }
  }
  return null;
}

// Root
app.get('/', (c) => {
  return c.json({
    name: 'DocCov API',
    version: '0.2.0',
    endpoints: {
      health: '/health',
      badge: '/badge/:owner/:repo',
      spec: '/spec/:owner/:repo/:ref?',
      specPr: '/spec/:owner/:repo/pr/:pr',
      scan: '/scan (POST)',
      scanStream: '/scan-stream (GET)',
    },
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /badge/:owner/:repo
app.get('/badge/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();
  const branch = c.req.query('branch') ?? 'main';

  try {
    const spec = await fetchSpecFromGitHub(owner, repo, branch);

    if (!spec) {
      const svg = generateBadgeSvg('docs', 'not found', 'lightgrey');
      return c.body(svg, 404, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      });
    }

    const coverageScore = spec.docs?.coverageScore ?? 0;
    const svg = generateBadgeSvg('docs', `${coverageScore}%`, getColorForScore(coverageScore));

    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    });
  } catch {
    const svg = generateBadgeSvg('docs', 'error', 'red');
    return c.body(svg, 500, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    });
  }
});

// GET /badge/:owner/:repo.svg (alias)
app.get('/badge/:owner/:repo.svg', async (c) => {
  const owner = c.req.param('owner');
  const repoWithSvg = c.req.param('repo.svg') ?? '';
  const repoName = repoWithSvg.replace(/\.svg$/, '');
  return c.redirect(`/badge/${owner}/${repoName}`);
});

// GET /spec/:owner/:repo/pr/:pr - Must be before the :ref route
app.get('/spec/:owner/:repo/pr/:pr', async (c) => {
  const { owner, repo, pr } = c.req.param();

  try {
    // Get PR head SHA from GitHub API
    const prResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pr}`,
      { headers: { 'User-Agent': 'DocCov' } }
    );

    if (!prResponse.ok) {
      return c.json({ error: 'PR not found' }, 404);
    }

    const prData = (await prResponse.json()) as { head: { sha: string } };
    const headSha = prData.head.sha;

    // Fetch spec from PR head
    const specUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${headSha}/openpkg.json`;
    const specResponse = await fetch(specUrl);

    if (!specResponse.ok) {
      return c.json({ error: 'Spec not found in PR' }, 404);
    }

    const spec = await specResponse.json();
    return c.json(spec, 200, {
      'Cache-Control': 'no-cache',
    });
  } catch {
    return c.json({ error: 'Failed to fetch PR spec' }, 500);
  }
});

// GET /spec/:owner/:repo/:ref? (default ref = main)
app.get('/spec/:owner/:repo/:ref?', async (c) => {
  const { owner, repo } = c.req.param();
  const ref = c.req.param('ref') ?? 'main';

  const spec = await fetchSpecFromGitHub(owner, repo, ref);

  if (!spec) {
    return c.json({ error: 'Spec not found' }, 404);
  }

  return c.json(spec, 200, {
    'Cache-Control': 'public, max-age=300',
  });
});

// Note: /scan and /scan-stream are handled by separate Node.js functions

export default handle(app);
