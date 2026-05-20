import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { createHmac, timingSafeEqual } from 'crypto';

function verifySessionCookie(req, secret) {
  try {
    const raw  = req.headers.cookie ?? '';
    const match = raw.split(';').find(c => c.trim().startsWith('bk_session='));
    if (!match) return null;
    const token   = match.trim().slice('bk_session='.length);
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastDot = decoded.lastIndexOf('.');
    const midDot  = decoded.lastIndexOf('.', lastDot - 1);
    const username = decoded.slice(0, midDot);
    const ts       = decoded.slice(midDot + 1, lastDot);
    const sig      = decoded.slice(lastDot + 1);
    const payload  = `${username}.${ts}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    if (Date.now() - parseInt(ts) > 30 * 24 * 60 * 60 * 1000) return null;
    return username;
  } catch { return null; }
}

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
}

async function sendShippingEmail(session, trackingNumber) {
  const customer = session.customer_details ?? {};
  if (!customer.email) return;

  const meta      = session.metadata ?? {};
  const ref       = '#' + session.id.slice(-8).toUpperCase();
  const isRelay   = meta.delivery_method === 'relay';
  const relayPoint = meta.relay_point || null;
  const homeAddress = meta.home_address || null;
  const addrBlock = isRelay && relayPoint
    ? '<strong>Point Relais® Mondial Relay</strong><br>' + relayPoint
    : (homeAddress || '—');
  const delivMode = isRelay ? 'Point Relais® Mondial Relay' : 'Domicile — Colissimo';
  const base      = 'https://ferme-broka.fr';

  const trackingUrl = trackingNumber
    ? (isRelay
        ? 'https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=' + encodeURIComponent(trackingNumber)
        : 'https://www.laposte.fr/outils/suivre-vos-envois?code=' + encodeURIComponent(trackingNumber))
    : null;

  const trackingBtn = trackingUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td align="center">
      <a href="${trackingUrl}"
         style="display:inline-block;background:#A67C30;color:#fff;text-decoration:none;
                padding:14px 36px;border-radius:4px;font-size:12px;font-weight:700;
                letter-spacing:2px;text-transform:uppercase;">
        Suivre mon colis →
      </a>
      <p style="margin:8px 0 0;font-size:11px;color:#999;">N° ${trackingNumber}</p>
    </td></tr></table>` : `
    <p style="margin-top:20px;font-size:13px;color:#888;font-family:Arial,sans-serif;text-align:center;">
      Le numéro de suivi vous sera communiqué par ${isRelay ? 'Mondial Relay par SMS ou email' : 'La Poste par email'} dès la prise en charge du colis.
    </p>`;

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
          📦 EXPÉDIÉE
        </span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C);"></td></tr>

  <tr><td style="padding:32px 40px 8px;text-align:center;">
    <p style="margin:0 0 6px;font-size:13px;color:#b09070;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Bonne nouvelle !</p>
    <h2 style="margin:0;font-size:22px;color:#112015;font-weight:400;font-style:italic;">Votre commande est en route</h2>
  </td></tr>

  <tr><td style="padding:16px 40px 24px;">
    <table width="100%" style="background:#f8f5f0;border-radius:8px;padding:16px 20px;border-collapse:collapse;">
      <tr>
        <td style="font-size:12px;color:#888;font-family:Arial,sans-serif;">Référence</td>
        <td style="font-size:12px;color:#888;font-family:Arial,sans-serif;text-align:right;">Livraison</td>
      </tr>
      <tr>
        <td style="font-size:18px;font-weight:700;color:#112015;letter-spacing:1px;font-family:Arial,sans-serif;">${ref}</td>
        <td style="font-size:13px;color:#444;font-family:Arial,sans-serif;text-align:right;">${delivMode}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#A67C30;font-family:Arial,sans-serif;">Adresse de livraison</p>
    <p style="font-size:13px;color:#444;line-height:1.6;font-family:Arial,sans-serif;">${addrBlock}</p>

    ${trackingBtn}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td style="background:#f0f7ed;border-radius:8px;padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1C3D22;font-family:Arial,sans-serif;">Des questions ?</p>
        <p style="margin:0;font-size:13px;color:#444;line-height:1.65;font-family:Arial,sans-serif;">
          Contactez-nous à <a href="mailto:contact@ferme-broka.fr" style="color:#1C3D22;">contact@ferme-broka.fr</a>
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

  await makeTransporter().sendMail({
    from:    `"BroKa" <${process.env.GMAIL_USER}>`,
    to:      customer.email,
    replyTo: 'contact@ferme-broka.fr',
    subject: `📦 Votre commande BroKa ${ref} est en route !`,
    html,
  });
}

export default async function handler(req, res) {
  const adminKey   = process.env.ADMIN_KEY ?? '';
  const cookieUser = verifySessionCookie(req, adminKey);
  if (!cookieUser) return res.redirect(302, '/api/login');

  const stripe      = new Stripe(process.env.STRIPE_SECRET_KEY);
  const currentUser = cookieUser;

  // ── POST : confirmer expédition ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { mark, tracking } = req.body ?? {};
    if (mark) {
      const trackingNum = String(tracking ?? '').trim();
      await stripe.checkout.sessions.update(mark, {
        metadata: {
          processed:       'true',
          processed_at:    new Date().toISOString(),
          tracking_number: trackingNum,
        },
      });
      const session = await stripe.checkout.sessions.retrieve(mark, { expand: ['line_items'] });
      try {
        await sendShippingEmail(session, trackingNum || null);
      } catch (err) {
        console.error('Email expédition non envoyé:', err.message);
      }
    }
    return res.redirect(302, '/api/orders');
  }

  // ── Page de confirmation d'expédition ──────────────────────────────────────
  if (req.query.confirm) {
    const session = await stripe.checkout.sessions.retrieve(req.query.confirm, {
      expand: ['line_items'],
    });
    const c       = session.customer_details ?? {};
    const meta    = session.metadata ?? {};
    const isRelay = meta.delivery_method === 'relay';
    const address = isRelay ? (meta.relay_point || '—') : (meta.home_address || '—');
    const ref     = '#' + session.id.slice(-8).toUpperCase();
    const escInline = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const products = (session.line_items?.data ?? [])
      .map(i => `<li style="padding:4px 0;color:#444;font-size:.9rem;">${escInline(i.description)} <strong>×${i.quantity}</strong></li>`)
      .join('');
    const delivLabel = isRelay ? '📦 Point Relais® Mondial Relay' : '🏠 Domicile — Colissimo';

    const confirmHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BroKa — Confirmer l'expédition</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f4efe6;color:#1a1a1a;min-height:100vh;}
    .header{background:#112015;color:#fff;padding:18px 28px;display:flex;align-items:center;gap:12px;}
    .header h1{font-size:1.2rem;font-weight:400;font-style:italic;letter-spacing:2px;}
    .wrap{max-width:560px;margin:32px auto;padding:0 16px;}
    .card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.1);}
    .card-title{background:#1C3D22;color:#fff;padding:16px 24px;font-size:.8rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;}
    .card-body{padding:20px 24px;}
    .row{display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;font-size:.9rem;border-bottom:1px solid #f0ebe0;}
    .row:last-child{border-bottom:none;}
    .lbl{color:#888;font-size:.8rem;padding-top:2px;}
    .val{text-align:right;color:#112015;font-weight:600;max-width:60%;}
    .products{list-style:none;margin:0;padding:0;}
    .tracking-wrap{margin-top:28px;}
    .tracking-wrap label{display:block;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#A67C30;margin-bottom:8px;}
    .tracking-wrap input{width:100%;padding:12px 16px;border:2px solid #d2c9b5;border-radius:10px;font-size:1rem;font-family:monospace;letter-spacing:.05em;}
    .tracking-wrap input:focus{outline:none;border-color:#1C3D22;}
    .hint{font-size:.78rem;color:#aaa;margin-top:6px;}
    .actions{display:flex;gap:12px;margin-top:24px;}
    .btn-confirm{flex:1;background:#112015;color:#fff;padding:14px;border:none;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;letter-spacing:.05em;}
    .btn-confirm:hover{background:#1C3D22;}
    .btn-cancel{padding:14px 20px;background:transparent;color:#888;border:1px solid #d2c9b5;border-radius:10px;font-size:.9rem;text-decoration:none;text-align:center;}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p style="font-size:.6rem;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase;margin-bottom:2px;">Ferme Goyhenetxea</p>
      <h1>BroKa — Expédition</h1>
    </div>
  </div>
  <div class="wrap">
    <p style="margin-bottom:16px;font-size:.85rem;color:#666;">Vérifiez les informations puis confirmez l'expédition. Un email sera envoyé au client.</p>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">Commande ${ref}</div>
      <div class="card-body">
        <div class="row"><span class="lbl">Client</span><span class="val">${escInline(c.name)}</span></div>
        <div class="row"><span class="lbl">Email</span><span class="val" style="font-size:.82rem;">${escInline(c.email)}</span></div>
        <div class="row"><span class="lbl">Livraison</span><span class="val">${delivLabel}</span></div>
        <div class="row"><span class="lbl">Adresse</span><span class="val">${escInline(address)}</span></div>
        <div class="row" style="flex-direction:column;gap:8px;">
          <span class="lbl">Produits</span>
          <ul class="products">${products}</ul>
        </div>
      </div>
    </div>

    <form method="POST" action="/api/orders">
      <input type="hidden" name="mark" value="${session.id}">
      <div class="tracking-wrap">
        <label>Numéro de suivi <span style="font-weight:400;color:#bbb;">(optionnel)</span></label>
        <input type="text" name="tracking" placeholder="${isRelay ? 'Ex: 12345678 (Mondial Relay)' : 'Ex: 2C12345678901 (Colissimo)'}" autocomplete="off">
        <p class="hint">Laissez vide si vous ne l'avez pas encore. L'email partira quand même.</p>
      </div>
      <div class="actions">
        <a href="/api/orders" class="btn-cancel">← Annuler</a>
        <button type="submit" class="btn-confirm">✉️ Expédier et notifier le client</button>
      </div>
    </form>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(confirmHtml);
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  if (req.query.export === 'csv') {
    const EXPAND_CSV = ['data.line_items', 'data.payment_intent.latest_charge'];
    const sessions2 = await stripe.checkout.sessions.list({ limit: 100, expand: EXPAND_CSV });
    let all2 = sessions2.data;
    if (sessions2.has_more) {
      const s2 = await stripe.checkout.sessions.list({
        limit: 100, starting_after: sessions2.data[sessions2.data.length - 1].id, expand: EXPAND_CSV,
      });
      all2 = [...all2, ...s2.data];
    }
    function isRefundedCsv(s) {
      const charge = s.payment_intent?.latest_charge;
      return typeof charge === 'object' && charge !== null && charge.refunded === true;
    }
    const csvRows = all2
      .filter(s => s.payment_status === 'paid' && !isRefundedCsv(s))
      .sort((a, b) => b.created - a.created)
      .map(s => {
        const m   = s.metadata ?? {};
        const c   = s.customer_details ?? {};
        const sd  = s.shipping_details ?? {};
        const sa  = sd.address ?? {};
        const leg = [sd.name, sa.line1, sa.line2, ((sa.postal_code||'')+' '+(sa.city||'')).trim()].filter(Boolean).join(', ');
        const addr = m.delivery_method === 'relay' ? (m.relay_point||'—') : (m.home_address || leg || '—');
        const products = (s.line_items?.data ?? []).map(i => i.description + ' x' + i.quantity).join(' | ');
        const ship = s.shipping_cost?.amount_total ?? 0;
        const tot  = s.amount_total ?? 0;
        const esc  = v => '"' + String(v??'').replace(/"/g,'""') + '"';
        return [
          new Date(s.created*1000).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}),
          '#'+s.id.slice(-8).toUpperCase(),
          c.name??'', c.email??'', c.phone??'',
          m.delivery_method==='relay'?'Point Relais':m.delivery_method==='home'?'Domicile':'—',
          addr, products,
          ((tot-ship)/100).toFixed(2), (ship/100).toFixed(2), (tot/100).toFixed(2),
          m.processed==='true'?'Traité':'En attente',
        ].map(esc).join(',');
      });
    const header = '"Date","Référence","Nom","Email","Téléphone","Mode livraison","Adresse","Produits","Sous-total","Port","Total","Statut"';
    const csv = '﻿' + header + '\r\n' + csvRows.join('\r\n');
    const date = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="commandes-broka-${date}.csv"`);
    return res.status(200).send(csv);
  }

  // ── Récupère les sessions ──────────────────────────────────────────────────
  const EXPAND = ['data.line_items', 'data.payment_intent.latest_charge'];
  const sessions = await stripe.checkout.sessions.list({ limit: 100, expand: EXPAND });
  let allSessions = sessions.data;
  if (sessions.has_more) {
    const s2 = await stripe.checkout.sessions.list({
      limit: 100, starting_after: sessions.data[sessions.data.length - 1].id, expand: EXPAND,
    });
    allSessions = [...allSessions, ...s2.data];
  }

  function isRefunded(s) {
    const charge = s.payment_intent?.latest_charge;
    return typeof charge === 'object' && charge !== null && charge.refunded === true;
  }

  const completed = allSessions
    .filter(s => s.payment_status === 'paid' && !isRefunded(s))
    .sort((a, b) => b.created - a.created);

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function fmt(cents) { return (cents / 100).toFixed(2).replace('.', ',') + ' €'; }
  function fmtDate(ts) {
    return new Date(ts * 1000).toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  function businessDaysSince(ts) {
    const toParisDay = d => {
      const s = d.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' });
      return new Date(s.slice(0, 10));
    };
    let d = toParisDay(new Date(ts * 1000));
    const today = toParisDay(new Date());
    let count = 0;
    while (d < today) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }

  const totalRevenue   = completed.reduce((s, o) => s + (o.amount_total ?? 0), 0);
  const totalOrders    = completed.length;
  const totalTraitees  = completed.filter(s => s.metadata?.processed === 'true').length;
  const pendingWeight  = completed
    .filter(s => s.metadata?.processed !== 'true')
    .reduce((sum, s) => sum + parseFloat(s.metadata?.total_weight_kg ?? 0), 0)
    .toFixed(2).replace('.', ',');

  const rows = completed.map(s => {
    const meta      = s.metadata ?? {};
    const customer  = s.customer_details ?? {};
    const shipping  = s.shipping_cost?.amount_total ?? 0;
    const total     = s.amount_total ?? 0;
    const deliveryMethod = meta.delivery_method; // 'relay', 'home', ou vide pour anciennes commandes
    const isRelay     = deliveryMethod === 'relay';
    const isHome      = deliveryMethod === 'home';
    const isUnknown   = !deliveryMethod;
    const isProcessed = meta.processed === 'true';
    // Adresse : meta (nouvelles commandes) ou shipping_details Stripe (anciennes)
    const sd = s.shipping_details ?? {};
    const sa = sd.address ?? {};
    const legacyAddr = [sd.name, sa.line1, sa.line2, ((sa.postal_code || '') + ' ' + (sa.city || '')).trim()].filter(Boolean).join(', ');
    const address = isRelay
      ? (meta.relay_point || '—')
      : (meta.home_address || legacyAddr || '—');
    const products  = (s.line_items?.data ?? []).map(i => `${esc(i.description)} ×${i.quantity}`).join('<br>');
    const ref       = '#' + s.id.slice(-8).toUpperCase();
    const oversized = meta.oversized === 'true' ? ' ⚠️' : '';
    const weightKg  = meta.total_weight_kg ? parseFloat(meta.total_weight_kg).toFixed(2).replace('.', ',') + ' kg' : '—';

    // Urgence jours ouvrés (seulement pour commandes non traitées)
    const jours = isProcessed ? -1 : businessDaysSince(s.created);
    const urgClass = isProcessed ? 'u-done'
      : jours === 0 ? 'u-fresh'
      : jours === 1 ? 'u-soon'
      : jours === 2 ? 'u-late'
      : 'u-urgent';
    const joursBadge = isProcessed ? ''
      : jours === 0 ? '<span class="jbadge jbadge-fresh">Aujourd\'hui</span>'
      : jours === 1 ? '<span class="jbadge jbadge-soon">J+1 — À expédier</span>'
      : jours === 2 ? '<span class="jbadge jbadge-late">J+2 — Urgent</span>'
      : `<span class="jbadge jbadge-urgent">J+${jours} — En retard !</span>`;

    const processedAt = meta.processed_at
      ? new Date(meta.processed_at).toLocaleString('fr-FR', {
          timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
          year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : null;

    const statusCell = isProcessed
      ? `<span style="display:inline-flex;flex-direction:column;align-items:center;background:#e8f5e9;color:#2e7d32;
                      padding:5px 12px;border-radius:20px;font-size:.82em;font-weight:700;gap:2px;">
           <span>✓ Traité</span>
           ${processedAt ? `<span style="font-size:.75em;font-weight:400;color:#4caf50;white-space:nowrap;">${processedAt}</span>` : ''}
         </span>`
      : `<a href="/api/orders?confirm=${s.id}"
            style="display:inline-block;background:#112015;color:#fff;padding:6px 14px;
                   border-radius:20px;font-size:.82em;font-weight:700;text-decoration:none;cursor:pointer;">
           Marquer traité
         </a>`;

    const delivBadge = `<span class="badge ${isRelay ? 'badge-relay' : isHome ? 'badge-home' : 'badge-unknown'}">
      ${isRelay ? '📦 Point Relais' : isHome ? '🏠 Domicile' : '❓ Mode non renseigné'}
    </span>`;

    const tableRow = `
    <tr class="${urgClass}">
      <td style="white-space:nowrap;font-size:.85em;color:#666">${fmtDate(s.created)}<br>${joursBadge}</td>
      <td style="font-weight:700;color:#112015">${ref}</td>
      <td>
        <strong>${esc(customer.name)}</strong><br>
        <a href="mailto:${esc(customer.email)}" style="color:#1C3D22;font-size:.85em">${esc(customer.email)}</a><br>
        <span style="color:#777;font-size:.85em">${esc(customer.phone)}</span>
      </td>
      <td>${delivBadge}<br><span style="font-size:.85em;color:#333;line-height:1.5;">${esc(address)}</span></td>
      <td style="font-size:.85em;color:#444;line-height:1.7">${products}</td>
      <td style="font-weight:700;color:#112015;white-space:nowrap;font-size:.95em">
        ${fmt(total)}${oversized}<br>
        <span style="font-weight:400;color:#999;font-size:.8em">port ${shipping === 0 ? 'offert' : fmt(shipping)}</span><br>
        <span style="font-weight:400;color:#888;font-size:.78em">⚖ ${weightKg}</span>
      </td>
      <td>${statusCell}</td>
    </tr>`;

    const card = `
    <div class="card ${urgClass}">
      <div class="card-head">
        <div>
          <span class="card-ref">${ref}</span>
          <span class="card-date">${fmtDate(s.created)}</span>
          ${joursBadge}
        </div>
        ${statusCell}
      </div>
      <div class="card-body">
        <div class="card-row">
          <span class="card-label">Client</span>
          <span>
            <strong>${esc(customer.name)}</strong><br>
            <a href="mailto:${esc(customer.email)}" style="color:#1C3D22;">${esc(customer.email)}</a><br>
            <span style="color:#888;">${esc(customer.phone)}</span>
          </span>
        </div>
        <div class="card-row">
          <span class="card-label">Livraison</span>
          <span>${delivBadge}<br><span style="color:#333;">${esc(address)}</span></span>
        </div>
        <div class="card-row">
          <span class="card-label">Produits</span>
          <span style="color:#444;">${products}</span>
        </div>
        <div class="card-total">
          <span>Total${oversized}</span>
          <span>
            ${fmt(total)}
            <span style="font-weight:400;color:#999;font-size:.82em"> · port ${shipping === 0 ? 'offert' : fmt(shipping)}</span>
            <span style="font-weight:400;color:#aaa;font-size:.78em"> · ⚖ ${weightKg}</span>
          </span>
        </div>
      </div>
    </div>`;

    return { tableRow, card };
  });

  const tableRows = rows.map(r => r.tableRow).join('');
  const cardRows  = rows.map(r => r.card).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BroKa — Commandes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { overflow-x: hidden; }
    body { font-family: system-ui, sans-serif; background: #f4efe6; color: #1a1a1a; max-width: 100vw; overflow-x: hidden; }

    /* ── Header ── */
    .header { background: #112015; color: #fff; padding: 16px 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .header h1 { font-size: 1.3rem; font-weight: 400; font-style: italic; letter-spacing: 2px; }
    .stats { margin-left: auto; display: flex; gap: 20px; }
    .stat { text-align: right; }
    .stat-val { font-size: 1.3rem; font-weight: 700; color: #C9A45A; }
    .stat-lbl { font-size: .68rem; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: 1px; }

    /* ── Toolbar ── */
    .container { padding: 16px; max-width: 1400px; margin: 0 auto; }
    .toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .toolbar input { flex: 1; min-width: 180px; padding: 9px 14px; border: 1px solid #d2c9b5; border-radius: 8px; font-size: .9rem; }
    .btn-refresh { background: #C9A45A; color: #fff; padding: 9px 16px; border-radius: 8px; font-size: .85rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .btn-csv     { background: #1C3D22; color: #fff; padding: 9px 16px; border-radius: 8px; font-size: .85rem; font-weight: 700; text-decoration: none; white-space: nowrap; }

    /* ── Badges livraison ── */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: .78em; font-weight: 700; margin-bottom: 4px; }
    .badge-relay   { background: #e8f5e9; color: #2e7d32; }
    .badge-home    { background: #fff3e0; color: #e65100; }
    .badge-unknown { background: #f5f5f5; color: #888; }

    /* ── Badges jours ouvrés ── */
    .jbadge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: .72em; font-weight: 700; margin-top: 3px; }
    .jbadge-fresh  { background: #e8f5e9; color: #2e7d32; }
    .jbadge-soon   { background: #fff8e1; color: #f59e0b; }
    .jbadge-late   { background: #fff3e0; color: #ea580c; }
    .jbadge-urgent { background: #fef2f2; color: #dc2626; }

    /* ── Urgence table rows ── */
    .u-fresh  td { background: #fff; }
    .u-soon   td { background: #fffdf0; }
    .u-late   td { background: #fff8f2; }
    .u-urgent td { background: #fff5f5; }
    .u-done   td { background: #f6fdf6; }
    .u-soon   td:first-child  { box-shadow: inset 4px 0 0 #f59e0b; }
    .u-late   td:first-child  { box-shadow: inset 4px 0 0 #ea580c; }
    .u-urgent td:first-child  { box-shadow: inset 4px 0 0 #dc2626; }
    .u-done   td:first-child  { box-shadow: inset 4px 0 0 #4caf50; }
    tr:hover td { filter: brightness(.97); }

    /* ── Desktop table ── */
    .desktop-view { display: block; }
    .mobile-view  { display: none; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    th { background: #1C3D22; color: rgba(255,255,255,.75); font-size: .72rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 12px 14px; text-align: left; }
    td { padding: 12px 14px; border-bottom: 1px solid #f0ebe0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .empty { text-align: center; padding: 48px; color: #999; font-size: .95rem; }

    /* ── Mobile ── */
    @media (max-width: 700px) {
      .desktop-view { display: none; }
      .mobile-view  { display: block; }
      .header { padding: 12px 16px; }
      .stats { gap: 12px; }
      .stat-val { font-size: 1.05rem; }
      .container { padding: 10px 0; }
      .toolbar { padding: 0 10px; margin-bottom: 10px; }
      .toolbar input { font-size: .85rem; padding: 8px 12px; }
      .btn-refresh, .btn-csv { padding: 8px 12px; font-size: .8rem; }

      /* Cartes plein écran */
      .mobile-view { width: 100vw; overflow: hidden; }
      .card {
        background: #fff;
        border-left: 5px solid #e0e0e0;
        border-bottom: 1px solid #ede8df;
        overflow: hidden;
        width: 100%;
      }
      .u-soon  { border-left-color: #f59e0b; }
      .u-late  { border-left-color: #ea580c; }
      .u-urgent{ border-left-color: #dc2626; }
      .u-done  { border-left-color: #4caf50; background: #f9fdf9; }

      .card-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        padding: 12px 14px 10px; border-bottom: 1px solid #f0ebe0; background: #fafaf8;
        gap: 10px; overflow: hidden;
      }
      .card-ref  { font-weight: 700; color: #112015; font-size: .95rem; display: block; }
      .card-date { font-size: .72rem; color: #999; margin-top: 2px; display: block; }
      .card-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 9px; overflow: hidden; }
      .card-row  { display: flex; gap: 10px; font-size: .85rem; line-height: 1.5; overflow: hidden; }
      .card-row span:last-child { overflow-wrap: break-word; word-break: break-word; min-width: 0; }
      .card-label { min-width: 68px; color: #A67C30; font-weight: 700; font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; padding-top: 3px; flex-shrink: 0; }
      .card-total {
        display: flex; justify-content: space-between; align-items: center;
        padding-top: 9px; border-top: 1px solid #f0ebe0;
        font-weight: 700; color: #112015; font-size: .9rem;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p style="font-size:.62rem;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Ferme Goyhenetxea</p>
      <h1>BroKa — Admin</h1>
      <p style="font-size:.68rem;color:rgba(255,255,255,.3);margin-top:4px;">${currentUser} · <a href="/api/login?logout=1" style="color:rgba(255,255,255,.4);text-decoration:underline;">Déconnexion</a></p>
    </div>
    <nav style="display:flex;gap:6px;margin-left:16px">
      <a href="/api/orders" style="color:#fff;font-size:.78rem;text-decoration:none;padding:4px 12px;border-radius:12px;background:rgba(255,255,255,.18)">Commandes</a>
      <a href="/api/leads" style="color:rgba(255,255,255,.45);font-size:.78rem;text-decoration:none;padding:4px 12px;border-radius:12px;">Leads</a>
    </nav>
    <div class="stats">
      <div class="stat"><div class="stat-val">${totalOrders}</div><div class="stat-lbl">Commandes</div></div>
      <div class="stat"><div class="stat-val">${totalTraitees}</div><div class="stat-lbl">Traitées</div></div>
      <div class="stat"><div class="stat-val">${pendingWeight} kg</div><div class="stat-lbl">À expédier</div></div>
      <div class="stat"><div class="stat-val">${fmt(totalRevenue)}</div><div class="stat-lbl">CA total</div></div>
    </div>
  </div>
  <div class="container">
    <div class="toolbar">
      <input type="text" id="search" placeholder="Rechercher…" oninput="filterAll(this.value)">
      <a href="/api/orders" class="btn-refresh">↻ Actualiser</a>
      <a href="/api/orders?export=csv" class="btn-csv">⬇ CSV</a>
    </div>

    <!-- Desktop -->
    <div class="desktop-view">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Réf.</th><th>Client</th>
            <th>Livraison &amp; Adresse</th><th>Produits</th>
            <th>Total</th><th>Statut</th>
          </tr>
        </thead>
        <tbody id="tbody">
          ${tableRows || '<tr><td colspan="7" class="empty">Aucune commande payée</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Mobile -->
    <div class="mobile-view" id="cards">
      ${cardRows || '<p style="text-align:center;padding:40px;color:#999;">Aucune commande payée</p>'}
    </div>
  </div>
  <script>
    function filterAll(q) {
      q = q.toLowerCase();
      document.querySelectorAll('#tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
      document.querySelectorAll('#cards .card').forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
