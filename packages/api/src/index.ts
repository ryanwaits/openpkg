import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { badgeRoute } from './routes/badge';
import { leaderboardRoute } from './routes/leaderboard';
import { scanRoute } from './routes/scan';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'DocCov API',
    version: '0.2.0',
    endpoints: {
      badge: '/badge/:owner/:repo',
      leaderboard: '/leaderboard',
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
app.route('/leaderboard', leaderboardRoute);
app.route('/scan', scanRoute);

const port = Number(process.env.PORT) || 3000;

console.log(`DocCov API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
