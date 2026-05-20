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

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
}

// ── Email fermier ──────────────────────────────────────────────────────────────
async function sendFarmerEmail(session, lineItems) {
  const ref            = session.id.slice(-8).toUpperCase();
  const meta           = session.metadata ?? {};
  const customer       = session.customer_details ?? {};
  const shipping       = session.shipping_details ?? {};
  const addr           = shipping.address ?? {};
  const deliveryMethod = meta.delivery_method === 'relay' ? 'Point Relais® Mondial Relay' : 'Domicile — Colissimo';
  const relayPoint     = meta.relay_point || null;
  const homeAddress    = meta.home_address || null;
  const addressDisplay = homeAddress || [shipping.name, addr.line1, addr.line2, ((addr.postal_code || '') + ' ' + (addr.city || '')).trim(), addr.country].filter(Boolean).join('<br>') || '—';
  const isOversized    = meta.oversized === 'true';
  const weightKg       = meta.total_weight_kg ?? '—';
  const shippingTotal  = session.shipping_cost?.amount_total ?? 0;
  const orderTotal     = session.amount_total ?? 0;
  const productTotal   = orderTotal - shippingTotal;

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
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4ec;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ec;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
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
  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C);"></td></tr>
  <tr><td style="padding:20px 40px;background:#f8f5f0;border-bottom:1px solid #e8e0d0;">
    <table width="100%"><tr>
      <td style="font-size:13px;color:#666;">Référence</td>
      <td style="font-size:13px;color:#666;">Date</td>
    </tr><tr>
      <td style="font-size:18px;font-weight:700;color:#112015;letter-spacing:1px;">#${ref}</td>
      <td style="font-size:14px;color:#333;">${formatDate(session.created)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;">Client</p>
    <table style="border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Nom</td><td style="color:#112015;font-weight:700;font-size:13px;">${customer.name ?? '—'}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">E-mail</td><td style="font-size:13px;"><a href="mailto:${customer.email}" style="color:#1C3D22;">${customer.email ?? '—'}</a></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Téléphone</td><td style="color:#333;font-size:13px;">${customer.phone ?? '—'}</td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;">Livraison</p>
    <table style="border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Mode</td><td style="color:#112015;font-weight:700;font-size:13px;">${deliveryMethod}</td></tr>
      ${relayRow}
      <tr>
        <td style="padding:4px 16px 4px 0;color:#666;font-size:13px;vertical-align:top;">Adresse</td>
        <td style="color:#333;font-size:13px;line-height:1.6;">${addressDisplay}</td>
      </tr>
      <tr><td style="padding:4px 16px 4px 0;color:#666;font-size:13px;">Poids total</td><td style="color:#333;font-size:13px;">${weightKg} kg</td></tr>
      ${oversizedBanner}
    </table>
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;">Détail de la commande</p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:8px;">
      <thead><tr style="border-bottom:2px solid #e8e0d0;">
        <th style="text-align:left;padding:6px 12px 6px 0;font-size:12px;color:#888;font-weight:700;">Produit</th>
        <th style="text-align:center;padding:6px 12px;font-size:12px;color:#888;font-weight:700;">Qté</th>
        <th style="text-align:right;padding:6px 0 6px 12px;font-size:12px;color:#888;font-weight:700;">Montant</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <table width="100%" style="border-collapse:collapse;border-top:2px solid #e8e0d0;margin-top:8px;">
      <tr><td style="padding:8px 0;font-size:13px;color:#555;">Sous-total produits</td><td style="padding:8px 0;font-size:13px;color:#333;text-align:right;">${fmt(productTotal)}</td></tr>
      <tr><td style="padding:4px 0 8px;font-size:13px;color:#555;">Frais de port</td><td style="padding:4px 0 8px;font-size:13px;color:#333;text-align:right;">${shippingTotal === 0 ? '<span style="color:#16a34a;font-weight:700">Offerts</span>' : fmt(shippingTotal)}</td></tr>
      <tr style="border-top:1px solid #e8e0d0;"><td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#112015;">TOTAL</td><td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#112015;text-align:right;">${fmt(orderTotal)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#112015;padding:20px 40px;text-align:center;">
    <a href="https://dashboard.stripe.com/payments" style="color:rgba(255,255,255,.6);font-size:11px;letter-spacing:1px;">Voir dans le Dashboard Stripe →</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await makeTransporter().sendMail({
    from:    `"BroKa Commandes" <${process.env.GMAIL_USER}>`,
    to:      'contact@ferme-broka.fr',
    cc:      'contact@ferme-broka.fr',
    replyTo: customer.email ?? 'contact@ferme-broka.fr',
    subject: `🛒 Commande #${ref} — ${customer.name ?? 'Client'} — ${fmt(orderTotal)}`,
    html,
  });
}

// ── Email client ───────────────────────────────────────────────────────────────
async function sendCustomerEmail(session, lineItems) {
  const customer = session.customer_details ?? {};
  if (!customer.email) return;

  const ref           = session.id.slice(-8).toUpperCase();
  const meta          = session.metadata ?? {};
  const shipping      = session.shipping_details ?? {};
  const addr          = shipping.address ?? {};
  const shippingTotal = session.shipping_cost?.amount_total ?? 0;
  const orderTotal    = session.amount_total ?? 0;
  const productTotal  = orderTotal - shippingTotal;
  const isRelay       = meta.delivery_method === 'relay';
  const relayPoint    = meta.relay_point || null;
  const base          = 'https://ferme-broka.fr';

  // Facture Stripe (invoice est expandé)
  const invoice    = typeof session.invoice === 'object' ? session.invoice : null;
  const invoiceUrl = invoice?.hosted_invoice_url ?? null;

  const itemsRows = lineItems.map(item => `
    <tr>
      <td style="padding:8px 12px 8px 0;color:#444;font-size:14px;line-height:1.4;">${item.description}</td>
      <td style="padding:8px 12px;color:#777;font-size:14px;text-align:center;">× ${item.quantity}</td>
      <td style="padding:8px 0 8px 12px;color:#112015;font-size:14px;font-weight:700;text-align:right;white-space:nowrap;">${fmt(item.amount_total)}</td>
    </tr>`).join('');

  const homeAddress = meta.home_address || null;
  const addrFallback = [shipping.name, addr.line1, addr.line2, ((addr.postal_code || '') + ' ' + (addr.city || '')).trim()].filter(Boolean).join('<br>') || '—';
  const addrBlock = isRelay && relayPoint
    ? '<strong>Point Relais® Mondial Relay</strong><br>' + relayPoint
    : (homeAddress || addrFallback);

  const invoiceBtn = invoiceUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td align="center">
      <a href="${invoiceUrl}"
         style="display:inline-block;background:#A67C30;color:#fff;text-decoration:none;
                padding:14px 36px;border-radius:4px;font-size:12px;font-weight:700;
                letter-spacing:2px;text-transform:uppercase;">
        Télécharger ma facture
      </a>
    </td></tr></table>` : '';

  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4ede3;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede3;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(37,61,13,.13);">

  <!-- En-tête -->
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

  <!-- Ligne dorée -->
  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C);"></td></tr>

  <!-- Merci -->
  <tr><td style="padding:32px 40px 8px;text-align:center;">
    <p style="margin:0 0 6px;font-size:13px;color:#b09070;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Merci pour votre commande !</p>
    <h2 style="margin:0;font-size:22px;color:#112015;font-weight:400;font-style:italic;">${customer.name ?? ''}</h2>
  </td></tr>

  <!-- Réf + date -->
  <tr><td style="padding:16px 40px 24px;">
    <table width="100%" style="background:#f8f5f0;border-radius:8px;padding:16px 20px;border-collapse:collapse;">
      <tr>
        <td style="font-size:12px;color:#888;font-family:Arial,sans-serif;">Référence commande</td>
        <td style="font-size:12px;color:#888;font-family:Arial,sans-serif;text-align:right;">Date</td>
      </tr>
      <tr>
        <td style="font-size:18px;font-weight:700;color:#112015;letter-spacing:1px;font-family:Arial,sans-serif;">#${ref}</td>
        <td style="font-size:13px;color:#444;font-family:Arial,sans-serif;text-align:right;">${formatDate(session.created)}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Corps -->
  <tr><td style="padding:0 40px 32px;">

    <!-- Livraison -->
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;font-family:Arial,sans-serif;">Livraison</p>
    <table style="border-collapse:collapse;margin-bottom:28px;width:100%;">
      <tr>
        <td style="padding:4px 16px 4px 0;color:#888;font-size:13px;font-family:Arial,sans-serif;width:100px;vertical-align:top;">Mode</td>
        <td style="color:#112015;font-weight:700;font-size:13px;font-family:Arial,sans-serif;">
          ${isRelay ? 'Point Relais® Mondial Relay' : 'Domicile — Colissimo'}
        </td>
      </tr>
      <tr>
        <td style="padding:4px 16px 4px 0;color:#888;font-size:13px;font-family:Arial,sans-serif;vertical-align:top;">Adresse</td>
        <td style="color:#444;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;">${addrBlock}</td>
      </tr>
    </table>

    <!-- Détail commande -->
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
      <tr><td style="padding:4px 0 8px;font-size:13px;color:#666;font-family:Arial,sans-serif;">Livraison</td><td style="padding:4px 0 8px;font-size:13px;text-align:right;font-family:Arial,sans-serif;">${shippingTotal === 0 ? '<span style="color:#16a34a;font-weight:700;">Offerte</span>' : fmt(shippingTotal)}</td></tr>
      <tr style="border-top:1px solid #e8e0d0;">
        <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#112015;font-family:Arial,sans-serif;">TOTAL payé</td>
        <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:#112015;text-align:right;font-family:Arial,sans-serif;">${fmt(orderTotal)}</td>
      </tr>
    </table>

    ${invoiceBtn}

    <!-- Note suivi -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td style="background:#f0f7ed;border-radius:8px;padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1C3D22;font-family:Arial,sans-serif;">📦 Et maintenant ?</p>
        <p style="margin:0;font-size:13px;color:#444;line-height:1.65;font-family:Arial,sans-serif;">
          Votre commande sera expédiée sous 1 à 2 jours ouvrés.
          ${isRelay ? 'Vous recevrez un SMS ou email de Mondial Relay avec le numéro de suivi dès l\'expédition.' : 'Vous recevrez un email Colissimo avec le numéro de suivi dès l\'expédition.'}
          Pour toute question : <a href="mailto:contact@ferme-broka.fr" style="color:#1C3D22;">contact@ferme-broka.fr</a>
        </p>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#112015;padding:24px 40px;text-align:center;">
    <p style="color:rgba(255,255,255,.35);margin:0 0 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Ferme Goyhenetxea · Soule, Xiberoa · Pays Basque</p>
    <a href="${base}/" style="color:rgba(255,255,255,.5);font-size:11px;font-family:Arial,sans-serif;">Visiter le site →</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await makeTransporter().sendMail({
    from:    `"BroKa" <${process.env.GMAIL_USER}>`,
    to:      customer.email,
    replyTo: 'contact@ferme-broka.fr',
    subject: `✅ Votre commande BroKa #${ref} est confirmée — ${fmt(orderTotal)}`,
    html,
  });
}

// ── Google Sheets ─────────────────────────────────────────────────────────────
async function appendToGoogleSheets(session, lineItems) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return;

  const meta     = session.metadata ?? {};
  const customer = session.customer_details ?? {};
  const shipping = session.shipping_cost?.amount_total ?? 0;
  const total    = session.amount_total ?? 0;
  const isRelay  = meta.delivery_method === 'relay';

  const products = lineItems.map(i => i.description + ' x' + i.quantity).join(' | ');
  const address  = isRelay ? (meta.relay_point || '—') : (meta.home_address || '—');

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date:     new Date(session.created * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      ref:      '#' + session.id.slice(-8).toUpperCase(),
      customer: customer.name ?? '—',
      email:    customer.email ?? '—',
      phone:    customer.phone ?? '—',
      delivery: isRelay ? 'Point Relais' : 'Domicile',
      address,
      products,
      subtotal: ((total - shipping) / 100).toFixed(2),
      shipping: (shipping / 100).toFixed(2),
      total:    (total / 100).toFixed(2),
      weight:   meta.total_weight_kg ?? '—',
    }),
  });
}

// ── Handler principal ──────────────────────────────────────────────────────────
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
    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
      expand: ['line_items', 'invoice'],
    });
    const lineItems = session.line_items?.data ?? [];

    // Email fermier — critique : si échec, on renvoie 500 pour que Stripe retente
    await sendFarmerEmail(session, lineItems);

    // Email client — non bloquant
    sendCustomerEmail(session, lineItems).catch(err =>
      console.error('Email client non envoyé:', err.message)
    );

    // Google Sheets — non bloquant
    appendToGoogleSheets(session, lineItems).catch(err =>
      console.error('GSheets non écrit:', err.message)
    );
  }

  return res.status(200).json({ received: true });
}
