import Stripe from 'stripe';

const PRODUCTS = {
  vinaigre_500:    { name: 'Vinaigre de cidre BroKa — 500ml',        description: 'Sagar Ozpina · Artisanal, fermenté lentement · Pays Basque', amount: 1700 },
  vinaigre_3l:     { name: 'Vinaigre de cidre BroKa — Vrac 3L',      description: 'Sac push-up 3L · Idéal familles et restauration',             amount: 6600 },
  xipister:        { name: 'Xipister Xü-Beroa — Sauce plancha 500ml', description: 'Sauce pimentée bio artisanale du Pays Basque',                amount: 1900 },
  pack_decouverte: { name: 'Pack Découverte BroKa',                   description: 'Vinaigre 500ml + Xipister 500ml + Guide PDF · Économisez 4€', amount: 3200 },
  pack_famille:    { name: 'Pack Recharge Famille BroKa',             description: 'Vinaigre 500ml + Vrac 3L · Économisez 4€',                    amount: 7900 },
  noisettes_250g:  { name: 'Noisettes BIO à Coque BroKa — 250g',     description: 'Récoltées à la main dans notre verger basque · Certifiées BIO · 10€/kg', amount: 250 },
};

function getShipping(items) {
  const hasHeavy = items.some(i => i.key === 'vinaigre_3l' || i.key === 'pack_famille');
  return hasHeavy ? 500 : 300;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Panier vide' });
  }

  const lineItems = [];
  for (const { key, qty } of items) {
    const p = PRODUCTS[key];
    if (!p || !qty || qty < 1) return res.status(400).json({ error: `Produit inconnu: ${key}` });
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: p.name, description: p.description },
        unit_amount: p.amount,
      },
      quantity: qty,
    });
  }

  lineItems.push({
    price_data: {
      currency: 'eur',
      product_data: { name: 'Frais de port' },
      unit_amount: getShipping(items),
    },
    quantity: 1,
  });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const base   = process.env.BASE_URL ?? 'https://yourqr.page';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    shipping_address_collection: { allowed_countries: ['FR'] },
    success_url: `${base}/broka/?paiement=ok`,
    cancel_url:  `${base}/broka/`,
    locale: 'fr',
  });

  return res.status(200).json({ url: session.url });
}
