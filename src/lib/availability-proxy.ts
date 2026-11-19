import 'server-only';
import type { NextRequest } from 'next/server';
import { SITE } from '@/config/site';

/**
 * Same-origin bridge only. Python still validates the user's signed session
 * and CSRF token; the bridge never adds an admin key or bypasses authentication.
 */
export async function proxyAvailability(request: NextRequest): Promise<Response> {
  const jsonError = (detail: string, status: number) =>
    Response.json({ detail }, { status, headers: { 'cache-control': 'no-store' } });
  if (!SITE.features.hutAdmin) return jsonError('Not found.', 404);
  const configured = process.env.AVAILABILITY_API_URL?.trim();
  const origin = configured || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5001' : '');
  if (!origin) return jsonError(
    'The availability service is not configured. Set AVAILABILITY_API_URL on the Next.js host to your running FastAPI service URL, then redeploy.', 503,
  );
  let target: URL;
  try {
    target = new URL(origin);
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password ||
      target.pathname !== '/' || target.search || target.hash) throw new Error('Invalid service origin');
  } catch {
    return jsonError('AVAILABILITY_API_URL must be an HTTP(S) origin without credentials or a path.', 503);
  }
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'x-csrf-token', 'x-api-key', 'accept', 'origin']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  try {
    const upstream = await fetch(target, {
      method: request.method, headers, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      ...(!['GET', 'HEAD'].includes(request.method) ? { body: await request.arrayBuffer() } : {}),
    });
    const responseHeaders = new Headers({
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    });
    for (const name of ['content-type', 'content-disposition', 'retry-after', 'allow']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', cookie);
    // These endpoints return data, not redirects to an HTML admin page.
    if (upstream.status >= 300 && upstream.status < 400) {
      return jsonError('The availability service returned an unexpected redirect. Check its URL.', 502);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError('The availability service could not be reached. Check that the FastAPI service is running, then try again.', 502);
  }
}
