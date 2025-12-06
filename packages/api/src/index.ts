import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimit } from './middleware/rate-limit';
import { badgeRoute } from './routes/badge';
import { scanRoute } from './routes/scan';

const app = new Hono();

// Middleware
app.use('*', cors());

// Rate limit /scan endpoint: 10 requests per minute per IP
app.use(
  '/scan/*',
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many scan requests. Please try again in a minute.',
  }),
);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'DocCov API',
    version: '0.3.0',
    endpoints: {
      badge: '/badge/:owner/:repo',
      scan: '/scan',
      health: '/health',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.route('/badge', badgeRoute);
app.route('/scan', scanRoute);

// Vercel serverless handler + Bun auto-serves this export
export default app;
