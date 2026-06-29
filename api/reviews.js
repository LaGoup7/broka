import { Redis }     from '@upstash/redis';
import nodemailer   from 'nodemailer';
import { randomUUID } from 'crypto';

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const CORS_ALLOWED = ['https://ferme-broka.fr', 'https://www.ferme-broka.fr'];

function setCors(req, res) {
  const origin = req.headers.origin ?? '';
  if (CORS_ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseReview(r) {
  return typeof r === 'string' ? JSON.parse(r) : r;
}

// ── GET — avis approuvés (publics) ───────────────────────────────────────────
async function handleGet(res) {
  try {
    const raw     = await redis.lrange('broka:reviews:approved', 0, 49);
    const reviews = raw.map(parseReview).reverse();
    return res.status(200).json({ reviews });
  } catch (e) {
    console.error('Redis reviews GET failed:', e.message);
    return res.status(200).json({ reviews: [] });
  }
}

// ── POST — soumettre un nouvel avis ──────────────────────────────────────────
async function handlePost(req, res) {
  const { name, rating, text, product, honeypot } = req.body ?? {};

  // Anti-spam
  if (honeypot) return res.status(200).json({ ok: true }); // silent drop

  // Validation
  const safeName   = String(name  ?? '').trim().slice(0, 50);
  const safeText   = String(text  ?? '').trim().slice(0, 600);
  const safeRating = Math.round(Number(rating));
  const safeProd   = String(product ?? '').trim().slice(0, 100) || null;

  if (!safeName)                        return res.status(400).json({ error: 'Prénom requis.' });
  if (safeRating < 1 || safeRating > 5) return res.status(400).json({ error: 'Note invalide.' });
  if (safeText.length < 20)             return res.status(400).json({ error: 'Avis trop court (20 caractères minimum).' });

  const review = {
    id:      randomUUID(),
    name:    safeName,
    rating:  safeRating,
    text:    safeText,
    product: safeProd,
    date:    new Date().toISOString().slice(0, 10),
  };

  try { await redis.lpush('broka:reviews:pending', JSON.stringify(review)); } catch (e) {
    console.error('Redis reviews POST failed:', e.message);
    return res.status(503).json({ error: 'Service temporairement indisponible.' });
  }

  // Email de modération à Rémi
  await sendModerationEmail(review).catch(e =>
    console.error('Email modération non envoyé:', e.message)
  );

  return res.status(201).json({ ok: true });
}

async function sendModerationEmail(review) {
  const base   = 'https://ferme-broka.fr';
  const token  = process.env.REVIEWS_SECRET ?? '';
  const approve = `${base}/api/reviews-mod?action=approve&id=${review.id}&token=${encodeURIComponent(token)}`;
  const reject  = `${base}/api/reviews-mod?action=reject&id=${review.id}&token=${encodeURIComponent(token)}`;
  const stars   = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const prodLine = review.product ? `<tr><td style="color:#888;padding:4px 16px 4px 0;font-size:13px;">Produit</td><td style="font-size:13px;">${review.product}</td></tr>` : '';

  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4ec;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ec;padding:32px 16px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
  <tr><td style="background:#112015;padding:24px 32px;">
    <p style="color:rgba(255,255,255,.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">Ferme Goyhenetxea</p>
    <p style="color:#fff;font-size:20px;font-style:italic;letter-spacing:2px;margin:0 0 8px;">BroKa</p>
    <span style="background:rgba(201,151,58,.25);color:#C9973A;font-size:11px;font-weight:700;letter-spacing:1px;padding:5px 12px;border-radius:20px;border:1px solid rgba(201,151,58,.4);">⭐ Nouvel avis à modérer</span>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C);"></td></tr>
  <tr><td style="padding:28px 32px;">
    <table style="border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="color:#888;padding:4px 16px 4px 0;font-size:13px;">Client</td><td style="font-size:14px;font-weight:700;color:#112015;">${review.name}</td></tr>
      <tr><td style="color:#888;padding:4px 16px 4px 0;font-size:13px;">Note</td><td style="font-size:16px;color:#c9973a;">${stars}</td></tr>
      ${prodLine}
      <tr><td style="color:#888;padding:4px 16px 4px 0;font-size:13px;">Date</td><td style="font-size:13px;color:#555;">${review.date}</td></tr>
    </table>
    <div style="background:#f8f5f0;border-radius:8px;padding:16px 20px;margin-bottom:28px;font-size:14px;color:#333;line-height:1.7;font-style:italic;">"${review.text}"</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48%" align="center">
        <a href="${approve}" style="display:block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 0;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.5px;">✅ Approuver</a>
      </td>
      <td width="4%"></td>
      <td width="48%" align="center">
        <a href="${reject}" style="display:block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 0;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.5px;">🗑️ Rejeter</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f8f5f0;padding:16px 32px;text-align:center;">
    <p style="color:#aaa;font-size:11px;margin:0;">Ces liens expirent à la suppression de l'avis de la file d'attente.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  await transporter.sendMail({
    from:    `"BroKa Avis" <${process.env.GMAIL_USER}>`,
    to:      'contact@ferme-broka.fr',
    subject: `⭐ Nouvel avis — ${review.name} — ${stars}`,
    html,
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET')     return handleGet(res);
  if (req.method === 'POST')    return handlePost(req, res);
  return res.status(405).end();
}
