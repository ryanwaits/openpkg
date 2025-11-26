import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

interface ScanRequestBody {
  url: string;
  ref?: string;
  package?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as ScanRequestBody;

  if (!body.url) {
    return res.status(400).json({ error: 'url is required' });
  }

  // Parse GitHub URL
  const urlMatch = body.url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!urlMatch) {
    return res.status(400).json({ error: 'Invalid GitHub URL' });
  }

  const [, owner, repoWithExt] = urlMatch;
  const repo = repoWithExt.replace(/\.git$/, '');
  const ref = body.ref ?? 'main';

  // Generate a job ID
  const jobId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Build stream URL with params encoded
  const params = new URLSearchParams({
    url: body.url,
    ref,
    owner,
    repo,
  });
  if (body.package) {
    params.set('package', body.package);
  }

  // Return job ID and stream URL with all params
  return res.status(202).json({
    jobId,
    status: 'pending',
    streamUrl: `/scan-stream?${params.toString()}`,
  });
}
