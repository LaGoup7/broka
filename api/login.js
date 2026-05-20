import { createHmac, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';

function signToken(username, secret) {
  const ts = Date.now();
  const payload = `${username}.${ts}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function checkCredentials(username, password) {
  const users = {
    'olivier': (process.env.ADMIN_PASS_OLIVIER ?? '').trim(),
    'remi':    (process.env.ADMIN_PASS_REMI    ?? '').trim(),
  };
  const expected = users[String(username ?? '').toLowerCase().trim()] ?? '';
  if (!expected) return false;
  const secret = process.env.ADMIN_KEY ?? '';
  const a = createHmac('sha256', secret).update(String(password ?? '')).digest();
  const b = createHmac('sha256', secret).update(expected).digest();
  return timingSafeEqual(a, b);
}

function getIP(req) {
  return (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
}

// Max 10 tentatives par IP sur 15 minutes
async function isLoginBlocked(ip) {
  try {
    const kv    = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const key   = `rl:login:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, 900);
    return count > 10;
  } catch { return false; }
}

async function clearLoginBlock(ip) {
  try {
    const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    await kv.del(`rl:login:${ip}`);
  } catch {}
}

function loginPage(error = false, blocked = false) {
  const msg = blocked
    ? 'Trop de tentatives. Réessayez dans 15 minutes.'
    : 'Identifiant ou mot de passe incorrect';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BroKa — Connexion</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;overflow:hidden}
    body{font-family:system-ui,sans-serif;background:#112015;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#fff;border-radius:20px;overflow:hidden;width:100%;max-width:380px;margin:16px;box-shadow:0 20px 60px rgba(0,0,0,.4);}
    .top{background:#112015;padding:36px 32px 28px;text-align:center;border-bottom:3px solid;}
    .top{border-image:linear-gradient(90deg,#8B5E3C,#C9973A,#8B5E3C) 1;}
    .top p{color:rgba(255,255,255,.4);font-size:.65rem;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;}
    .top h1{color:#fff;font-size:2rem;font-weight:400;font-style:italic;letter-spacing:3px;}
    .form{padding:28px 32px 32px;}
    .field{margin-bottom:18px;}
    .field label{display:block;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#A67C30;margin-bottom:7px;}
    .field input{width:100%;padding:11px 14px;border:1.5px solid #d2c9b5;border-radius:10px;font-size:.95rem;font-family:inherit;transition:border-color .2s;}
    .field input:focus{outline:none;border-color:#1C3D22;}
    .error{background:#fff5f5;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:.82rem;margin-bottom:18px;text-align:center;}
    .btn{width:100%;padding:13px;background:#112015;color:#fff;border:none;border-radius:10px;font-size:.9rem;font-weight:700;letter-spacing:.08em;cursor:pointer;transition:background .2s;}
    .btn:hover{background:#1C3D22;}
    .btn:disabled{opacity:.5;cursor:not-allowed;}
    .footer{text-align:center;padding:0 0 16px;font-size:.72rem;color:#bbb;}
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <p>Ferme Goyhenetxea</p>
      <h1>BroKa</h1>
    </div>
    <form class="form" method="POST" action="/api/login">
      ${(error || blocked) ? `<div class="error">${msg}</div>` : ''}
      <div class="field">
        <label>Identifiant</label>
        <input type="text" name="username" autocomplete="username" autofocus required ${blocked ? 'disabled' : ''}>
      </div>
      <div class="field">
        <label>Mot de passe</label>
        <input type="password" name="password" autocomplete="current-password" required ${blocked ? 'disabled' : ''}>
      </div>
      <button class="btn" type="submit" ${blocked ? 'disabled' : ''}>Se connecter →</button>
    </form>
    <div class="footer">Admin · Ferme Goyhenetxea</div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  const adminKey = process.env.ADMIN_KEY ?? '';

  if (req.method === 'GET' && req.query.logout === '1') {
    res.setHeader('Set-Cookie', 'bk_session=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0');
    return res.redirect(302, '/api/login');
  }

  if (req.method === 'POST') {
    const ip      = getIP(req);
    const blocked = await isLoginBlocked(ip);
    if (blocked) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(429).send(loginPage(false, true));
    }

    const { username, password } = req.body ?? {};
    if (checkCredentials(username, password)) {
      await clearLoginBlock(ip);
      const token = signToken(String(username).toLowerCase().trim(), adminKey);
      res.setHeader('Set-Cookie', `bk_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=2592000`);
      return res.redirect(302, '/api/orders');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(loginPage(true, false));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(loginPage(false, false));
}
