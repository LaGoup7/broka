export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { prenom, nom, tel, email } = req.body ?? {};
  if (!prenom || !nom || !email) {
    return res.status(400).json({ ok: false, error: 'Champs manquants' });
  }

  const upstream = await fetch(process.env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prenom, nom, email, tel }),
    redirect: 'follow',
  });

  const data = await upstream.json();
  return res.status(upstream.ok ? 200 : 500).json(data);
}
