// Vercel Serverless Function (Node)
// Usage: deploy under /api/send-email. Expects SENDGRID_API_KEY and SENDGRID_FROM
// or implement your own provider logic.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { to, subject, html, text } = req.body ?? {};
    if (!to || !subject) return res.status(400).json({ error: 'missing to or subject' });

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const SENDGRID_FROM = process.env.SENDGRID_FROM || 'no-reply@example.com';

    if (SENDGRID_API_KEY) {
      // Send via SendGrid API
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
      if (!r.ok) {
        const body = await r.text();
        return res.status(502).json({ error: 'SendGrid error', status: r.status, body });
      }
      return res.json({ ok: true });
    }

    // No provider configured — return 400 so deployer knows to configure env
    return res.status(400).json({ error: 'No provider configured (set SENDGRID_API_KEY or implement SMTP)' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
