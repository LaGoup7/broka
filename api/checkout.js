import Stripe from 'stripe';

const PRODUCTS = {
  vinaigre_500:        { name: 'Vinaigre de cidre BIO BroKa — 500ml',      description: 'Sagar Ozpina · Artisanal, fermenté lentement · Pays Basque',           amount:  1700 },
  vinaigre_vrac_1_5l: { name: 'Vinaigre de cidre BIO BroKa — Vrac 1,5L', description: 'Sac push-up refermable · 26 €/L · Non filtré, fermenté lentement',       amount:  3900 },
  vinaigre_vrac_3l:   { name: 'Vinaigre de cidre BIO BroKa — Vrac 3L',   description: 'Sac push-up refermable · 23 €/L · Idéal familles et restauration',       amount:  6900 },
  vinaigre_vrac_5l:   { name: 'Vinaigre de cidre BIO BroKa — Vrac 5L',   description: 'Sac push-up refermable · 20 €/L · Grand format restauration/recharge',   amount: 10000 },
  xipister:            { name: 'Xipister Xü-Beroa — Sauce plancha 500ml',  description: 'Sauce pimentée bio artisanale du Pays Basque',                           amount:  1900 },
  pack_cuisine_basque: { name: 'Pack Cuisine Basque BroKa',                description: 'Vinaigre 500ml + Xipister 500ml + Guindillas 40g + Guide offert · Éco. 5€', amount: 4100 },
  pack_prestige:       { name: 'Pack Prestige BroKa',                      description: 'Vinaigre 500ml + Xipister 500ml + Guindillas + Noisettes 500g · Éco. 6€', amount: 4500 },
  pack_famille:        { name: 'Pack Recharge Famille BroKa',              description: 'Vinaigre 500ml + Vrac 3L · Économisez 7€',                               amount:  7900 },
  noisettes_250g:      { name: 'Noisettes BIO à Coque BroKa — 250g',      description: 'Récoltées à la main · Certifiées BIO · 10€/kg',                          amount:   250 },
  poudre_guindillas:   { name: 'Poudre de Guindillas BroKa — 40g',        description: "Piment d'Ibarra · Pays Basque Sud · Fruité et légèrement piquant",        amount:  1000 },
};

// Poids emballé (kg) — pesés réels + marge ~10%
const WEIGHTS = {
  vinaigre_500:        0.90,  // 800g réel
  vinaigre_vrac_1_5l: 1.60,  // 1500g réel
  vinaigre_vrac_3l:   3.65,  // 3300g réel
  vinaigre_vrac_5l:   5.80,  // estimé
  xipister:            0.95,  // 870g réel
  pack_cuisine_basque: 2.10,  // vinaigre(0.90) + xipister(0.95) + guindillas(0.10) + guide
  pack_prestige:       2.70,  // vinaigre(0.90) + xipister(0.95) + guindillas(0.10) + noisettes 500g(0.55)
  pack_famille:        4.65,  // vinaigre(0.90) + vrac 3L(3.65) — oversized probable
  noisettes_250g:      0.30,  // 262g réel (500g pèse 525g)
  poudre_guindillas:   0.10,  // 50g réel
};

// Grille Point Relais (centimes)
function relayRate(kg) {
  if (kg <= 2) return  800;
  if (kg <= 3) return 1050;
  return 1100;
}

// Grille Domicile (centimes)
function homeRate(kg) {
  if (kg <= 2) return 1300;
  if (kg <= 3) return 1900;
  return 2000;
}

const FRANCO_RELAY_CENTS = 7500;  // 75 €
const FRANCO_HOME_CENTS  = 12500; // 125 €
const LAUNCH_MIN_CENTS   = 5000;  // 50 €

export default async function handler(req, res) {
  const ALLOWED = ['https://ferme-broka.fr', 'https://www.ferme-broka.fr'];
  const origin  = req.headers.origin ?? '';
  if (ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { items, deliveryMethod, relayPoint, homeAddress, email, phone } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Panier vide' });
  }
  if (!['relay', 'home'].includes(deliveryMethod)) {
    return res.status(400).json({ error: 'Mode de livraison manquant' });
  }

  const lineItems = [];
  let subtotalCents = 0;
  let totalWeight   = 0;

  for (const { key, qty } of items) {
    const p       = PRODUCTS[key];
    const safeQty = Math.round(Number(qty));
    if (!p || !safeQty || safeQty < 1) {
      return res.status(400).json({ error: `Produit inconnu: ${key}` });
    }
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: p.name, description: p.description },
        unit_amount: p.amount,
      },
      quantity: safeQty,
    });
    subtotalCents += p.amount * safeQty;
    totalWeight   += (WEIGHTS[key] ?? 0.5) * safeQty;
  }

  const oversized       = totalWeight > 4;
  const launchEnabled   = process.env.LAUNCH_FREE_SHIPPING === 'true';
  const isFrancoRelay   = subtotalCents >= FRANCO_RELAY_CENTS;
  const isFrancoHome    = subtotalCents >= FRANCO_HOME_CENTS;
  const isLaunchFreeRelay = launchEnabled && subtotalCents >= LAUNCH_MIN_CENTS;

  let shippingCents;
  let shippingName;
  if (deliveryMethod === 'relay') {
    shippingCents = (isLaunchFreeRelay || isFrancoRelay) ? 0 : relayRate(totalWeight);
    shippingName  = 'Point Relais® / Locker — Mondial Relay';
  } else {
    shippingCents = isFrancoHome ? 0 : homeRate(totalWeight);
    shippingName  = 'Livraison à domicile — Colissimo';
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const base   = 'https://ferme-broka.fr';

  try {
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      billing_address_collection: 'required',
      invoice_creation: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: shippingCents, currency: 'eur' },
            display_name: shippingName,
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
      ],
      metadata: {
        total_weight_kg:      totalWeight.toFixed(2),
        oversized:            oversized ? 'true' : 'false',
        delivery_method:      deliveryMethod,
        relay_point:          relayPoint || '',
        home_address:         homeAddress
          ? [homeAddress.name, homeAddress.street, homeAddress.postal + ' ' + homeAddress.city].filter(Boolean).join(', ')
          : '',
        launch_free_shipping: isLaunchFreeRelay ? 'true' : 'false',
        customer_phone:       String(phone ?? '').trim(),
        customer_email:       String(email ?? '').trim(),
      },
      success_url: `${base}/?paiement=ok`,
      cancel_url:  `${base}/`,
      locale: 'fr',
    };
    if (email) sessionParams.customer_email = String(email).trim();
    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
