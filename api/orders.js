import Stripe from 'stripe';

export default async function handler(req, res) {
  // Protection simple par clé
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.query.key !== adminKey) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BroKa Admin"');
    return res.status(401).send('Accès refusé. Ajoutez ?key=VOTRE_ADMIN_KEY');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Récupère les 200 dernières sessions complétées
  const sessions = await stripe.checkout.sessions.list({
    limit: 100,
    expand: ['data.line_items'],
  });

  // Deuxième page si besoin
  let allSessions = sessions.data;
  if (sessions.has_more) {
    const sessions2 = await stripe.checkout.sessions.list({
      limit: 100,
      starting_after: sessions.data[sessions.data.length - 1].id,
      expand: ['data.line_items'],
    });
    allSessions = [...allSessions, ...sessions2.data];
  }

  const completed = allSessions
    .filter(s => s.payment_status === 'paid')
    .sort((a, b) => b.created - a.created);

  function fmt(cents) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }
  function fmtDate(ts) {
    return new Date(ts * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const rows = completed.map(s => {
    const meta     = s.metadata ?? {};
    const customer = s.customer_details ?? {};
    const shipping = s.shipping_cost?.amount_total ?? 0;
    const total    = s.amount_total ?? 0;
    const isRelay  = meta.delivery_method === 'relay';
    const address  = isRelay ? (meta.relay_point || '—') : (meta.home_address || '—');
    const products = (s.line_items?.data ?? []).map(i => `${i.description} ×${i.quantity}`).join('<br>');
    const ref      = '#' + s.id.slice(-8).toUpperCase();
    const oversized = meta.oversized === 'true' ? ' ⚠️' : '';

    return `
    <tr>
      <td style="white-space:nowrap">${fmtDate(s.created)}</td>
      <td style="font-weight:700;color:#112015">${ref}</td>
      <td>
        <strong>${customer.name ?? '—'}</strong><br>
        <a href="mailto:${customer.email}" style="color:#1C3D22;font-size:.85em">${customer.email ?? '—'}</a><br>
        <span style="color:#666;font-size:.85em">${customer.phone ?? '—'}</span>
      </td>
      <td>
        <span style="background:${isRelay ? '#e8f5e9' : '#fff3e0'};color:${isRelay ? '#2e7d32' : '#e65100'};padding:3px 8px;border-radius:12px;font-size:.82em;font-weight:700">
          ${isRelay ? 'Point Relais' : 'Domicile'}
        </span>
      </td>
      <td style="font-size:.88em;color:#444">${address}</td>
      <td style="font-size:.85em">${products}</td>
      <td style="color:#888;font-size:.85em">${fmt(shipping === 0 ? 0 : shipping)}</td>
      <td style="font-weight:700;color:#112015;white-space:nowrap">${fmt(total)}${oversized}</td>
    </tr>`;
  }).join('');

  const totalRevenue = completed.reduce((sum, s) => sum + (s.amount_total ?? 0), 0);
  const totalOrders  = completed.length;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BroKa — Commandes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f4efe6; color: #1a1a1a; }
    .header { background: #112015; color: #fff; padding: 20px 32px; display: flex; align-items: center; gap: 20px; }
    .header h1 { font-size: 1.4rem; font-weight: 400; font-style: italic; letter-spacing: 2px; }
    .header .stats { margin-left: auto; display: flex; gap: 24px; }
    .stat { text-align: right; }
    .stat-val { font-size: 1.4rem; font-weight: 700; color: #C9A45A; }
    .stat-lbl { font-size: .75rem; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: 1px; }
    .container { padding: 24px 32px; max-width: 1400px; margin: 0 auto; }
    .search { margin-bottom: 16px; }
    .search input { padding: 9px 14px; border: 1px solid #d2c9b5; border-radius: 8px; font-size: .9rem; width: 300px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    th { background: #112015; color: rgba(255,255,255,.7); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 12px 14px; text-align: left; }
    td { padding: 12px 14px; border-bottom: 1px solid #f0ebe0; vertical-align: top; font-size: .9rem; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #faf8f4; }
    .empty { text-align: center; padding: 48px; color: #888; }
    .refresh { float: right; margin-top: -4px; background: #C9A45A; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: .85rem; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p style="font-size:.7rem;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:2px">Ferme Goyhenetxea</p>
      <h1>BroKa</h1>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-val">${totalOrders}</div><div class="stat-lbl">Commandes</div></div>
      <div class="stat"><div class="stat-val">${fmt(totalRevenue)}</div><div class="stat-lbl">Chiffre d'affaires</div></div>
    </div>
  </div>
  <div class="container">
    <div class="search">
      <input type="text" id="search" placeholder="Rechercher nom, email, référence…" oninput="filterTable(this.value)">
      <a href="?" class="refresh">↻ Actualiser</a>
    </div>
    <table id="orders-table">
      <thead>
        <tr>
          <th>Date</th><th>Réf.</th><th>Client</th><th>Livraison</th>
          <th>Adresse / Relais</th><th>Produits</th><th>Port</th><th>Total</th>
        </tr>
      </thead>
      <tbody id="tbody">
        ${rows || '<tr><td colspan="8" class="empty">Aucune commande</td></tr>'}
      </tbody>
    </table>
  </div>
  <script>
    function filterTable(q) {
      q = q.toLowerCase();
      document.querySelectorAll('#tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
