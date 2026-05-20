import { Redis } from '@upstash/redis';
import nodemailer from 'nodemailer';

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export default async function handler(req, res) {
  // Protégé par CRON_SECRET (Vercel l'envoie automatiquement si défini)
  const cronSecret = process.env.CRON_SECRET ?? '';
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).end();
  }

  const kv  = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const now = Date.now();

  // Campagnes dont la date d'envoi est passée
  const campaignIds = await kv.zrangebyscore('campaigns:pending', 0, now);
  if (!campaignIds.length) return res.status(200).json({ processed: 0 });

  const base        = 'https://ferme-broka.fr';
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  let processed = 0;

  for (const id of campaignIds) {
    const campaign = await kv.hgetall(`campaign:${id}`);
    if (!campaign || campaign.status !== 'pending') continue;

    let emails;
    try { emails = JSON.parse(campaign.emails ?? '[]'); } catch { emails = []; }
    if (!emails.length) {
      await kv.hset(`campaign:${id}`, { status: 'cancelled' });
      await kv.zrem('campaigns:pending', id);
      continue;
    }

    // Nouveau format : tableau de messages (Upstash peut retourner déjà parsé)
    let messages = null;
    if (campaign.messages) {
      if (Array.isArray(campaign.messages)) { messages = campaign.messages; }
      else { try { messages = JSON.parse(campaign.messages); } catch {} }
    }
    // Ancien format : subject/body/send_at directs
    if (!messages) {
      messages = [{ subject: campaign.subject, body: campaign.body, send_at: campaign.send_at, status: 'pending' }];
    }

    const dueMsgs = messages.filter(m => m.status === 'pending' && parseInt(m.send_at) <= now);
    if (!dueMsgs.length) continue;

    const leads = await Promise.all(emails.map(e => kv.hgetall(`lead:${e}`)));
    const ts = new Date().toISOString();

    for (const msg of dueMsgs) {
      const { subject, body } = msg;
      if (!subject || !body) { msg.status = 'cancelled'; continue; }

      const bodyHtml = esc(body)
        .replace(/\n\n+/g, '</p><p style="margin:0 0 16px;">')
        .replace(/\n/g, '<br>');

      try {
        await Promise.all(leads.filter(Boolean).map((lead, i) => {
          const to         = emails[i];
          const safePrenom = esc(lead.prenom ?? '');
          const safeNom    = esc(lead.nom    ?? '');

          const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4ede3;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede3;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(37,61,13,.13);">
  <tr><td style="background:#1e3209;padding:36px 40px;">
    <p style="color:rgba(255,255,255,.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Ferme Goyhenetxea</p>
    <h1 style="color:#fff;margin:0;font-size:32px;letter-spacing:3px;font-weight:400;font-style:italic;">BroKa</h1>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#c9973a,#8B5E3C);"></td></tr>
  <tr><td style="padding:36px 40px 40px;">
    <p style="margin:0 0 8px;font-size:13px;color:#b09070;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Bonjour,</p>
    <h2 style="margin:0 0 28px;font-size:22px;color:#1e3209;font-weight:400;font-style:italic;">${safePrenom} ${safeNom}</h2>
    <div style="font-size:15px;color:#444;line-height:1.8;"><p style="margin:0 0 16px;">${bodyHtml}</p></div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #e8ddd0;">
      <tr><td style="padding-top:24px;text-align:center;">
        <a href="${base}/" style="display:inline-block;border:1.5px solid #1e3209;color:#1e3209;text-decoration:none;padding:12px 32px;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Visiter le site</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#1e3209;padding:20px 40px;text-align:center;">
    <p style="color:rgba(255,255,255,.35);margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Ferme Goyhenetxea · Soule, Xiberoa · Pays Basque</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

          return transporter.sendMail({
            from:    `"BroKa" <${process.env.GMAIL_USER}>`,
            to,
            replyTo: 'contact@ferme-broka.fr',
            subject,
            html,
          });
        }));
        msg.status  = 'sent';
        msg.sent_at = ts;
      } catch (e) {
        console.error(`Cron: échec message campagne ${id}:`, e.message);
      }
    }

    // Mise à jour de la campagne dans Redis
    const stillPending = messages.filter(m => m.status === 'pending');
    const allSent      = messages.every(m => m.status !== 'pending');

    if (campaign.messages) {
      await kv.hset(`campaign:${id}`, { messages: JSON.stringify(messages) });
    }

    if (allSent) {
      await kv.hset(`campaign:${id}`, { status: 'sent', sent_at: ts });
      await kv.zrem('campaigns:pending', id);
      await Promise.all(emails.map(e => kv.hset(`lead:${e}`, { contacted_at: ts })));
    } else if (stillPending.length) {
      // Met à jour le score avec le prochain envoi
      const nextSendAt = Math.min(...stillPending.map(m => parseInt(m.send_at)));
      await kv.zadd('campaigns:pending', { score: nextSendAt, member: id });
    }
    processed++;
  }

  console.log(`Cron: ${processed} campagne(s) envoyée(s)`);
  return res.status(200).json({ processed });
}
