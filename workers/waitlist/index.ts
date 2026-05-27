/**
 * RacePhysiX Pro Waitlist — Cloudflare Worker
 *
 * POST /waitlist  { email: string }  → stores in KV, sends confirmation via Resend, returns { ok: true }
 * GET  /waitlist?secret=XXX          → returns all emails as CSV (admin)
 *
 * Secrets (set via `wrangler secret put <NAME>`):
 *   ADMIN_SECRET    — protects the GET /waitlist admin dump
 *   RESEND_API_KEY  — Resend transactional email API key (optional: if absent, email is skipped)
 *
 * Resend setup (do once):
 *   1. Create account at https://resend.com
 *   2. Add domain srikarbuddhiraju.com → copy the 2–3 DNS records into Cloudflare DNS
 *   3. Create an API key → wrangler secret put RESEND_API_KEY
 *   Sending address: noreply@racephysix.srikarbuddhiraju.com
 */

export interface Env {
  WAITLIST_KV:    KVNamespace;
  ADMIN_SECRET:   string;
  RESEND_API_KEY: string; // optional — if unset, confirmation email is silently skipped
}

const ALLOWED_ORIGINS = [
  'https://racephysix.srikarbuddhiraju.com',
  'http://localhost:5173', // dev
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
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

// ── Confirmation email ────────────────────────────────────────────────────────

const EMAIL_HTML = (email: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the RacePhysiX Pro waitlist</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a12; font-family: 'Segoe UI', system-ui, sans-serif; }
    .wrap { max-width: 560px; margin: 40px auto; background: #13131c; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a3a; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #13131c 100%); padding: 36px 40px 28px; border-bottom: 1px solid #2a2a3a; }
    .logo { font-size: 22px; font-weight: 800; color: #c0c0ff; letter-spacing: -0.02em; }
    .logo span { color: #6060d0; }
    .body { padding: 32px 40px; }
    h1 { font-size: 20px; font-weight: 700; color: #c0c0e0; margin: 0 0 12px; }
    p { font-size: 14px; color: #a0a0c0; line-height: 1.7; margin: 0 0 16px; }
    .pill { display: inline-block; background: rgba(96,96,208,0.15); border: 1px solid #6060d0; color: #a0a0ff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-bottom: 24px; }
    .feature-list { list-style: none; padding: 0; margin: 0 0 24px; }
    .feature-list li { font-size: 13px; color: #a0a0c0; padding: 6px 0; border-bottom: 1px solid #1e1e2e; display: flex; align-items: center; gap: 10px; }
    .feature-list li:last-child { border-bottom: none; }
    .icon { font-size: 15px; flex-shrink: 0; }
    .cta { display: block; width: 100%; box-sizing: border-box; text-align: center; background: #6060d0; color: #ffffff; font-size: 14px; font-weight: 700; padding: 13px 24px; border-radius: 8px; text-decoration: none; margin-bottom: 24px; }
    .contact { background: #0c0c14; border-radius: 8px; padding: 16px 20px; margin-bottom: 0; }
    .contact p { font-size: 13px; margin: 0; color: #5a5a7a; }
    .contact a { color: #8080b0; }
    .footer { padding: 20px 40px; border-top: 1px solid #1e1e2e; }
    .footer p { font-size: 11px; color: #3a3a5a; margin: 0; line-height: 1.6; }
    .footer a { color: #5a5a7a; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">RacePhysiX<span> Pro</span></div>
    </div>
    <div class="body">
      <div class="pill">✓ You're on the list</div>
      <h1>Thanks for signing up.</h1>
      <p>We've added <strong style="color:#c0c0e0">${email}</strong> to the RacePhysiX Pro waitlist. You'll be the first to know when Pro launches — no spam, one email.</p>

      <p style="font-size:13px; color:#5a5a7a; margin-bottom:20px;">Pro is coming with:</p>
      <ul class="feature-list">
        <li><span class="icon">☁️</span> Cloud setup saves — access your setups from any device</li>
        <li><span class="icon">👥</span> Team workspaces — share with your Formula Student or engineering team</li>
        <li><span class="icon">🔧</span> Custom tyre coefficient import from TIR / TTC data</li>
        <li><span class="icon">📊</span> Lap time database across all 22 circuits</li>
        <li><span class="icon">⚡</span> Priority influence on the roadmap</li>
      </ul>

      <a class="cta" href="https://racephysix.srikarbuddhiraju.com">Use the free simulator now →</a>

      <div class="contact">
        <p>Questions or feedback? Reach out at <a href="mailto:racephysix@srikarbuddhiraju.com">racephysix@srikarbuddhiraju.com</a> — Srikar reads every message.</p>
      </div>
    </div>
    <div class="footer">
      <p>
        You're receiving this because you signed up at racephysix.srikarbuddhiraju.com.<br />
        RacePhysiX · AGPL-3.0 open source · <a href="https://github.com/srikarbuddhiraju/RacePhysiX">GitHub</a>
      </p>
    </div>
  </div>
</body>
</html>`;

const EMAIL_TEXT = (email: string) => `You're on the RacePhysiX Pro waitlist.

We've added ${email} to the list. You'll be the first to know when Pro launches.

Pro is coming with:
- Cloud setup saves
- Team workspaces
- Custom tyre coefficient import
- Lap time database across 22 circuits
- Priority roadmap influence

Use the free simulator now: https://racephysix.srikarbuddhiraju.com

Questions or feedback? Reach out at racephysix@srikarbuddhiraju.com — Srikar reads every message.

---
RacePhysiX · AGPL-3.0 · https://github.com/srikarbuddhiraju/RacePhysiX
`;

async function sendConfirmation(email: string, apiKey: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'RacePhysiX <noreply@racephysix.srikarbuddhiraju.com>',
      to:      [email],
      subject: "You're on the RacePhysiX Pro waitlist",
      html:    EMAIL_HTML(email),
      text:    EMAIL_TEXT(email),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    console.error(`[waitlist] Resend error for ${email}: ${err}`);
    // Don't throw — KV write is the source of truth; email failure is non-fatal
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url    = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── POST /waitlist — submit email ───────────────────────────────────────
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

      // Idempotent: if already signed up, return success without re-sending email
      const existing = await env.WAITLIST_KV.get(email);
      if (existing) {
        return json({ ok: true }, 200, origin);
      }

      // Store first
      await env.WAITLIST_KV.put(email, JSON.stringify({
        email,
        signedUpAt: new Date().toISOString(),
        source: 'pro-waitlist',
      }));

      // Then send confirmation — fire-and-forget, skipped if key not yet configured
      if (env.RESEND_API_KEY) {
        await sendConfirmation(email, env.RESEND_API_KEY);
      }

      return json({ ok: true }, 200, origin);
    }

    // ── GET /waitlist?secret=XXX — admin CSV dump ───────────────────────────
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
