import Stripe from 'stripe';

const PRODUCTS = {
  vinaigre_500: {
    name: 'Vinaigre de cidre BroKa — 500ml',
    description: 'Bouteille 500ml · Artisanal, fermenté lentement · Pays Basque',
    amount: 1700,
    shipping: 300,
  },
  vinaigre_3l: {
    name: 'Vinaigre de cidre BroKa — Vrac 3L',
    description: 'Sac push-up 3L · Idéal familles et restauration',
    amount: 6600,
    shipping: 500,
  },
  xipister: {
    name: 'Xipister — Sauce plancha 500ml',
    description: 'Sauce pimentée artisanale du Pays Basque, bouteille 500ml',
    amount: 1900,
    shipping: 300,
  },
  pack_decouverte: {
    name: 'Pack Découverte BroKa',
    description: 'Vinaigre de cidre 500ml + Xipister 500ml + Guide PDF · Économisez 4€',
    amount: 3200,
    shipping: 300,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { product } = req.body ?? {};
  const item = PRODUCTS[product];
  if (!item) return res.status(400).json({ error: 'Produit inconnu' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const base = process.env.BASE_URL ?? 'https://yourqr.page';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: { name: item.name, description: item.description },
          unit_amount: item.amount,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'eur',
          product_data: { name: 'Frais de port' },
          unit_amount: item.shipping,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    shipping_address_collection: { allowed_countries: ['FR'] },
    success_url: `${base}/broka/?paiement=ok`,
    cancel_url: `${base}/broka/`,
    locale: 'fr',
  });

  return res.status(200).json({ url: session.url });
}
