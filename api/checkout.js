import Stripe from 'stripe';

// ── Produits individuels + Packs ──
// Les packs sont des sélections pratiques. Prix = somme des produits arrondie. Aucune remise affichée.
const PRODUCTS = {
  // Produits individuels
  vinaigre_500:        { name: 'Vinaigre de cidre BIO BroKa — 500 ml',           description: 'Sagar Ozpina · Artisanal, fermenté lentement · Certifié Agriculture Biologique FR-BIO-10',                           amount:  1700 },
  vinaigre_vrac_1_5l:  { name: 'Vinaigre de cidre BIO BroKa — Vrac 1,5 L',       description: 'Sac push-up refermable · 26 €/L · Non filtré, fermenté lentement · Certifié Agriculture Biologique FR-BIO-10',          amount:  3900 },
  vinaigre_vrac_3l:    { name: 'Vinaigre de cidre BIO BroKa — Vrac 3 L',         description: 'Sac push-up refermable · 23 €/L · Idéal familles et recharge · Certifié Agriculture Biologique FR-BIO-10',               amount:  6900 },
  xipister:             { name: 'Xipister — Sauce plancha 500 ml BroKa',           description: 'Sauce basque artisanale — Vinaigre Sagar Ozpina, huile bio, herbes et piment · Certifié Agriculture Biologique FR-BIO-10', amount:  1900 },
  poudre_guindillas:    { name: 'Poudre de Guindillas BroKa — 40 g',              description: "Piment d'Ibarra · Pays Basque Sud · Fruité et légèrement piquant · Certifié Agriculture Biologique FR-BIO-10",           amount:  1390 },
  noisettes_250g:       { name: 'Noisettes BIO — coques BroKa — 250 g',            description: 'Récoltées à la main dans notre verger basque · Certifiées Agriculture Biologique FR-BIO-10 · Non décortiquées',          amount:   490 },
  noisettes_500g:       { name: 'Noisettes BIO — coques BroKa — 500 g',            description: 'Récoltées à la main dans notre verger basque · Certifiées Agriculture Biologique FR-BIO-10 · Non décortiquées',          amount:   890 },
  // Packs (sélections pratiques — prix = somme des produits arrondie, sans remise)
  duo_recharge_1_5l:    { name: 'Le Quotidien BroKa',                              description: 'Vinaigre de cidre BIO 500 ml + Vinaigre de cidre BIO vrac 1,5 L · Certifiés Agriculture Biologique FR-BIO-10',          amount:  5600 },
  pack_famille:         { name: 'La Réserve BroKa',                                description: 'Vinaigre de cidre BIO 500 ml + Vinaigre de cidre BIO vrac 3 L · Certifiés Agriculture Biologique FR-BIO-10',            amount:  8600 },
  pack_prestige:        { name: 'Le Coffret BroKa',                                description: 'Vinaigre de cidre BIO 500 ml + Xipister 500 ml + Poudre de Guindillas 40 g + Noisettes BIO 500 g · Certifiés FR-BIO-10', amount: 5880 },
};

// Poids emballé (kg) — pesés réels + marge ~10%
// TODO : peser chaque article réellement emballé avant de modifier ces valeurs
const WEIGHTS = {
  // Produits individuels
  vinaigre_500:        0.90,  // 800 g réel
  vinaigre_vrac_1_5l:  1.60,  // 1 500 g réel
  vinaigre_vrac_3l:    3.65,  // 3 300 g réel
  xipister:             0.95,  // 870 g réel
  poudre_guindillas:    0.10,  // 40 g + pot + emballage
  noisettes_250g:       0.30,  // 250 g + emballage
  noisettes_500g:       0.65,  // 500 g + emballage (estimé — à peser)
  // Packs
  duo_recharge_1_5l:    2.50,  // vinaigre(0.90) + vrac 1,5L(1.60)
  // ATTENTION : pack_famille à peser réellement emballé — si > 4 kg → tranche lourde (participation livraison obligatoire)
  pack_famille:         4.65,  // vinaigre(0.90) + vrac 3L(3.65) — déjà > 4 kg emballé
  pack_prestige:        2.70,  // vinaigre(0.90) + xipister(0.95) + guindillas(0.10) + noisettes 500g(0.65) + emballage cadeau
};

// ── Règles produits complémentaires ──
const COMPLEMENT_KEYS = ['poudre_guindillas', 'noisettes_250g', 'noisettes_500g'];
const COMPLEMENT_MIN_CENTS = 3900;  // 39 €
const GUINDILLAS_MAX_QTY   = 3;

// ── Grille Point Relais / Locker — par tranche de poids (centimes) ──
// Livraison offerte à partir de 170 € d'achat, uniquement en Mondial Relay
function relayRate(subtotalCents, weightKg) {
  if (subtotalCents >= 17000) return 0;
  if (weightKg <= 1)  return  450;
  if (weightKg <= 2)  return  830;
  if (weightKg <= 3)  return 1050;
  if (weightKg <= 4)  return 1170;
  return 1850; // 5–10 kg
}

// ── Grille Domicile — par tranche de poids (centimes) ──
// Jamais de livraison offerte à domicile
function homeRate(subtotalCents, weightKg) {
  if (weightKg <= 1)  return  950;
  if (weightKg <= 2)  return 1300;
  if (weightKg <= 3)  return 1900;
  if (weightKg <= 4)  return 2100;
  if (weightKg <= 5)  return 2130;
  if (weightKg <= 6)  return 2500;
  if (weightKg <= 7)  return 2990;
  return 3000; // 8–10 kg
}

// ── Coût réel Mondial Relay (usage interne — calcul de marge, jamais affiché au client) ──
// Source : grille tarifaire Mondial Relay communiquée — 5 kg et plus : tarif unique 18,50 €
function getMondialRelayEstimatedCost(weightKg) {
  if (weightKg <= 1)  return  4.50;
  if (weightKg <= 2)  return  8.30;
  if (weightKg <= 3)  return 10.50;
  if (weightKg <= 4)  return 11.70;
  return 18.50; // 5 kg et plus
}

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

  const oversized = totalWeight > 4;

  // ── Validation règles produits complémentaires (côté serveur) ──
  // Limite Guindillas : max 3 pots par commande
  const guindillasItem = items.find(({ key }) => key === 'poudre_guindillas');
  if (guindillasItem) {
    const safeGuindillasQty = Math.round(Number(guindillasItem.qty));
    if (safeGuindillasQty > GUINDILLAS_MAX_QTY) {
      return res.status(400).json({ error: 'Maximum 3 pots de Poudre de Guindillas par commande.' });
    }
  }
  // Panier minimum 39 € pour Guindillas et Noisettes
  const hasComplement = items.some(({ key }) => COMPLEMENT_KEYS.includes(key));
  if (hasComplement && subtotalCents < COMPLEMENT_MIN_CENTS) {
    return res.status(400).json({
      error: 'Un achat minimum de 39 € est requis pour les produits complémentaires (Poudre de Guindillas, Noisettes BIO).',
    });
  }

  // ── Calcul frais de port ──
  let shippingCents;
  let shippingName;
  if (deliveryMethod === 'relay') {
    shippingCents = relayRate(subtotalCents, totalWeight);  // grille progressive
    shippingName  = 'Point Relais® / Locker — Mondial Relay';
  } else {
    shippingCents = homeRate(subtotalCents, totalWeight);  // grille progressive
    shippingName  = 'Livraison à domicile — Colissimo';
  }

  // Coût transport estimé (interne) — pour analyse de marge dans le dashboard Stripe
  const shippingCostEstimate = deliveryMethod === 'relay'
    ? getMondialRelayEstimatedCost(totalWeight)
    : null; // Colissimo : tarifs variables, pas estimé automatiquement

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
        total_weight_kg:       totalWeight.toFixed(2),
        oversized:             oversized ? 'true' : 'false',
        delivery_method:       deliveryMethod,
        relay_point:           relayPoint || '',
        home_address:          homeAddress
          ? [homeAddress.name, homeAddress.street, homeAddress.postal + ' ' + homeAddress.city].filter(Boolean).join(', ')
          : '',
        customer_phone:        String(phone ?? '').trim(),
        customer_email:        String(email ?? '').trim(),
        // Données internes — analyse de marge (jamais affichées au client)
        shipping_charged_cts:  String(shippingCents),
        shipping_cost_est_cts: shippingCostEstimate !== null ? String(Math.round(shippingCostEstimate * 100)) : 'n/a',
        margin_shipping_cts:   shippingCostEstimate !== null ? String(shippingCents - Math.round(shippingCostEstimate * 100)) : 'n/a',
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
