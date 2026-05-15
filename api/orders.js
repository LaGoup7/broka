import Stripe from 'stripe';

export default async function handler(req, res) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.query.key !== adminKey) {
    return res.status(401).send('Accès refusé. Ajoutez ?key=VOTRE_ADMIN_KEY');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const key    = req.query.key;

  // ── Marquer comme traité ───────────────────────────────────────────────────
  if (req.query.mark) {
    await stripe.checkout.sessions.update(req.query.mark, {
      metadata: { processed: 'true', processed_at: new Date().toISOString() },
    });
    return res.redirect(302, `/api/orders?key=${key}`);
  }

  // ── Récupère les sessions ──────────────────────────────────────────────────
  const sessions = await stripe.checkout.sessions.list({ limit: 100, expand: ['data.line_items'] });
  let allSessions = sessions.data;
  if (sessions.has_more) {
    const s2 = await stripe.checkout.sessions.list({
      limit: 100, starting_after: sessions.data[sessions.data.length - 1].id, expand: ['data.line_items'],
    });
    allSessions = [...allSessions, ...s2.data];
  }

  const completed = allSessions
    .filter(s => s.payment_status === 'paid')
    .sort((a, b) => b.created - a.created);

  function fmt(cents) { return (cents / 100).toFixed(2).replace('.', ',') + ' €'; }
  function fmtDate(ts) {
    return new Date(ts * 1000).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const totalRevenue  = completed.reduce((s, o) => s + (o.amount_total ?? 0), 0);
  const totalOrders   = completed.length;
  const totalTraitees = completed.filter(s => s.metadata?.processed === 'true').length;

  const rows = completed.map(s => {
    const meta      = s.metadata ?? {};
    const customer  = s.customer_details ?? {};
    const shipping  = s.shipping_cost?.amount_total ?? 0;
    const total     = s.amount_total ?? 0;
    const isRelay   = meta.delivery_method === 'relay';
    const isProcessed = meta.processed === 'true';
    // Fallback pour les anciennes commandes (adresse collectée par Stripe)
    const sd = s.shipping_details ?? {};
    const sa = sd.address ?? {};
    const legacyAddr = [sd.name, sa.line1, sa.line2, ((sa.postal_code || '') + ' ' + (sa.city || '')).trim()].filter(Boolean).join(', ');
    const address   = isRelay
      ? (meta.relay_point || '—')
      : (meta.home_address || legacyAddr || '—');
    const products  = (s.line_items?.data ?? []).map(i => `${i.description} ×${i.quantity}`).join('<br>');
    const ref       = '#' + s.id.slice(-8).toUpperCase();
    const oversized = meta.oversized === 'true' ? ' ⚠️' : '';
    const rowBg     = isProcessed ? 'background:#f6fdf6' : '';

    const statusCell = isProcessed
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#e8f5e9;color:#2e7d32;
                      padding:5px 12px;border-radius:20px;font-size:.82em;font-weight:700;">
           ✓ Traité
         </span>`
      : `<a href="/api/orders?key=${key}&mark=${s.id}"
            style="display:inline-block;background:#112015;color:#fff;padding:6px 14px;
                   border-radius:20px;font-size:.82em;font-weight:700;text-decoration:none;
                   cursor:pointer;"
            onclick="this.textContent='…'">
           Marquer traité
         </a>`;

    return `
    <tr style="${rowBg}">
      <td style="white-space:nowrap;font-size:.85em;color:#666">${fmtDate(s.created)}</td>
      <td style="font-weight:700;color:#112015">${ref}</td>
      <td>
        <strong>${customer.name ?? '—'}</strong><br>
        <a href="mailto:${customer.email}" style="color:#1C3D22;font-size:.85em">${customer.email ?? '—'}</a><br>
        <span style="color:#777;font-size:.85em">${customer.phone ?? '—'}</span>
      </td>
      <td>
        <span style="display:inline-block;background:${isRelay ? '#e8f5e9' : '#fff3e0'};
                     color:${isRelay ? '#2e7d32' : '#e65100'};padding:3px 10px;
                     border-radius:12px;font-size:.8em;font-weight:700;margin-bottom:6px;">
          ${isRelay ? '📦 Point Relais' : '🏠 Domicile'}
        </span><br>
        <span style="font-size:.85em;color:#333;line-height:1.5;">${address}</span>
      </td>
      <td style="font-size:.85em;color:#444;line-height:1.7">${products}</td>
      <td style="font-weight:700;color:#112015;white-space:nowrap;font-size:.95em">
        ${fmt(total)}${oversized}<br>
        <span style="font-weight:400;color:#999;font-size:.8em">port ${shipping === 0 ? 'offert' : fmt(shipping)}</span>
      </td>
      <td>${statusCell}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BroKa — Commandes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f4efe6; color: #1a1a1a; }
    .header { background: #112015; color: #fff; padding: 20px 32px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .header h1 { font-size: 1.4rem; font-weight: 400; font-style: italic; letter-spacing: 2px; }
    .stats { margin-left: auto; display: flex; gap: 28px; }
    .stat { text-align: right; }
    .stat-val { font-size: 1.4rem; font-weight: 700; color: #C9A45A; }
    .stat-lbl { font-size: .72rem; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: 1px; }
    .container { padding: 20px 28px; max-width: 1400px; margin: 0 auto; }
    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .toolbar input { padding: 9px 14px; border: 1px solid #d2c9b5; border-radius: 8px; font-size: .9rem; width: 280px; }
    .btn-refresh { background: #C9A45A; color: #fff; padding: 9px 18px; border-radius: 8px; font-size: .85rem; font-weight: 700; text-decoration: none; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    th { background: #1C3D22; color: rgba(255,255,255,.75); font-size: .72rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 12px 14px; text-align: left; }
    td { padding: 12px 14px; border-bottom: 1px solid #f0ebe0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fdf9f4; }
    .empty { text-align: center; padding: 48px; color: #999; font-size: .95rem; }
    @media (max-width: 900px) { table { font-size: .82rem; } td,th { padding: 8px 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p style="font-size:.68rem;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Ferme Goyhenetxea</p>
      <h1>BroKa — Admin</h1>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-val">${totalOrders}</div><div class="stat-lbl">Commandes</div></div>
      <div class="stat"><div class="stat-val">${totalTraitees}</div><div class="stat-lbl">Traitées</div></div>
      <div class="stat"><div class="stat-val">${fmt(totalRevenue)}</div><div class="stat-lbl">CA total</div></div>
    </div>
  </div>
  <div class="container">
    <div class="toolbar">
      <input type="text" id="search" placeholder="Rechercher nom, email, référence…" oninput="filterTable(this.value)">
      <a href="/api/orders?key=${key}" class="btn-refresh">↻ Actualiser</a>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Réf.</th><th>Client</th>
          <th>Livraison &amp; Adresse</th><th>Produits</th>
          <th>Total</th><th>Statut</th>
        </tr>
      </thead>
      <tbody id="tbody">
        ${rows || '<tr><td colspan="7" class="empty">Aucune commande payée</td></tr>'}
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
