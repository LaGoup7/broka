import nodemailer from 'nodemailer';
import { Redis } from '@upstash/redis';

const BASE  = 'https://ferme-broka.fr';
const SITE  = `${BASE}/`;
const GUIDE = `${BASE}/guide-gratuit-broka.pdf`;

const ALLOWED_ORIGINS = [
  'https://ferme-broka.fr', 'https://www.ferme-broka.fr',
];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e ?? ''));
}

export default async function handler(req, res) {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prenom, nom, email, tel } = req.body ?? {};

  // Validation
  if (!prenom || !nom || !email) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (String(prenom).length > 100 || String(nom).length > 100) {
    return res.status(400).json({ error: 'Champ trop long' });
  }

  // Échappement HTML pour les emails
  const safePrenom = esc(prenom);
  const safeNom    = esc(nom);
  const safeEmail  = esc(email);
  const safeTel    = esc(tel);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const clientHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4ede3;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede3;padding:40px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(37,61,13,.13);">

      <tr><td style="background:#1e3209;padding:44px 48px 36px;text-align:center;">
        <div style="display:inline-block;border:1.5px solid rgba(255,255,255,.18);border-radius:8px;padding:4px 18px;margin-bottom:18px;">
          <span style="color:rgba(255,255,255,.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Ferme Goyhenetxea</span>
        </div>
        <h1 style="color:#fff;margin:0;font-size:38px;letter-spacing:3px;font-weight:400;font-style:italic;">BroKa</h1>
        <p style="color:rgba(255,255,255,.4);margin:10px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Soule &middot; Xiberoa &middot; Pays Basque</p>
      </td></tr>

      <tr><td style="height:4px;background:linear-gradient(90deg,#8B5E3C,#c9973a,#8B5E3C);"></td></tr>

      <tr><td style="padding:48px 48px 40px;background:#fff;">
        <p style="margin:0 0 8px;font-size:13px;color:#b09070;letter-spacing:2px;text-transform:uppercase;">Bonjour,</p>
        <h2 style="margin:0 0 28px;font-size:26px;color:#1e3209;font-weight:400;font-style:italic;">${safePrenom} ${safeNom}</h2>

        <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.8;">Merci de votre interet pour nos produits artisanaux. Voici votre guide gratuit &mdash; conseils et idees recettes avec notre vinaigre de cidre BIO.</p>

        <p style="margin:0 0 36px;font-size:15px;color:#444;line-height:1.8;">Elabore lentement en Xiberoa, au rythme du vent et des saisons, notre vinaigre de cidre BIO porte le caractere authentique du Pays Basque.</p>

        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:40px;">
          <a href="${GUIDE}" style="display:inline-block;background:#1e3209;color:#f4ede3;text-decoration:none;padding:18px 44px;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">Telecharger le guide</a>
        </td></tr></table>

        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="border-top:1px solid #e8ddd0;"></td>
          <td style="padding:0 16px;white-space:nowrap;font-size:18px;color:#c9973a;">&diams;</td>
          <td style="border-top:1px solid #e8ddd0;"></td>
        </tr></table>

        <p style="margin:32px 0 24px;font-size:14px;color:#888;line-height:1.8;text-align:center;">Retrouvez-nous chaque samedi sur les marches du Pays Basque,<br>ou commandez directement sur notre site.</p>

        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${SITE}" style="display:inline-block;background:transparent;color:#1e3209;text-decoration:none;padding:14px 36px;border-radius:4px;border:1.5px solid #1e3209;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Visiter le site</a>
        </td></tr></table>
      </td></tr>

      <tr><td style="background:#1e3209;padding:24px 48px;text-align:center;">
        <p style="color:rgba(255,255,255,.35);margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Ferme Goyhenetxea &middot; Soule, Xiberoa &middot; Pays Basque</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  const farmerHtml = `
    <h2 style="color:#253D0D;font-family:sans-serif;">Nouveau contact BroKa</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:15px;">
      <tr><td style="padding:6px 16px 6px 0;color:#666;">Prenom</td><td><b>${safePrenom}</b></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#666;">Nom</td><td><b>${safeNom}</b></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#666;">Email</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#666;">Telephone</td><td>${safeTel || '—'}</td></tr>
    </table>`;

  // Sauvegarde du lead en premier — indépendant de l'envoi email
  try {
    const kv = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    const normalizedEmail = email.toLowerCase().trim();
    const ts = Date.now();
    await kv.hset(`lead:${normalizedEmail}`, {
      prenom: String(prenom).trim(),
      nom:    String(nom).trim(),
      email:  normalizedEmail,
      tel:    String(tel ?? '').trim(),
      created_at: ts,
    });
    await kv.zadd('leads', { score: ts, member: normalizedEmail });
  } catch (e) {
    console.error('KV lead save failed:', e.message);
  }

  // Rate limiting emails : 5 envois par IP par heure (lead déjà sauvegardé)
  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  let emailAllowed = true;
  try {
    const rlKv  = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const count = await rlKv.incr(`rl:send:${ip}`);
    if (count === 1) await rlKv.expire(`rl:send:${ip}`, 3600);
    if (count > 5) emailAllowed = false;
  } catch {}

  // Envoi des emails (silencieux si échec — lead déjà sauvegardé)
  if (emailAllowed) try {
    await Promise.all([
      transporter.sendMail({
        from: `"BroKa" <${process.env.GMAIL_USER}>`,
        to: email,
        replyTo: 'contact@ferme-broka.fr',
        subject: 'Votre guide BroKa — Vinaigre de cidre BIO',
        html: clientHtml,
      }),
      transporter.sendMail({
        from: `"BroKa" <${process.env.GMAIL_USER}>`,
        to: 'contact@ferme-broka.fr',
        replyTo: email,
        subject: `Nouveau contact BroKa — ${safePrenom} ${safeNom}`,
        html: farmerHtml,
      }),
    ]);
  } catch (e) {
    console.error('Email send failed:', e.message);
  }

  return res.status(200).json({ ok: true });
}
