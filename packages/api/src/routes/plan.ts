/**
 * Plan route - TODO: implement plan-agent
 */

import { Hono } from 'hono';

export const planRoute = new Hono();

planRoute.post('/', async (c) => {
  return c.json({ error: 'Plan endpoint not yet implemented' }, 501);
});
