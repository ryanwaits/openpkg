import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit } from '@doccov/api-shared/middleware/rate-limit';

// Rate limit configs by route pattern
const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/badge': { windowMs: 24 * 60 * 60 * 1000, max: 1000 }, // 1000/day
  '/api/v1/ai': { windowMs: 60 * 1000, max: 20 }, // 20/minute
  '/api/v1/spec': { windowMs: 60 * 1000, max: 30 }, // 30/minute
  '/api/demo': { windowMs: 60 * 1000, max: 10 }, // 10/minute
};

function getRateLimitConfig(pathname: string): { windowMs: number; max: number } | null {
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(pattern)) {
      return config;
    }
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // api.doccov.com: only allow API routes, rewrite paths without /api prefix
  if (host.startsWith('api.')) {
    if (!pathname.startsWith('/api/') && !pathname.startsWith('/api')) {
      // Rewrite /billing/webhook → /api/billing/webhook
      const url = request.nextUrl.clone();
      url.pathname = `/api${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check rate limit for configured routes
  const rateLimitConfig = getRateLimitConfig(pathname);
  if (rateLimitConfig) {
    const result = checkRateLimit(request as unknown as Request, {
      ...rateLimitConfig,
      prefix: `ratelimit:${pathname.split('/')[2]}`, // Use route segment as prefix
    });

    if (!result.ok) {
      const response = NextResponse.json(
        { error: 'Too many requests', retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) },
        { status: 429 }
      );
      response.headers.set('X-RateLimit-Limit', String(result.limit));
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
      response.headers.set('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)));
      return response;
    }

    // Continue with rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
