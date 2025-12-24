const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:3002';

// POST /demo/plan - Proxy to sandbox
export async function POST(request: Request) {
  const body = await request.json();

  const res = await fetch(`${SANDBOX_URL}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
