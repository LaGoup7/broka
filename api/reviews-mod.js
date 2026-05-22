import { Redis } from '@upstash/redis';

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function page(title, body, color = '#16a34a') {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — BroKa</title>
<style>
  body{font-family:Arial,sans-serif;background:#f0f4ec;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
  .card{background:#fff;border-radius:16px;padding:40px 36px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.12);}
  .icon{width:64px;height:64px;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;}
  h2{color:#112015;margin-bottom:12px;}
  p{color:#555;font-size:.9rem;line-height:1.6;margin-bottom:24px;}
  a{display:inline-block;background:#112015;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:.88rem;}
</style></head>
<body><div class="card">
  <div class="icon">${body.icon}</div>
  <h2>${title}</h2>
  <p>${body.text}</p>
  <a href="https://ferme-broka.fr">Voir le site →</a>
</div></body></html>`;
}

export default async function handler(req, res) {
  const { action, id, token } = req.query;

  // ── Vérification du token de sécurité ──
  const secret = process.env.REVIEWS_SECRET ?? '';
  if (!secret || !token || token !== secret) {
    return res.status(401).send(page('Non autorisé', { icon: '🔒', text: 'Lien invalide ou expiré.' }, '#dc2626'));
  }

  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).send(page('Paramètre manquant', { icon: '❓', text: 'Action ou identifiant manquant.' }, '#f59e0b'));
  }

  // ── Chercher l'avis dans la file d'attente ──
  const pending = await redis.lrange('broka:reviews:pending', 0, -1);
  const entry   = pending.find(r => {
    try { return (typeof r === 'string' ? JSON.parse(r) : r).id === id; }
    catch { return false; }
  });

  if (!entry) {
    return res.status(404).send(page('Introuvable', { icon: '🔍', text: 'Avis introuvable — peut-être déjà traité ?' }, '#f59e0b'));
  }

  // ── Supprimer de la file d'attente ──
  await redis.lrem('broka:reviews:pending', 1, entry);

  if (action === 'approve') {
    await redis.lpush('broka:reviews:approved', entry);
    return res.status(200).send(page(
      'Avis approuvé ✅',
      { icon: '✅', text: 'L\'avis est maintenant visible sur le site ferme-broka.fr.' },
      '#16a34a'
    ));
  }

  // action === 'reject'
  return res.status(200).send(page(
    'Avis rejeté 🗑️',
    { icon: '🗑️', text: 'L\'avis a été supprimé définitivement.' },
    '#dc2626'
  ));
}
