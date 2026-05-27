/**
 * RacePhysiX Pro Waitlist — Cloudflare Worker
 *
 * POST /waitlist  { email: string }  → stores in KV, returns { ok: true }
 * GET  /waitlist?secret=XXX          → returns all emails as CSV (admin)
 */

export interface Env {
  WAITLIST_KV: KVNamespace;
  ADMIN_SECRET: string; // set in Cloudflare dashboard → Workers → Settings → Variables
}

const ALLOWED_ORIGINS = [
  'https://racephysix.srikarbuddhiraju.com',
  'http://localhost:5173', // dev
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    // ── CORS preflight ────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── POST /waitlist — submit email ─────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/waitlist') {
      let body: { email?: unknown };
      try {
        body = await request.json() as { email?: unknown };
      } catch {
        return json({ ok: false, error: 'Invalid JSON' }, 400, origin);
      }

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!isValidEmail(email)) {
        return json({ ok: false, error: 'Invalid email address' }, 400, origin);
      }

      // Idempotent: storing same email twice is a no-op (KV key = email)
      const existing = await env.WAITLIST_KV.get(email);
      if (existing) {
        // Already signed up — return success silently (don't leak who's on the list)
        return json({ ok: true }, 200, origin);
      }

      await env.WAITLIST_KV.put(email, JSON.stringify({
        email,
        signedUpAt: new Date().toISOString(),
        source: 'pro-waitlist',
      }));

      return json({ ok: true }, 200, origin);
    }

    // ── GET /waitlist?secret=XXX — admin dump ─────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/waitlist') {
      const secret = url.searchParams.get('secret') ?? '';
      if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }

      const list = await env.WAITLIST_KV.list();
      const rows: string[] = ['email,signedUpAt,source'];

      for (const key of list.keys) {
        const raw = await env.WAITLIST_KV.get(key.name);
        if (!raw) continue;
        try {
          const entry = JSON.parse(raw) as { email: string; signedUpAt: string; source: string };
          rows.push(`${entry.email},${entry.signedUpAt},${entry.source}`);
        } catch {
          rows.push(`${key.name},,`);
        }
      }

      return new Response(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="waitlist.csv"',
        },
      });
    }

    return json({ ok: false, error: 'Not found' }, 404, origin);
  },
};
