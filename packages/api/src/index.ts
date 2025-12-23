import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { anonymousRateLimit } from './middleware/anonymous-rate-limit';
import { requireApiKey } from './middleware/api-key-auth';
import { orgRateLimit } from './middleware/org-rate-limit';
import { rateLimit } from './middleware/rate-limit';
import { aiRoute } from './routes/ai';
import { apiKeysRoute } from './routes/api-keys';
import { authRoute } from './routes/auth';
import { badgeRoute } from './routes/badge';
import { billingRoute } from './routes/billing';
import { coverageRoute } from './routes/coverage';
import { demoRoute } from './routes/demo';
import { githubAppRoute } from './routes/github-app';
import { invitesRoute } from './routes/invites';
import { orgsRoute } from './routes/orgs';
import { planRoute } from './routes/plan';
import { specRoute } from './routes/spec';
import { specV1Route } from './routes/spec-v1';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.SITE_URL || 'http://localhost:3000',
    credentials: true,
  }),
);

// Rate limit /plan endpoint: 10 requests per minute per IP
app.use(
  '/plan',
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many plan requests. Please try again in a minute.',
  }),
);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'DocCov API',
    version: '0.5.0',
    endpoints: {
      auth: '/auth/*',
      apiKeys: '/api-keys/*',
      badge: '/badge/:owner/:repo',
      billing: '/billing/*',
      coverage: '/coverage/*',
      github: '/github/* (App install, webhooks)',
      invites: '/invites/:token',
      orgs: '/orgs/*',
      plan: '/plan',
      spec: '/spec/diff (POST, session auth)',
      v1: {
        ai: '/v1/ai/generate (POST), /v1/ai/quota (GET)',
        spec: '/v1/spec/diff (POST, API key)',
      },
      health: '/health',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public endpoints (no auth)
// Anonymous rate limit: 10 requests per day per IP
app.use(
  '/badge/*',
  anonymousRateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 10,
    message: 'Rate limit reached. Sign up free for 100/day.',
    upgradeUrl: 'https://doccov.com/signup',
  }),
);
app.route('/badge', badgeRoute);

// Semi-public endpoints (invite info is public, acceptance requires auth)
app.route('/invites', invitesRoute);

// GitHub App (install/callback need auth, webhook is public)
app.route('/github', githubAppRoute);

// Demo endpoint (public, rate-limited)
app.route('/demo', demoRoute);

// Dashboard endpoints (session auth)
app.route('/auth', authRoute);
app.route('/api-keys', apiKeysRoute);
app.route('/billing', billingRoute);
app.route('/coverage', coverageRoute);
app.route('/orgs', orgsRoute);
app.route('/plan', planRoute);
app.route('/spec', specRoute);

// API endpoints (API key required)
app.use('/v1/*', requireApiKey(), orgRateLimit());
app.route('/v1/ai', aiRoute);
app.route('/v1/spec', specV1Route);

// Vercel serverless handler + Bun auto-serves this export
export default app;
