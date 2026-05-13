import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { prenom, nom, tel, email } = req.body ?? {};

  if (!prenom || !nom || !tel || !email) {
    return res.status(400).json({ ok: false, error: 'Champs manquants' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email invalide' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  await transporter.sendMail({
    from: `"BroKa" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_TO ?? 'contact@yourqr.page',
    replyTo: email,
    subject: `🍎 Nouveau contact BroKa — ${prenom} ${nom}`,
    text: `Nouveau contact via la page BroKa :\n\nPrénom    : ${prenom}\nNom       : ${nom}\nEmail     : ${email}\nTéléphone : ${tel}\n\n---\nReçu le ${now}`,
  });

  return res.status(200).json({ ok: true });
}
