import type { NextRequest } from 'next/server';
import { SITE } from '@/config/site';
import { isKnownCrawlerUserAgent, parseClientAnalyticsEvent } from '@/lib/analytics/schema';

export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 4096;
const reply = (status: number, message?: string) => new Response(message ?? null, {
  status, headers: { 'cache-control': 'no-store' },
});

export async function POST(request: NextRequest): Promise<Response> {
  if (!SITE.analytics.destinations.vercelAudit || process.env.VERCEL_AUDIT_LOGGING_ENABLED !== 'true') {
    return reply(404, 'Not found');
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return reply(415, 'Unsupported media type');
  }
  try {
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host.toLowerCase() !== request.nextUrl.host.toLowerCase()) {
      return reply(403, 'Cross-origin request denied');
    }
  } catch { return reply(403, 'Invalid origin'); }

  let body: unknown;
  const reader = request.body?.getReader();
  if (!reader) return reply(400, 'Invalid event');
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return reply(413, 'Invalid event');
      }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return reply(400, 'Invalid event'); }

  const event = parseClientAnalyticsEvent(body);
  if (!event || !SITE.analytics.destinations.auditEventNames.includes(event.eventName)) {
    return reply(400, 'Invalid event');
  }
  console.log(JSON.stringify({
    log_type: 'visitor_analytics_event',
    received_at: new Date().toISOString(),
    deployment_environment: process.env.VERCEL_ENV ?? 'unknown',
    deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    actor_type: isKnownCrawlerUserAgent(request.headers.get('user-agent') ?? '') ? 'crawler' : 'unclassified',
    event,
  }));
  return reply(204);
}
