import { serve } from '@hono/node-server';
import { runMigrations } from './db/migrate';
import app from './index';

const port = parseInt(process.env.PORT || '3001');

async function start() {
  // Run migrations on startup
  console.log('Running migrations...');
  await runMigrations();

  // Start server
  console.log(`Starting server on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`Server running at http://localhost:${port}`);
}

start().catch(console.error);
