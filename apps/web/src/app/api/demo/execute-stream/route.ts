const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:3002';

// POST /demo/execute-stream - Proxy SSE to sandbox
export async function POST(request: Request) {
  const url = new URL(request.url);
  const includeSpec = url.searchParams.get('includeSpec');
  const body = await request.json();

  const sandboxUrl = new URL(`${SANDBOX_URL}/execute-stream`);
  if (includeSpec) {
    sandboxUrl.searchParams.set('includeSpec', includeSpec);
  }

  const res = await fetch(sandboxUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Forward the SSE stream
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
