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

  const pdfUrl = `${process.env.BASE_URL ?? 'https://yourqr.page'}/broka/Guide_BroKa_7_idees_vinaigre_pomme.pdf`;

  // Notification admin
  await transporter.sendMail({
    from: `"BroKa" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_TO ?? 'contact@yourqr.page',
    replyTo: email,
    subject: `🍎 Nouveau contact BroKa — ${prenom} ${nom}`,
    text: `Nouveau contact via la page BroKa :\n\nPrénom    : ${prenom}\nNom       : ${nom}\nEmail     : ${email}\nTéléphone : ${tel}\n\n---\nReçu le ${now}`,
  });

  // Email au visiteur avec lien PDF
  await transporter.sendMail({
    from: `"BroKa — GAEC Goyhenetxea" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: email,
    subject: `🍎 Votre guide BroKa — 7 idées avec le vinaigre de pomme`,
    html: `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1A1A1A;">
        <div style="background:#1E3A1F;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;font-size:1.6rem;margin:0;">BroKa</h1>
          <p style="color:rgba(255,255,255,.6);font-size:.85rem;margin:8px 0 0;">GAEC Goyhenetxea · Pays Basque</p>
        </div>
        <div style="background:#F8F4ED;padding:32px 24px;border-radius:0 0 12px 12px;">
          <p style="font-size:1rem;margin:0 0 16px;">Bonjour ${prenom},</p>
          <p style="margin:0 0 24px;line-height:1.75;color:#4A4A4A;">
            Merci pour votre intérêt pour nos produits artisanaux du Pays Basque !<br>
            Voici votre guide <strong>7 idées recettes avec le vinaigre de pomme</strong>.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${pdfUrl}" style="background:#8B6B3D;color:white;padding:14px 32px;border-radius:100px;font-family:sans-serif;font-weight:700;font-size:.95rem;text-decoration:none;">
              📄 Télécharger le guide PDF
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #D8CFC0;margin:28px 0;">
          <p style="font-size:.85rem;color:#7A7A7A;margin:0;">
            Retrouvez-nous chaque samedi sur les marchés — et n'hésitez pas à nous écrire sur
            <a href="mailto:contact@yourqr.page" style="color:#8B6B3D;">contact@yourqr.page</a>
          </p>
        </div>
      </div>
    `,
  });

  return res.status(200).json({ ok: true });
}
