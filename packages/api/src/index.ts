import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimit } from './middleware/rate-limit';
import { badgeRoute } from './routes/badge';
import { planRoute } from './routes/plan';

const app = new Hono();

// Middleware
app.use('*', cors());

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
    version: '0.4.0',
    endpoints: {
      badge: '/badge/:owner/:repo',
      plan: '/plan',
      execute: '/execute',
      'execute-stream': '/execute-stream',
      health: '/health',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.route('/badge', badgeRoute);
app.route('/plan', planRoute);

// Vercel serverless handler + Bun auto-serves this export
export default app;
