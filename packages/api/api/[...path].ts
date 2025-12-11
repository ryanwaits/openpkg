/**
 * Catch-all router for Vercel serverless functions.
 * Routes requests to the appropriate bundled function handler.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import bundled handlers (built by bunup)
import executeHandler from '../dist/functions/execute';
import executeStreamHandler from '../dist/functions/execute-stream';
import planHandler from '../dist/functions/plan';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>;

const handlers: Record<string, Handler> = {
  execute: executeHandler,
  'execute-stream': executeStreamHandler,
  plan: planHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract path from catch-all
  const pathSegments = req.query.path;
  const route = Array.isArray(pathSegments) ? pathSegments[0] : pathSegments;

  if (!route || !handlers[route]) {
    return res.status(404).json({ error: 'Not found', availableRoutes: Object.keys(handlers) });
  }

  return handlers[route](req, res);
}
