// Supabase Edge Function (Deno)
// Deploy using `supabase functions deploy send-email`.
// This example calls SendGrid. Set SENDGRID_API_KEY and SENDGRID_FROM in supabase project env.

import { serve } from 'std/server';

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const body = await req.json();
    const { to, subject, html, text } = body ?? {};
    if (!to || !subject) return new Response('missing to or subject', { status: 400 });

    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'no-reply@example.com';

    if (SENDGRID_API_KEY) {
      const payload = {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: SENDGRID_FROM },
        subject,
        content: [
          { type: 'text/plain', value: text ?? '' },
          { type: 'text/html', value: html ?? '' },
        ],
      };
      const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) return new Response(`SendGrid error ${r.status}`, { status: 502 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('No provider configured (set SENDGRID_API_KEY)', { status: 400 });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
});
