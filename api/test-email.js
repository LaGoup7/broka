import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.query.key !== adminKey) {
    return res.status(401).send('Accès refusé');
  }

  const to = req.query.to || 'contact@ferme-broka.fr';

  function fmt(cents) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

  // Données de test simulant une vraie commande
  const ref          = 'A1B2C3D4';
  const customerName = 'Jean Dupont (test)';
  const orderDate    = new Date().toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const isRelay      = req.query.mode !== 'home';
  const addrBlock    = isRelay
    ? '<strong>Point Relais® Mondial Relay</strong><br>TABAC PRESSE DU CENTRE, 4 Rue de la Mairie, 64100 Bayonne'
    : '12 Rue des Pyrénées<br>64100 Bayonne';
  const deliveryMode = isRelay ? 'Point Relais® Mondial Relay' : 'Domicile — Colissimo';
  const shippingAmt  = isRelay ? 490 : 790;
  const productTotal = 2750;
  const orderTotal   = productTotal + shippingAmt;
  const base         = 'https://ferme-broka.fr';

  const itemsRows = [
    { description: 'Confiture de cerises BIO 350g', quantity: 2, amount_total: 1400 },
    { description: 'Vinaigre de cidre BIO 50cl',    quantity: 1, amount_total: 850  },
    { description: 'Noisettes BIO à coque 500g',    quantity: 1, amount_total: 500  },
  ].map(item => `
    <tr>
      <td style="padding:8px 12px 8px 0;color:#444;font-size:14px;line-height:1.4;">${item.description}</td>
      <td style="padding:8px 12px;color:#777;font-size:14px;text-align:center;">× ${item.quantity}</td>
      <td style="padding:8px 0 8px 12px;color:#112015;font-size:14px;font-weight:700;text-align:right;white-space:nowrap;">${fmt(item.amount_total)}</td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4ede3;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede3;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(37,61,13,.13);">

  <tr><td style="background:#112015;padding:32px 40px;">
    <table width="100%"><tr>
      <td>
        <p style="color:rgba(255,255,255,.45);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">Ferme Goyhenetxea</p>
        <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:3px;font-weight:400;font-style:italic;">BroKa</h1>
      </td>
      <td align="right">
        <span style="background:rgba(201,151,58,.25);color:#C9973A;font-size:11px;font-weight:700;letter-spacing:1px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,151,58,.4);">
          ✅ CONFIRMÉE
        </span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C);"></td></tr>

  <tr><td style="padding:32px 40px 8px;text-align:center;">
    <p style="margin:0 0 6px;font-size:13px;color:#b09070;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Merci pour votre commande !</p>
    <h2 style="margin:0;font-size:22px;color:#112015;font-weight:400;font-style:italic;">${customerName}</h2>
  </td></tr>

  <tr><td style="padding:16px 40px 24px;">
    <table width="100%" style="background:#f8f5f0;border-radius:8px;padding:16px 20px;border-collapse:collapse;">
      <tr>
        <td style="font-size:12px;color:#888;font-family:Arial,sans-serif;">Référence commande</td>
        <td style="font-size:12px;color:#888;font-family:Arial,sans-serif;text-align:right;">Date</td>
      </tr>
      <tr>
        <td style="font-size:18px;font-weight:700;color:#112015;letter-spacing:1px;font-family:Arial,sans-serif;">#${ref}</td>
        <td style="font-size:13px;color:#444;font-family:Arial,sans-serif;text-align:right;">${orderDate}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 32px;">

    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;font-family:Arial,sans-serif;">Livraison</p>
    <table style="border-collapse:collapse;margin-bottom:28px;width:100%;">
      <tr>
        <td style="padding:4px 16px 4px 0;color:#888;font-size:13px;font-family:Arial,sans-serif;width:100px;vertical-align:top;">Mode</td>
        <td style="color:#112015;font-weight:700;font-size:13px;font-family:Arial,sans-serif;">${deliveryMode}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#888;font-size:13px;font-family:Arial,sans-serif;vertical-align:top;">Adresse</td>
        <td style="color:#444;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;">${addrBlock}</td>
      </tr>
    </table>

    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;font-family:Arial,sans-serif;">Votre commande</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:8px;">
      <thead><tr style="border-bottom:2px solid #e8e0d0;">
        <th style="text-align:left;padding:6px 12px 6px 0;font-size:12px;color:#999;font-weight:700;font-family:Arial,sans-serif;">Produit</th>
        <th style="text-align:center;padding:6px 12px;font-size:12px;color:#999;font-weight:700;font-family:Arial,sans-serif;">Qté</th>
        <th style="text-align:right;padding:6px 0 6px 12px;font-size:12px;color:#999;font-weight:700;font-family:Arial,sans-serif;">Montant</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <table width="100%" style="border-collapse:collapse;border-top:2px solid #e8e0d0;margin-top:8px;">
      <tr><td style="padding:8px 0;font-size:13px;color:#666;font-family:Arial,sans-serif;">Sous-total</td><td style="padding:8px 0;font-size:13px;color:#444;text-align:right;font-family:Arial,sans-serif;">${fmt(productTotal)}</td></tr>
      <tr><td style="padding:4px 0 8px;font-size:13px;color:#666;font-family:Arial,sans-serif;">Livraison</td><td style="padding:4px 0 8px;font-size:13px;text-align:right;font-family:Arial,sans-serif;">${fmt(shippingAmt)}</td></tr>
      <tr style="border-top:1px solid #e8e0d0;">
        <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#112015;font-family:Arial,sans-serif;">TOTAL payé</td>
        <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#112015;text-align:right;font-family:Arial,sans-serif;">${fmt(orderTotal)}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td style="background:#f0f7ed;border-radius:8px;padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1C3D22;font-family:Arial,sans-serif;">📦 Et maintenant ?</p>
        <p style="margin:0;font-size:13px;color:#444;line-height:1.65;font-family:Arial,sans-serif;">
          Votre commande sera expédiée sous 1 à 2 jours ouvrés.
          ${isRelay ? "Vous recevrez un SMS ou email de Mondial Relay avec le numéro de suivi dès l'expédition." : 'Vous recevrez un email Colissimo avec le numéro de suivi dès l\'expédition.'}
          Pour toute question : <a href="mailto:contact@ferme-broka.fr" style="color:#1C3D22;">contact@ferme-broka.fr</a>
        </p>
      </td></tr>
    </table>

  </td></tr>

  <tr><td style="background:#112015;padding:24px 40px;text-align:center;">
    <p style="color:rgba(255,255,255,.35);margin:0 0 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Ferme Goyhenetxea · Soule, Xiberoa · Pays Basque</p>
    <a href="${base}/" style="color:rgba(255,255,255,.5);font-size:11px;font-family:Arial,sans-serif;">Visiter le site →</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  await transporter.sendMail({
    from:    `"BroKa" <${process.env.GMAIL_USER}>`,
    to,
    subject: `[TEST] ✅ Votre commande BroKa #${ref} est confirmée — ${fmt(orderTotal)}`,
    html,
  });

  res.status(200).send(`Email de test envoyé à ${to} (mode: ${isRelay ? 'Point Relais' : 'Domicile'})`);
}
