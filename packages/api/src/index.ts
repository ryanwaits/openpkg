import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requireApiKey } from './middleware/api-key-auth';
import { orgRateLimit } from './middleware/org-rate-limit';
import { rateLimit } from './middleware/rate-limit';
import { apiKeysRoute } from './routes/api-keys';
import { authRoute } from './routes/auth';
import { badgeRoute } from './routes/badge';
import { billingRoute } from './routes/billing';
import { coverageRoute } from './routes/coverage';
import { orgsRoute } from './routes/orgs';
import { planRoute } from './routes/plan';

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
      orgs: '/orgs/*',
      plan: '/plan',
      v1: '/v1/* (API key required)',
      health: '/health',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public endpoints (no auth)
app.route('/badge', badgeRoute);

// Dashboard endpoints (session auth)
app.route('/auth', authRoute);
app.route('/api-keys', apiKeysRoute);
app.route('/billing', billingRoute);
app.route('/coverage', coverageRoute);
app.route('/orgs', orgsRoute);
app.route('/plan', planRoute);

// API endpoints (API key required)
app.use('/v1/*', requireApiKey(), orgRateLimit());
// TODO: app.route('/v1/analyze', analyzeRoute);

// Vercel serverless handler + Bun auto-serves this export
export default app;
