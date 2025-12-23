import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { anonymousRateLimit } from './middleware/anonymous-rate-limit';
import { rateLimit } from './middleware/rate-limit';
import { badgeRoute } from './routes/badge';
import { demoRoute } from './routes/demo';
import { specRoute } from './routes/spec';

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

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'DocCov API',
    version: '0.5.0',
    endpoints: {
      badge: '/badge/:owner/:repo',
      demo: '/demo/plan, /demo/execute',
      spec: '/spec/:owner/:repo',
      health: '/health',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Badge endpoint (public, rate-limited)
app.use(
  '/badge/*',
  anonymousRateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 100,
    message: 'Rate limit reached.',
  }),
);
app.route('/badge', badgeRoute);

// Demo endpoint (public, rate-limited)
app.use(
  '/demo/*',
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many requests. Please try again in a minute.',
  }),
);
app.route('/demo', demoRoute);

// Spec endpoint (public, cached)
app.route('/spec', specRoute);

// Vercel serverless handler + Bun auto-serves this export
export default app;
