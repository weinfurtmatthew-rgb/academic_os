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

  let res: Response | null = null;
  let url = target;
  try {
    // follow up to 3 redirects, but only to another Canvas feed link (e.g. a school domain that
    // forwards to its instructure.com address)
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(url, {
        redirect: 'manual',
        headers: {
          // some school firewalls turn away requests that don't say what they are
          'user-agent': 'Mozilla/5.0 (compatible; AcademicOS/1.0; +calendar feed import)',
          accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8',
        },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!next) break;
      const hopTo = canvasFeedUrl(new URL(next, url).toString());
      if (!hopTo) return reply(502, `Canvas sent the feed somewhere else (${res.status}). Try copying the link again.`);
      url = hopTo;
    }
  } catch {
    return reply(502, 'Could not reach Canvas');
  }
  if (!res) return reply(502, 'Could not reach Canvas');
  if (res.status === 404) return reply(404, 'Canvas didn’t recognise this feed link (404). Copy it again from Calendar → Calendar Feed.');
  if (res.status === 401 || res.status === 403) {
    return reply(502, `Canvas refused the request (${res.status}). Your school may block outside calendar apps.`);
  }
  if (res.status >= 300 && res.status < 400) return reply(502, `Canvas kept redirecting (${res.status})`);
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
