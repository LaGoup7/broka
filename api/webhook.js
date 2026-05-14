import Stripe from 'stripe';
import nodemailer from 'nodemailer';

// Vercel : désactive le body parser pour lire le raw body (requis pour la signature Stripe)
export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function fmt(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function sendOrderEmail(session, lineItems) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  const ref           = session.id.slice(-8).toUpperCase();
  const meta          = session.metadata ?? {};
  const customer      = session.customer_details ?? {};
  const shipping      = session.shipping_details ?? {};
  const addr          = shipping.address ?? {};
  const deliveryMethod = meta.delivery_method === 'relay' ? 'Point Relais® Mondial Relay' : 'Domicile — Colissimo';
  const relayPoint    = meta.relay_point || null;
  const isOversized   = meta.oversized === 'true';
  const weightKg      = meta.total_weight_kg ?? '—';
  const shippingTotal = session.shipping_cost?.amount_total ?? 0;
  const orderTotal    = session.amount_total ?? 0;
  const productTotal  = orderTotal - shippingTotal;

  const itemsRows = lineItems.map(item => `
    <tr>
      <td style="padding:8px 12px 8px 0;color:#333;font-size:14px;">${item.description}</td>
      <td style="padding:8px 12px;color:#555;font-size:14px;text-align:center;">× ${item.quantity}</td>
      <td style="padding:8px 0 8px 12px;color:#112015;font-size:14px;font-weight:700;text-align:right;">${fmt(item.amount_total)}</td>
    </tr>`).join('');

  const relayRow = relayPoint ? `
    <tr>
      <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Point relais</td>
      <td style="color:#c05000;font-weight:700;font-size:13px;">${relayPoint}</td>
    </tr>` : '';

  const oversizedBanner = isOversized ? `
    <tr><td colspan="2" style="padding:12px 16px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;color:#856404;font-size:13px;font-weight:700;">
      ⚠️ Commande volumineuse (${weightKg} kg) — à confirmer manuellement pour l'expédition.
    </td></tr>` : '';

  const html = `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4ec;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ec;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">

  <!-- Header -->
  <tr><td style="background:#112015;padding:28px 40px;">
    <table width="100%"><tr>
      <td>
        <p style="color:rgba(255,255,255,.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">Ferme Goyhenetxea</p>
        <p style="color:#fff;font-size:22px;font-style:italic;letter-spacing:2px;margin:0;">BroKa</p>
      </td>
      <td align="right">
        <span style="background:rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:11px;font-weight:700;letter-spacing:1px;padding:6px 14px;border-radius:20px;">NOUVELLE COMMANDE</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Gold bar -->
  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C);"></td></tr>

  <!-- Ref + date -->
  <tr><td style="padding:20px 40px;background:#f8f5f0;border-bottom:1px solid #e8e0d0;">
    <table width="100%"><tr>
      <td style="font-size:13px;color:#666;">Référence</td>
      <td style="font-size:13px;color:#666;">Date</td>
    </tr><tr>
      <td style="font-size:18px;font-weight:700;color:#112015;letter-spacing:1px;">#${ref}</td>
      <td style="font-size:14px;color:#333;">${formatDate(session.created)}</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">

    <!-- Client -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;">Client</p>
    <table style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Nom</td>
        <td style="color:#112015;font-weight:700;font-size:13px;">${customer.name ?? '—'}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">E-mail</td>
        <td style="font-size:13px;"><a href="mailto:${customer.email}" style="color:#1C3D22;">${customer.email ?? '—'}</a></td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Téléphone</td>
        <td style="color:#333;font-size:13px;">${customer.phone ?? '—'}</td>
      </tr>
    </table>

    <!-- Livraison -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;">Livraison</p>
    <table style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Mode</td>
        <td style="color:#112015;font-weight:700;font-size:13px;">${deliveryMethod}</td>
      </tr>
      ${relayRow}
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;vertical-align:top;">Adresse</td>
        <td style="color:#333;font-size:13px;line-height:1.6;">
          ${shipping.name ?? ''}<br>
          ${addr.line1 ?? ''}${addr.line2 ? '<br>' + addr.line2 : ''}<br>
          ${addr.postal_code ?? ''} ${addr.city ?? ''}<br>
          ${addr.country ?? ''}
        </td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Poids total</td>
        <td style="color:#333;font-size:13px;">${weightKg} kg</td>
      </tr>
      ${oversizedBanner}
    </table>

    <!-- Commande -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;">Détail de la commande</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:8px;">
      <thead>
        <tr style="border-bottom:2px solid #e8e0d0;">
          <th style="text-align:left;padding:6px 12px 6px 0;font-size:12px;color:#888;font-weight:700;">Produit</th>
          <th style="text-align:center;padding:6px 12px;font-size:12px;color:#888;font-weight:700;">Qté</th>
          <th style="text-align:right;padding:6px 0 6px 12px;font-size:12px;color:#888;font-weight:700;">Montant</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <!-- Totaux -->
    <table width="100%" style="border-collapse:collapse;border-top:2px solid #e8e0d0;margin-top:8px;">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#555;">Sous-total produits</td>
        <td style="padding:8px 0;font-size:13px;color:#333;text-align:right;">${fmt(productTotal)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0 8px;font-size:13px;color:#555;">Frais de port</td>
        <td style="padding:4px 0 8px;font-size:13px;color:#333;text-align:right;">${shippingTotal === 0 ? '<span style="color:#16a34a;font-weight:700">Offerts</span>' : fmt(shippingTotal)}</td>
      </tr>
      <tr style="border-top:1px solid #e8e0d0;">
        <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#112015;">TOTAL</td>
        <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#112015;text-align:right;">${fmt(orderTotal)}</td>
      </tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#112015;padding:20px 40px;text-align:center;">
    <a href="https://dashboard.stripe.com/payments" style="color:rgba(255,255,255,.6);font-size:11px;letter-spacing:1px;">Voir dans le Dashboard Stripe →</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  await transporter.sendMail({
    from: `"BroKa Commandes" <${process.env.GMAIL_USER}>`,
    to: 'latchereolivier@free.fr',
    cc: 'contact@yourqr.page',
    replyTo: customer.email ?? 'latchereolivier@free.fr',
    subject: `🛒 Commande #${ref} — ${customer.name ?? 'Client'} — ${fmt(orderTotal)}`,
    html,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).json({ error: `Signature invalide: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    try {
      const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
        expand: ['line_items'],
      });
      const lineItems = session.line_items?.data ?? [];
      await sendOrderEmail(session, lineItems);
    } catch (err) {
      console.error('Erreur envoi e-mail commande:', err.message);
      // On renvoie 200 quand même pour éviter que Stripe ne rejoue le webhook
    }
  }

  return res.status(200).json({ received: true });
}
