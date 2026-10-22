/*
 * The app is static files; this Worker adds one route. Browsers can't read a Canvas calendar feed
 * from another site (Canvas sends no CORS headers), so /api/canvas-feed fetches it server-side and
 * hands it back. It only ever fetches Canvas feed links, never stores them, and caches nothing.
 */
import { canvasFeedUrl } from '../src/lib/canvas/feed';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const MAX_BYTES = 5 * 1024 * 1024;

function reply(status: number, body: string, type = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status,
    headers: { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

async function canvasFeed(request: Request): Promise<Response> {
  if (request.method !== 'GET') return reply(405, 'GET only');
  const target = canvasFeedUrl(new URL(request.url).searchParams.get('url') ?? '');
  if (!target) return reply(400, 'Not a Canvas calendar feed link');

  let res: Response;
  try {
    // redirects aren't followed: a feed link that bounces elsewhere isn't a feed link
    res = await fetch(target, { redirect: 'manual', headers: { accept: 'text/calendar' } });
  } catch {
    return reply(502, 'Could not reach Canvas');
  }
  if (res.status === 404 || res.status === 401 || res.status === 403) return reply(404, 'Canvas did not recognise this feed link');
  if (!res.ok) return reply(502, `Canvas answered ${res.status}`);

  const text = await res.text();
  if (text.length > MAX_BYTES) return reply(502, 'Feed is too large');
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) return reply(502, 'Canvas did not send a calendar');
  return reply(200, text, 'text/calendar; charset=utf-8');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/canvas-feed') return canvasFeed(request);
    return env.ASSETS.fetch(request);
  },
};
