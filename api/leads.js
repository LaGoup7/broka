import { createHmac, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';
import nodemailer from 'nodemailer';

function verifySessionCookie(req, secret) {
  try {
    const raw   = req.headers.cookie ?? '';
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

function getKV() {
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(val) {
  const d = (!isNaN(val) && val !== '') ? new Date(parseInt(val)) : new Date(val);
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDay(val) {
  const d = (!isNaN(val) && val !== '') ? new Date(parseInt(val)) : new Date(val);
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'long', year: 'numeric' });
}

async function sendCampaignEmails(db, emails, subject, body) {
  const base        = 'https://ferme-broka.fr';
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
  const bodyHtml = esc(body)
    .replace(/\n\n+/g, '</p><p style="margin:0 0 16px;">')
    .replace(/\n/g, '<br>');
  const leads = await Promise.all(emails.map(e => db.hgetall(`lead:${e}`)));
  await Promise.all(leads.filter(Boolean).map((lead, i) => {
    const to         = emails[i];
    const safePrenom = esc(lead.prenom ?? '');
    const safeNom    = esc(lead.nom    ?? '');
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4ede3;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede3;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(37,61,13,.13);">
  <tr><td style="background:#1e3209;padding:36px 40px;">
    <p style="color:rgba(255,255,255,.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Ferme Goyhenetxea</p>
    <h1 style="color:#fff;margin:0;font-size:32px;letter-spacing:3px;font-weight:400;font-style:italic;">BroKa</h1>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#8B5E3C,#c9973a,#8B5E3C);"></td></tr>
  <tr><td style="padding:36px 40px 40px;">
    <p style="margin:0 0 8px;font-size:13px;color:#b09070;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Bonjour,</p>
    <h2 style="margin:0 0 28px;font-size:22px;color:#1e3209;font-weight:400;font-style:italic;">${safePrenom} ${safeNom}</h2>
    <div style="font-size:15px;color:#444;line-height:1.8;"><p style="margin:0 0 16px;">${bodyHtml}</p></div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #e8ddd0;">
      <tr><td style="padding-top:24px;text-align:center;">
        <a href="${base}/" style="display:inline-block;border:1.5px solid #1e3209;color:#1e3209;text-decoration:none;padding:12px 32px;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Visiter le site</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background:#1e3209;padding:20px 40px;text-align:center;">
    <p style="color:rgba(255,255,255,.35);margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Ferme Goyhenetxea · Soule, Xiberoa · Pays Basque</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
    return transporter.sendMail({
      from:    `"BroKa" <${process.env.GMAIL_USER}>`,
      to,
      replyTo: 'contact@ferme-broka.fr',
      subject,
      html,
    });
  }));
}

export default async function handler(req, res) {
  const adminKey   = process.env.ADMIN_KEY ?? '';
  const cookieUser = verifySessionCookie(req, adminKey);
  if (!cookieUser) return res.redirect(302, '/api/login');

  const currentUser = cookieUser;
  const db          = getKV();

  // ── POST : actions ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action }  = req.body ?? {};
    const rawEmails   = req.body?.emails;
    const emailList   = Array.isArray(rawEmails) ? rawEmails : (rawEmails ? [rawEmails] : []);
    const safeEmails  = emailList
      .map(e => String(e).toLowerCase().trim())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
      .slice(0, 500);

    // Marquer contacté
    if (action === 'contact' && safeEmails.length > 0) {
      const ts = new Date().toISOString();
      await Promise.all(safeEmails.map(e => db.hset(`lead:${e}`, { contacted_at: ts })));
      return res.redirect(302, '/api/leads');
    }

    // Envoi immédiat
    if (action === 'email' && safeEmails.length > 0) {
      const subject = String(req.body?.subject ?? '').trim().replace(/[\r\n]/g, ' ').slice(0, 200);
      const body    = String(req.body?.body    ?? '').trim().slice(0, 5000);
      if (!subject || !body) return res.redirect(302, '/api/leads');

      const verified = (await Promise.all(
        safeEmails.map(async e => ((await db.hexists(`lead:${e}`, 'email')) ? e : null))
      )).filter(Boolean);
      if (!verified.length) return res.redirect(302, '/api/leads');

      await sendCampaignEmails(db, verified, subject, body);
      const ts = new Date().toISOString();
      await Promise.all(verified.map(e => db.hset(`lead:${e}`, { contacted_at: ts })));

      // Sauvegarde dans l'historique
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await db.hset(`campaign:${id}`, {
        id, subject, body,
        emails: JSON.stringify(verified),
        send_at: Date.now(),
        status: 'sent', sent_at: ts,
        recipient_count: verified.length,
        created_at: Date.now(),
      });
      await db.zadd('campaigns:all', { score: Date.now(), member: id });
      return res.redirect(302, '/api/leads');
    }

    // Programmer un envoi différé
    if (action === 'schedule' && safeEmails.length > 0) {
      const title    = String(req.body?.title ?? '').trim().slice(0, 100) || 'Sans titre';
      const messages = [];
      for (let i = 0; i < 10; i++) {
        const subj = String(req.body?.[`msg_subject_${i}`] ?? '').trim().replace(/[\r\n]/g, ' ').slice(0, 200);
        const bod  = String(req.body?.[`msg_body_${i}`]    ?? '').trim().slice(0, 5000);
        const date = String(req.body?.[`msg_date_${i}`]    ?? '');
        const time = String(req.body?.[`msg_time_${i}`]    ?? '07:00').trim();
        if (!subj || !bod || !date) continue;
        const [hh, mm] = time.split(':').map(n => parseInt(n) || 0);
        const sendAt = new Date(`${date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00.000Z`).getTime();
        if (isNaN(sendAt)) continue;
        messages.push({ subject: subj, body: bod, send_at: sendAt, status: 'pending' });
      }
      if (!messages.length) return res.redirect(302, '/api/leads');

      const verified = (await Promise.all(
        safeEmails.map(async e => ((await db.hexists(`lead:${e}`, 'email')) ? e : null))
      )).filter(Boolean);
      if (!verified.length) return res.redirect(302, '/api/leads');

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const firstSendAt = Math.min(...messages.map(m => m.send_at));
      await db.hset(`campaign:${id}`, {
        id, title,
        emails: JSON.stringify(verified),
        messages: JSON.stringify(messages),
        status: 'pending',
        recipient_count: verified.length,
        created_at: Date.now(),
      });
      await db.zadd('campaigns:pending', { score: firstSendAt, member: id });
      await db.zadd('campaigns:all', { score: Date.now(), member: id });
      return res.redirect(302, '/api/leads');
    }

    // Modifier une campagne programmée
    if (action === 'edit-campaign') {
      const cid = String(req.body?.campaign_id ?? '').replace(/[^a-z0-9]/gi, '');
      if (!cid) return res.redirect(302, '/api/leads');
      const existing = await db.hgetall(`campaign:${cid}`);
      if (!existing || existing.status !== 'pending') return res.redirect(302, '/api/leads');

      const title = String(req.body?.title ?? '').trim().slice(0, 100) || 'Sans titre';
      let prevMessages = [];
      if (Array.isArray(existing.messages)) { prevMessages = existing.messages; }
      else { try { prevMessages = JSON.parse(existing.messages ?? '[]'); } catch {} }

      const messages = [];
      for (let i = 0; i < 10; i++) {
        const subj = String(req.body?.[`msg_subject_${i}`] ?? '').trim().replace(/[\r\n]/g, ' ').slice(0, 200);
        const bod  = String(req.body?.[`msg_body_${i}`]    ?? '').trim().slice(0, 5000);
        const date = String(req.body?.[`msg_date_${i}`]    ?? '');
        const time = String(req.body?.[`msg_time_${i}`]    ?? '07:00').trim();
        if (!subj || !bod || !date) continue;
        const [hh, mm] = time.split(':').map(n => parseInt(n) || 0);
        const sendAt = new Date(`${date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00.000Z`).getTime();
        if (isNaN(sendAt)) continue;
        const prev = prevMessages[i] ?? {};
        messages.push({ subject: subj, body: bod, send_at: sendAt, status: prev.status === 'sent' ? 'sent' : 'pending', sent_at: prev.sent_at });
      }
      const pendingMsgs = messages.filter(m => m.status === 'pending');
      if (!pendingMsgs.length) return res.redirect(302, '/api/leads');

      // Mise à jour des destinataires si de nouveaux sont fournis
      const updatePayload = { title, messages: JSON.stringify(messages) };
      if (safeEmails.length > 0) {
        const verified = (await Promise.all(
          safeEmails.map(async e => ((await db.hexists(`lead:${e}`, 'email')) ? e : null))
        )).filter(Boolean);
        if (verified.length > 0) {
          updatePayload.emails = JSON.stringify(verified);
          updatePayload.recipient_count = verified.length;
        }
      }

      const firstSendAt = Math.min(...pendingMsgs.map(m => m.send_at));
      await db.hset(`campaign:${cid}`, updatePayload);
      await db.zadd('campaigns:pending', { score: firstSendAt, member: cid });
      return res.redirect(302, '/api/leads');
    }

    // Annuler une campagne
    if (action === 'cancel') {
      const cid = String(req.body?.campaign_id ?? '').replace(/[^a-z0-9]/gi, '');
      if (cid) {
        await db.hset(`campaign:${cid}`, { status: 'cancelled' });
        await db.zrem('campaigns:pending', cid);
      }
      return res.redirect(302, '/api/leads');
    }

    // Ajout manuel d'un lead
    if (action === 'add') {
      const prenom = String(req.body?.prenom ?? '').trim().slice(0, 100);
      const nom    = String(req.body?.nom    ?? '').trim().slice(0, 100);
      const email  = String(req.body?.email  ?? '').toLowerCase().trim();
      const tel    = String(req.body?.tel    ?? '').trim().slice(0, 30);
      if (!prenom || !nom || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.redirect(302, '/api/leads');
      }
      const ts = Date.now();
      await db.hset(`lead:${email}`, { prenom, nom, email, tel, created_at: ts });
      await db.zadd('leads', { score: ts, member: email });
      return res.redirect(302, '/api/leads');
    }

    // Modifier un lead existant
    if (action === 'delete-lead') {
      const email = String(req.body?.email ?? '').toLowerCase().trim();
      if (email) {
        await db.del(`lead:${email}`);
        await db.zrem('leads', email);
      }
      return res.redirect(302, '/api/leads');
    }

    if (action === 'edit-lead') {
      const originalEmail = String(req.body?.original_email ?? '').toLowerCase().trim();
      const prenom = String(req.body?.prenom ?? '').trim().slice(0, 100);
      const nom    = String(req.body?.nom    ?? '').trim().slice(0, 100);
      const email  = String(req.body?.email  ?? '').toLowerCase().trim();
      const tel    = String(req.body?.tel    ?? '').trim().slice(0, 30);
      if (!originalEmail || !prenom || !nom || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.redirect(302, '/api/leads');
      }
      const existing = await db.hgetall(`lead:${originalEmail}`);
      if (!existing) return res.redirect(302, '/api/leads');

      if (email !== originalEmail) {
        // Email changé : créer nouvelle clé, supprimer l'ancienne
        const score = parseInt(existing.created_at) || Date.now();
        const merged = Object.assign({}, existing, { prenom, nom, email, tel });
        await db.hset(`lead:${email}`, merged);
        await db.zadd('leads', { score, member: email });
        await db.del(`lead:${originalEmail}`);
        await db.zrem('leads', originalEmail);
      } else {
        await db.hset(`lead:${originalEmail}`, { prenom, nom, email, tel });
      }
      return res.redirect(302, '/api/leads');
    }

    return res.redirect(302, '/api/leads');
  }

  // ── Récupère leads + campagnes ─────────────────────────────────────────────
  const [emailList, allCampaignIds] = await Promise.all([
    db.zrange('leads', 0, -1, { rev: true }),
    db.zrange('campaigns:all', 0, 19, { rev: true }),
  ]);

  const [rawLeads, rawCampaigns] = await Promise.all([
    emailList.length > 0 ? Promise.all(emailList.map(e => db.hgetall(`lead:${e}`))) : Promise.resolve([]),
    allCampaignIds.length > 0 ? Promise.all(allCampaignIds.map(id => db.hgetall(`campaign:${id}`))) : Promise.resolve([]),
  ]);

  const leads            = rawLeads.filter(Boolean);
  const campaigns        = rawCampaigns.filter(Boolean);
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending');
  const sentCampaigns    = campaigns.filter(c => c.status === 'sent').slice(0, 5);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  if (req.query.export === 'csv') {
    const csvEsc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const header  = '"Date inscription","Prénom","Nom","Email","Téléphone","Statut","Date contact"';
    const csvRows = leads.map(l => [
      fmtDate(l.created_at), l.prenom ?? '', l.nom ?? '', l.email ?? '', l.tel ?? '',
      l.contacted_at ? 'Contacté' : 'Non contacté',
      l.contacted_at ? fmtDate(l.contacted_at) : '',
    ].map(csvEsc).join(','));
    const csv  = '﻿' + header + '\r\n' + csvRows.join('\r\n');
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-broka-${date}.csv"`);
    return res.status(200).send(csv);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalLeads     = leads.length;
  const totalContacted = leads.filter(l => l.contacted_at).length;
  const oneWeekAgo     = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek    = leads.filter(l => parseInt(l.created_at) > oneWeekAgo).length;

  // ── Rows HTML ──────────────────────────────────────────────────────────────
  const tableRows = leads.map(l => {
    const isContacted = !!l.contacted_at;
    const statusBadge = isContacted
      ? `<span class="badge badge-done">✓ Contacté<br><small>${fmtDate(l.contacted_at)}</small></span>`
      : `<span class="badge badge-pending">Non contacté</span>`;
    return `<tr data-row>
      <td><input type="checkbox" name="emails" value="${esc(l.email)}" data-name="${esc(l.prenom)} ${esc(l.nom)}" form="bulk-form"></td>
      <td style="white-space:nowrap;font-size:.85em;color:#666">${fmtDate(l.created_at)}</td>
      <td><strong>${esc(l.prenom)} ${esc(l.nom)}</strong></td>
      <td><a href="mailto:${esc(l.email)}" style="color:#1C3D22;font-size:.85em">${esc(l.email)}</a></td>
      <td style="color:#666;font-size:.85em">${esc(l.tel) || '—'}</td>
      <td>${statusBadge}</td>
      <td><button onclick="openEditLead(this)" data-email="${esc(l.email)}" data-prenom="${esc(l.prenom)}" data-nom="${esc(l.nom)}" data-tel="${esc(l.tel || '')}" style="background:none;border:none;cursor:pointer;color:#888;font-size:1rem;padding:4px;" title="Modifier">✏</button></td>
    </tr>`;
  }).join('');

  const mobileCards = leads.map(l => {
    const isContacted = !!l.contacted_at;
    const statusBadge = isContacted
      ? `<span class="badge badge-done">✓ ${fmtDate(l.contacted_at)}</span>`
      : `<span class="badge badge-pending">Non contacté</span>`;
    return `<div class="card" data-row>
      <div class="card-head">
        <div><strong>${esc(l.prenom)} ${esc(l.nom)}</strong><span class="card-date">${fmtDate(l.created_at)}</span></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="openEditLead(this)" data-email="${esc(l.email)}" data-prenom="${esc(l.prenom)}" data-nom="${esc(l.nom)}" data-tel="${esc(l.tel || '')}" style="background:none;border:none;cursor:pointer;color:#888;font-size:1rem;padding:4px;" title="Modifier">✏</button>
          <input type="checkbox" name="emails" value="${esc(l.email)}" data-name="${esc(l.prenom)} ${esc(l.nom)}" form="bulk-form">
        </div>
      </div>
      <div class="card-body">
        <div class="card-row"><span class="card-label">Email</span><a href="mailto:${esc(l.email)}" style="color:#1C3D22;">${esc(l.email)}</a></div>
        <div class="card-row"><span class="card-label">Tél</span><span>${esc(l.tel) || '—'}</span></div>
        <div class="card-row"><span class="card-label">Statut</span>${statusBadge}</div>
      </div>
    </div>`;
  }).join('');

  // ── Helper : parse messages (compat ancien format + Upstash auto-parse) ───────
  function parseMsgs(c) {
    if (c.messages) {
      if (Array.isArray(c.messages)) return c.messages;
      try { const p = JSON.parse(c.messages); if (Array.isArray(p)) return p; } catch {}
    }
    if (c.subject) {
      return [{ subject: c.subject, body: c.body, send_at: c.send_at, status: c.status === 'sent' ? 'sent' : 'pending', sent_at: c.sent_at }];
    }
    return [];
  }

  // ── Section campagnes HTML (toujours visible) ─────────────────────────────
  const campaignsHtml = `
<div style="margin-top:28px;">
  <h2 style="font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:14px;padding:0 2px;">Campagnes email</h2>

  ${pendingCampaigns.length > 0 ? `
  <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#A67C30;font-weight:700;margin-bottom:8px;">Programmées</p>
  ${pendingCampaigns.map(c => {
    const msgs = parseMsgs(c);
    const pendingMsgs = msgs.filter(m => m.status !== 'sent');
    const title = esc(c.title || c.subject || 'Sans titre');
    let emailsArr = [];
    try { emailsArr = typeof c.emails === 'string' ? JSON.parse(c.emails) : (Array.isArray(c.emails) ? c.emails : []); } catch {}
    const editData = esc(JSON.stringify({ id: c.id, title: c.title || '', emails: emailsArr, messages: msgs }));
    return `
  <div style="background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:8px;border-left:4px solid #f59e0b;box-shadow:0 1px 6px rgba(0,0,0,.06);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:${pendingMsgs.length ? '10px' : '0'};">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:#112015;font-size:.92rem;margin-bottom:3px;">${title}</div>
        <div style="font-size:.75rem;color:#888;">${esc(String(c.recipient_count))} destinataire${c.recipient_count > 1 ? 's' : ''} · ${pendingMsgs.length} email${pendingMsgs.length > 1 ? 's' : ''} programmé${pendingMsgs.length > 1 ? 's' : ''}</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button type="button" data-campaign="${editData}" onclick="editCampaign(this)" style="padding:5px 12px;border:1.5px solid #1C3D22;color:#1C3D22;background:transparent;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer;">✏ Modifier</button>
        <form method="POST" action="/api/leads" style="display:inline;">
          <input type="hidden" name="action" value="cancel">
          <input type="hidden" name="campaign_id" value="${esc(c.id)}">
          <button type="submit" style="padding:5px 12px;border:1.5px solid #ef4444;color:#ef4444;background:transparent;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer;">✕ Annuler</button>
        </form>
      </div>
    </div>
    ${pendingMsgs.map((m, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0;${i < pendingMsgs.length - 1 ? 'border-bottom:1px solid #f0ebe0;' : ''}">
      <span style="font-size:.7rem;color:#A67C30;font-weight:700;min-width:58px;">Email ${i + 1}</span>
      <span style="flex:1;font-size:.83rem;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(m.subject)}</span>
      <span style="font-size:.72rem;color:#888;white-space:nowrap;">📅 ${fmtDay(m.send_at)} · ${(() => { const d = new Date(parseInt(m.send_at)); return String(d.getUTCHours()).padStart(2,'0') + 'h' + String(d.getUTCMinutes()).padStart(2,'0') + ' UTC'; })()}</span>
    </div>`).join('')}
  </div>`;
  }).join('')}` : ''}

  ${sentCampaigns.length > 0 ? `
  <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#888;font-weight:700;margin:${pendingCampaigns.length ? '16px' : '0'} 0 8px;">Historique</p>
  ${sentCampaigns.map(c => {
    const msgs = parseMsgs(c);
    const sentCount = msgs.filter(m => m.status === 'sent').length || 1;
    const title = esc(c.title || c.subject || 'Sans titre');
    return `
  <div style="background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:8px;border-left:4px solid #4caf50;box-shadow:0 1px 6px rgba(0,0,0,.06);">
    <div style="font-weight:700;color:#666;font-size:.9rem;margin-bottom:3px;">${title}</div>
    <div style="font-size:.75rem;color:#888;">✓ ${sentCount} email${sentCount > 1 ? 's' : ''} envoyé${sentCount > 1 ? 's' : ''} · ${esc(String(c.recipient_count))} destinataire${c.recipient_count > 1 ? 's' : ''} · ${fmtDate(c.sent_at ?? c.send_at)}</div>
  </div>`;
  }).join('')}` : ''}

  ${pendingCampaigns.length === 0 && sentCampaigns.length === 0 ? `
  <div style="background:#fff;border-radius:10px;padding:24px;text-align:center;color:#bbb;font-size:.9rem;box-shadow:0 1px 6px rgba(0,0,0,.06);">
    Aucune campagne pour l'instant — sélectionnez des leads et cliquez sur <strong>✉ Envoyer un email</strong>
  </div>` : ''}
</div>`;

  // ── HTML page ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BroKa — Leads</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html{overflow-x:hidden}
    body{font-family:system-ui,sans-serif;background:#f4efe6;color:#1a1a1a;max-width:100vw;overflow-x:hidden}
    .header{background:#112015;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
    .header h1{font-size:1.3rem;font-weight:400;font-style:italic;letter-spacing:2px}
    .admin-nav{display:flex;gap:6px;margin-left:16px}
    .admin-nav a{color:rgba(255,255,255,.45);font-size:.78rem;text-decoration:none;padding:4px 12px;border-radius:12px;transition:background .2s}
    .admin-nav a:hover{background:rgba(255,255,255,.1);color:#fff}
    .admin-nav a.active{background:rgba(255,255,255,.18);color:#fff}
    .stats{margin-left:auto;display:flex;gap:20px}
    .stat{text-align:right}
    .stat-val{font-size:1.3rem;font-weight:700;color:#C9A45A}
    .stat-lbl{font-size:.68rem;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:1px}
    .container{padding:16px;max-width:1200px;margin:0 auto}
    .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
    .toolbar input[type=text]{flex:1;min-width:180px;padding:9px 14px;border:1px solid #d2c9b5;border-radius:8px;font-size:.9rem}
    .btn{padding:9px 16px;border-radius:8px;font-size:.85rem;font-weight:700;text-decoration:none;white-space:nowrap;border:none;cursor:pointer;display:inline-block}
    .btn-gold{background:#C9A45A;color:#fff}
    .btn-green{background:#1C3D22;color:#fff}
    .btn-purple{background:#6d28d9;color:#fff}
    .btn-outline{background:transparent;color:#1C3D22;border:1.5px solid #1C3D22}
    .badge{display:inline-block;padding:4px 10px;border-radius:12px;font-size:.78em;font-weight:700;line-height:1.4}
    .badge small{display:block;font-size:.82em;font-weight:400}
    .badge-done{background:#e8f5e9;color:#2e7d32}
    .badge-pending{background:#fff3e0;color:#e65100}
    .desktop-view{display:block}
    .mobile-view{display:none}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
    th{background:#1C3D22;color:rgba(255,255,255,.75);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:12px 14px;text-align:left}
    td{padding:12px 14px;border-bottom:1px solid #f0ebe0;vertical-align:top}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafaf7}
    .empty{text-align:center;padding:48px;color:#999;font-size:.95rem}
    input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:#1C3D22}

    /* Modal */
    .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100;align-items:center;justify-content:center;padding:16px}
    .modal-overlay.open{display:flex}
    .modal{background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .modal-header{background:#112015;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0}
    .modal-header h2{color:#fff;font-size:1rem;font-weight:400;font-style:italic;letter-spacing:2px}
    .modal-close{background:none;border:none;color:rgba(255,255,255,.6);font-size:1.3rem;cursor:pointer}
    .modal-body{padding:24px}
    .modal-field{margin-bottom:18px}
    .modal-field label.field-label{display:block;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#A67C30;margin-bottom:7px}
    .to-box{background:#f8f5f0;border-radius:8px;padding:10px 14px;font-size:.88rem;color:#444;min-height:36px;line-height:1.5}
    .modal-field input[type=text],.modal-field input[type=date],.modal-field textarea{width:100%;padding:10px 14px;border:1.5px solid #d2c9b5;border-radius:8px;font-size:.92rem;font-family:inherit;transition:border-color .2s}
    .modal-field input:focus,.modal-field textarea:focus{outline:none;border-color:#1C3D22}
    .modal-field textarea{resize:vertical}
    .radio-row{display:flex;gap:20px;margin-bottom:10px}
    .radio-opt{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:.9rem;color:#333}
    .radio-opt input{width:16px;height:16px;accent-color:#1C3D22}
    .schedule-hint{font-size:.75rem;color:#999;margin-top:5px}
    .modal-actions{display:flex;gap:12px;margin-top:24px}
    .modal-cancel-btn{padding:12px 20px;border:1px solid #d2c9b5;border-radius:8px;background:transparent;color:#888;cursor:pointer;font-size:.88rem}
    .modal-submit-btn{flex:1;padding:12px;background:#112015;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:.9rem}
    .modal-submit-btn:hover{background:#1C3D22}
    .modal-delete-btn{padding:12px 16px;border:1px solid #e0b0b0;border-radius:8px;background:transparent;color:#c0392b;cursor:pointer;font-size:.85rem;margin-right:auto}
    .modal-delete-btn:hover{background:#fdf0f0;border-color:#c0392b}

    .leads-picker-list{max-height:180px;overflow-y:auto;border:1.5px solid #d2c9b5;border-radius:8px;}
    .leads-picker-row{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;font-size:.88rem;border-bottom:1px solid #f0ebe0;}
    .leads-picker-row:last-child{border-bottom:none}
    .leads-picker-row:hover{background:#faf9f7}
    .leads-picker-row input{flex-shrink:0}
    .leads-picker-row small{color:#999;margin-left:auto;font-size:.78em}
    @media(max-width:700px){
      .desktop-view{display:none}
      .mobile-view{display:block}
      .header{padding:12px 16px}
      .stats{gap:12px}
      .stat-val{font-size:1.05rem}
      .container{padding:10px 0}
      .toolbar{padding:0 10px;margin-bottom:10px}
      .admin-nav{display:none}
      .card{background:#fff;border-bottom:1px solid #ede8df;border-left:4px solid #C9A45A}
      .card-head{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 14px 8px;background:#fafaf8;border-bottom:1px solid #f0ebe0;gap:10px}
      .card-date{display:block;font-size:.72rem;color:#999;margin-top:2px}
      .card-body{padding:10px 14px 14px;display:flex;flex-direction:column;gap:8px}
      .card-row{display:flex;gap:10px;font-size:.85rem;line-height:1.5}
      .card-row span:last-child{overflow-wrap:break-word;word-break:break-word;min-width:0}
      .card-label{min-width:55px;color:#A67C30;font-weight:700;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;padding-top:2px;flex-shrink:0}
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p style="font-size:.62rem;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Ferme Goyhenetxea</p>
      <h1>BroKa — Admin</h1>
      <p style="font-size:.68rem;color:rgba(255,255,255,.3);margin-top:4px;">${esc(currentUser)} · <a href="/api/login?logout=1" style="color:rgba(255,255,255,.4);text-decoration:underline;">Déconnexion</a></p>
    </div>
    <nav class="admin-nav">
      <a href="/api/orders">Commandes</a>
      <a href="/api/leads" class="active">Leads</a>
    </nav>
    <div class="stats">
      <div class="stat"><div class="stat-val">${totalLeads}</div><div class="stat-lbl">Total leads</div></div>
      <div class="stat"><div class="stat-val">${newThisWeek}</div><div class="stat-lbl">Cette semaine</div></div>
      <div class="stat"><div class="stat-val">${totalContacted}</div><div class="stat-lbl">Contactés</div></div>
    </div>
  </div>

  <form id="bulk-form" method="POST" action="/api/leads">
    <input type="hidden" name="action" value="contact">
  </form>

  <div class="container">
    <div class="toolbar">
      <input type="text" id="search" placeholder="Rechercher…" oninput="filterAll(this.value)">
      <button class="btn btn-outline" onclick="selectAll(event)">Tout sélectionner</button>
      <button class="btn btn-gold" onclick="markContacted(event)">✓ Marquer contacté</button>
      <button class="btn btn-purple" onclick="openCompose(event)">✉ Envoyer un email</button>
      <button class="btn btn-green" onclick="openAddLead(event)">+ Nouveau lead</button>
      <a href="/api/leads?export=csv" class="btn btn-outline">⬇ CSV</a>
      <a href="/api/leads" class="btn btn-outline">↻ Actualiser</a>
    </div>

    <div class="desktop-view">
      <table>
        <thead>
          <tr>
            <th style="width:32px"><input type="checkbox" id="check-all" onchange="toggleAll(this)"></th>
            <th>Date</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Statut</th><th style="width:36px"></th>
          </tr>
        </thead>
        <tbody id="tbody">
          ${tableRows || '<tr><td colspan="6" class="empty">Aucun lead enregistré</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="mobile-view" id="cards">
      ${mobileCards || '<p style="text-align:center;padding:40px;color:#999;">Aucun lead enregistré</p>'}
    </div>

    ${campaignsHtml}
  </div>

  <!-- Modal ajout manuel de lead -->
  <div class="modal-overlay" id="add-lead-modal">
    <div class="modal" style="max-width:440px;">
      <div class="modal-header">
        <h2>Nouveau lead</h2>
        <button class="modal-close" onclick="closeAddLead()">✕</button>
      </div>
      <form class="modal-body" method="POST" action="/api/leads">
        <input type="hidden" name="action" value="add">
        <div class="modal-field">
          <label class="field-label">Prénom</label>
          <input type="text" name="prenom" required maxlength="100" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="field-label">Nom</label>
          <input type="text" name="nom" required maxlength="100" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="field-label">Email</label>
          <input type="email" name="email" required autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="field-label">Téléphone <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0;">(optionnel)</span></label>
          <input type="tel" name="tel" maxlength="30" autocomplete="off">
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-cancel-btn" onclick="closeAddLead()">Annuler</button>
          <button type="submit" class="modal-submit-btn">Ajouter →</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal modification lead -->
  <div class="modal-overlay" id="edit-lead-modal">
    <div class="modal" style="max-width:440px;">
      <div class="modal-header">
        <h2>Modifier le contact</h2>
        <button class="modal-close" onclick="closeEditLead()">✕</button>
      </div>
      <form class="modal-body" method="POST" action="/api/leads">
        <input type="hidden" name="action" value="edit-lead">
        <input type="hidden" name="original_email" id="edit-original-email">
        <div class="modal-field">
          <label class="field-label">Prénom</label>
          <input type="text" name="prenom" id="edit-prenom" required maxlength="100" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="field-label">Nom</label>
          <input type="text" name="nom" id="edit-nom" required maxlength="100" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="field-label">Email</label>
          <input type="email" name="email" id="edit-email" required autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="field-label">Téléphone <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0;">(optionnel)</span></label>
          <input type="tel" name="tel" id="edit-tel" maxlength="30" autocomplete="off">
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-delete-btn" onclick="confirmDeleteLead()">🗑 Supprimer</button>
          <button type="button" class="modal-cancel-btn" onclick="closeEditLead()">Annuler</button>
          <button type="submit" class="modal-submit-btn">Enregistrer →</button>
        </div>
      </form>
      <form id="delete-lead-form" method="POST" action="/api/leads" style="display:none;">
        <input type="hidden" name="action" value="delete-lead">
        <input type="hidden" name="email" id="delete-lead-email">
      </form>
    </div>
  </div>

  <!-- Modal composition email -->
  <div class="modal-overlay" id="compose-modal">
    <div class="modal" style="max-width:660px;">
      <div class="modal-header">
        <h2 id="modal-title-txt">Composer un email</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <form id="compose-form" class="modal-body" method="POST" action="/api/leads">
        <input type="hidden" name="action" value="email" id="compose-action">
        <input type="hidden" name="campaign_id" id="campaign-id-input">
        <div id="to-inputs"></div>

        <div class="modal-field">
          <label class="field-label">À</label>
          <div class="to-box" id="to-display">—</div>
          <!-- Sélecteur de leads (mode édition uniquement) -->
          <div id="leads-picker" style="display:none;margin-top:8px;">
            <input type="text" placeholder="Filtrer les leads…" oninput="filterLeadsPicker(this.value)" style="width:100%;padding:8px 12px;border:1.5px solid #d2c9b5;border-radius:8px;font-size:.85rem;margin-bottom:6px;">
            <div class="leads-picker-list" id="leads-picker-list">
              ${leads.length ? leads.map(l => `<label class="leads-picker-row" data-search="${esc((l.prenom + ' ' + l.nom + ' ' + l.email).toLowerCase())}"><input type="checkbox" class="lead-pick-cb" name="emails" value="${esc(l.email)}" disabled><span>${esc(l.prenom)} ${esc(l.nom)}</span><small>${esc(l.email)}</small></label>`).join('') : '<p style="padding:12px;color:#bbb;font-size:.85rem;text-align:center;">Aucun lead</p>'}
            </div>
            <div style="margin-top:5px;font-size:.75rem;color:#888;" id="pick-count">0 destinataire sélectionné</div>
          </div>
        </div>

        <div class="modal-field">
          <label class="field-label">Mode d'envoi</label>
          <div class="radio-row">
            <label class="radio-opt">
              <input type="radio" name="send_mode" value="now" checked onchange="toggleSendMode('now')">
              <span>Maintenant</span>
            </label>
            <label class="radio-opt">
              <input type="radio" name="send_mode" value="later" onchange="toggleSendMode('later')">
              <span>Programmer</span>
            </label>
          </div>
        </div>

        <!-- Titre (affiché uniquement en mode programmé) -->
        <div class="modal-field" id="title-field" style="display:none;">
          <label class="field-label">Titre de la campagne</label>
          <input type="text" id="campaign-title" name="title" maxlength="100" placeholder="Ex : Newsletter été 2025">
        </div>

        <!-- Section Maintenant -->
        <div id="now-section">
          <div class="modal-field">
            <label class="field-label">Objet</label>
            <input type="text" name="subject" maxlength="200" placeholder="Ex : Nouveautés BroKa — Été 2025">
          </div>
          <div class="modal-field">
            <label class="field-label">Message</label>
            <textarea name="body" rows="7" maxlength="5000" placeholder="Votre message…&#10;&#10;Les sauts de ligne sont conservés."></textarea>
          </div>
        </div>

        <!-- Section Programmer -->
        <div id="later-section" style="display:none;">
          <div id="messages-container"></div>
          <button type="button" id="add-msg-btn" onclick="addMessage()" style="width:100%;margin-top:8px;padding:10px;border:1.5px dashed #d2c9b5;border-radius:8px;background:transparent;color:#888;font-size:.85rem;cursor:pointer;">+ Ajouter un email (max 10)</button>
        </div>

        <div class="modal-actions">
          <button type="button" class="modal-cancel-btn" onclick="closeModal()">Annuler</button>
          <button type="submit" class="modal-submit-btn" id="submit-btn">Envoyer →</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // ── Filtres / sélection ────────────────────────────────────────────────────
    function filterAll(q) {
      q = q.toLowerCase();
      document.querySelectorAll('[data-row]').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
    function toggleAll(cb) {
      document.querySelectorAll('input[name="emails"]').forEach(c => c.checked = cb.checked);
    }
    function selectAll(e) {
      e.preventDefault();
      document.querySelectorAll('input[name="emails"]').forEach(c => c.checked = true);
    }
    function getChecked() {
      return [...document.querySelectorAll('input[name="emails"]:checked')];
    }
    function markContacted(e) {
      e.preventDefault();
      if (!getChecked().length) { alert('Sélectionnez au moins un lead.'); return; }
      document.getElementById('bulk-form').submit();
    }

    // ── Modale compose ─────────────────────────────────────────────────────────
    let msgCount = 0;
    let _editMode = false;

    function setRecipients(emails, names) {
      document.getElementById('to-inputs').innerHTML =
        emails.map(e => '<input type="hidden" name="emails" value="' + e.replace(/"/g, '&quot;') + '">').join('');
      const label = (names || emails).join(', ') + ' (' + emails.length + ' destinataire' + (emails.length > 1 ? 's' : '') + ')';
      document.getElementById('to-display').textContent = label;
    }

    function openCompose(e) {
      e.preventDefault();
      const checked = getChecked();
      if (!checked.length) { alert('Sélectionnez au moins un lead.'); return; }
      setRecipients(checked.map(c => c.value), checked.map(c => c.dataset.name || c.value));
      _editMode = false;
      document.getElementById('campaign-id-input').value = '';
      document.getElementById('campaign-title').value = '';
      document.getElementById('modal-title-txt').textContent = 'Composer un email';
      const ns = document.getElementById('now-section');
      ns.querySelector('input[name="subject"]').value = '';
      ns.querySelector('textarea[name="body"]').value = '';
      msgCount = 0;
      document.getElementById('messages-container').innerHTML = '';
      _setLeadsPicker(false, []);
      document.querySelector('input[name="send_mode"][value="now"]').checked = true;
      toggleSendMode('now');
      document.getElementById('compose-modal').classList.add('open');
    }

    function editCampaign(btn) {
      const data = JSON.parse(btn.dataset.campaign);
      _editMode = true;
      document.getElementById('campaign-id-input').value = data.id;
      document.getElementById('campaign-title').value = data.title || '';
      document.getElementById('modal-title-txt').textContent = 'Modifier la campagne';
      const emails = Array.isArray(data.emails) ? data.emails : [];
      _setLeadsPicker(true, emails);
      document.getElementById('to-inputs').innerHTML = '';
      document.querySelector('input[name="send_mode"][value="later"]').checked = true;
      toggleSendMode('later');
      resetMessages();
      const pending = (data.messages || []).filter(m => m.status !== 'sent');
      if (!pending.length) { addMessage(); }
      else { pending.forEach((msg, i) => { if (i > 0) addMessage(); populateMsg(i, msg); }); }
      document.getElementById('compose-modal').classList.add('open');
    }

    function _setLeadsPicker(show, selectedEmails) {
      const picker = document.getElementById('leads-picker');
      const toBox  = document.getElementById('to-display');
      picker.style.display = show ? 'block' : 'none';
      toBox.style.display  = show ? 'none'  : '';
      document.querySelectorAll('.lead-pick-cb').forEach(cb => {
        cb.disabled = !show;
        cb.checked  = show && selectedEmails.includes(cb.value);
      });
      if (show) _updatePickCount();
    }

    function filterLeadsPicker(q) {
      q = q.toLowerCase();
      document.querySelectorAll('.leads-picker-row').forEach(r => {
        r.style.display = r.dataset.search.includes(q) ? '' : 'none';
      });
    }

    function _updatePickCount() {
      const n = document.querySelectorAll('.lead-pick-cb:checked').length;
      const el = document.getElementById('pick-count');
      if (el) el.textContent = n + ' destinataire' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '');
    }

    document.getElementById('leads-picker-list').addEventListener('change', _updatePickCount);

    function populateMsg(i, msg) {
      const block = document.getElementById('msg-block-' + i);
      if (!block) return;
      block.querySelector('.msg-subj').value = msg.subject || '';
      block.querySelector('.msg-body').value = msg.body || '';
      const d = new Date(parseInt(msg.send_at) || 0);
      block.querySelector('.msg-date').value = d.toISOString().slice(0, 10);
      block.querySelector('.msg-time').value = String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
    }

    function closeModal() {
      document.getElementById('compose-modal').classList.remove('open');
      _setLeadsPicker(false, []);
    }

    function toggleSendMode(mode) {
      const isNow = mode === 'now';
      document.getElementById('now-section').style.display    = isNow ? 'block' : 'none';
      document.getElementById('later-section').style.display  = isNow ? 'none'  : 'block';
      document.getElementById('title-field').style.display    = isNow ? 'none'  : 'block';
      document.getElementById('compose-action').value = isNow ? 'email' : (_editMode ? 'edit-campaign' : 'schedule');
      document.getElementById('submit-btn').textContent = isNow ? 'Envoyer →' : (_editMode ? 'Enregistrer →' : 'Programmer →');
      if (!isNow && msgCount === 0) resetMessages();
    }

    // ── Messages dynamiques ────────────────────────────────────────────────────
    function resetMessages() {
      msgCount = 0;
      document.getElementById('messages-container').innerHTML = '';
      addMessage();
    }

    function addMessage() {
      if (msgCount >= 10) return;
      const i = msgCount;
      const minD = new Date(); minD.setDate(minD.getDate() + 1);
      const defD = new Date(); defD.setDate(defD.getDate() + 1 + i);
      const min = minD.toISOString().slice(0, 10);
      const def = defD.toISOString().slice(0, 10);
      const div = document.createElement('div');
      div.className = 'msg-block'; div.id = 'msg-block-' + i;
      div.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<span class="msg-num" style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#A67C30;">Email ' + (i+1) + '</span>' +
          '<button type="button" class="remove-msg-btn" onclick="removeMsg(' + i + ')" style="border:none;background:none;color:#ef4444;font-size:.8rem;font-weight:700;cursor:pointer;display:none;">✕ Retirer</button>' +
        '</div>' +
        '<div class="modal-field"><label class="field-label">Objet</label>' +
          '<input type="text" class="msg-subj" name="msg_subject_' + i + '" maxlength="200" placeholder="Objet de cet email"></div>' +
        '<div class="modal-field"><label class="field-label">Message</label>' +
          '<textarea class="msg-body" name="msg_body_' + i + '" rows="4" maxlength="5000" placeholder="Votre message…"></textarea></div>' +
        '<div style="display:flex;gap:10px;">' +
          '<div class="modal-field" style="flex:1;"><label class="field-label">Date</label>' +
            '<input type="date" class="msg-date" name="msg_date_' + i + '" min="' + min + '" value="' + def + '"></div>' +
          '<div class="modal-field" style="flex:0 0 116px;"><label class="field-label">Heure (UTC)</label>' +
            '<input type="time" class="msg-time" name="msg_time_' + i + '" value="07:00"></div>' +
        '</div>';
      document.getElementById('messages-container').appendChild(div);
      msgCount++;
      _syncMsgUI();
    }

    function removeMsg(i) {
      const b = document.getElementById('msg-block-' + i);
      if (b) b.remove();
      // Re-index
      const blocks = [...document.querySelectorAll('.msg-block')];
      msgCount = blocks.length;
      blocks.forEach((bl, ni) => {
        bl.id = 'msg-block-' + ni;
        bl.querySelector('.msg-num').textContent = 'Email ' + (ni+1);
        bl.querySelector('.remove-msg-btn').setAttribute('onclick', 'removeMsg(' + ni + ')');
        bl.querySelector('.msg-subj').name = 'msg_subject_' + ni;
        bl.querySelector('.msg-body').name = 'msg_body_'    + ni;
        bl.querySelector('.msg-date').name = 'msg_date_'    + ni;
        bl.querySelector('.msg-time').name = 'msg_time_'    + ni;
      });
      _syncMsgUI();
    }

    function _syncMsgUI() {
      const blocks = document.querySelectorAll('.msg-block');
      blocks.forEach(b => { b.querySelector('.remove-msg-btn').style.display = blocks.length > 1 ? 'inline' : 'none'; });
      const addBtn = document.getElementById('add-msg-btn');
      if (addBtn) addBtn.style.display = msgCount >= 10 ? 'none' : 'block';
    }

    // ── Add lead modal ─────────────────────────────────────────────────────────
    function openAddLead(e) {
      e.preventDefault();
      document.getElementById('add-lead-modal').classList.add('open');
    }
    function closeAddLead() {
      document.getElementById('add-lead-modal').classList.remove('open');
    }
    function openEditLead(btn) {
      document.getElementById('edit-original-email').value = btn.dataset.email;
      document.getElementById('edit-prenom').value = btn.dataset.prenom;
      document.getElementById('edit-nom').value    = btn.dataset.nom;
      document.getElementById('edit-email').value  = btn.dataset.email;
      document.getElementById('edit-tel').value    = btn.dataset.tel;
      document.getElementById('edit-lead-modal').classList.add('open');
    }
    function closeEditLead() {
      document.getElementById('edit-lead-modal').classList.remove('open');
    }
    function confirmDeleteLead() {
      const email = document.getElementById('edit-original-email').value;
      const prenom = document.getElementById('edit-prenom').value;
      const nom    = document.getElementById('edit-nom').value;
      if (!confirm('Supprimer définitivement ' + prenom + ' ' + nom + ' (' + email + ') de la liste ?')) return;
      document.getElementById('delete-lead-email').value = email;
      document.getElementById('delete-lead-form').submit();
    }
    document.getElementById('edit-lead-modal').addEventListener('click', function(e) {
      if (e.target === this) closeEditLead();
    });
    document.getElementById('add-lead-modal').addEventListener('click', function(e) {
      if (e.target === this) closeAddLead();
    });
    document.getElementById('compose-modal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
