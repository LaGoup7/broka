/* ═══════════════════════════════════════════════════════════════
   BroKa V2 — Cart & Checkout
   ═══════════════════════════════════════════════════════════════ */

const PRODUCT_IMAGES = {
  vinaigre_500:        '/images/broka_bouteille_pommes.jpg',
  vinaigre_vrac_1_5l:  '/images/vinaigre_refill_3L_seul.jpg',
  vinaigre_vrac_3l:    '/images/vinaigre_cidre_3L.png',
  xipister:            '/images/broka_bouteille_verger.png',
  poudre_guindillas:   '/images/poudre_de_guindillas.png',
  noisettes_250g:      '/images/noisettes.png',
  noisettes_500g:      '/images/noisettes.png',
  duo_decouverte:      '/images/Duo_D%C3%A9couverte_BroKa.png',
  pack_cuisine_basque: '/images/pack_cuisine_basque.png',
  pack_recharge_3l:    '/images/Pack_Recharge_3L_optimis%C3%A9.png',
  duo_recharge_1_5l:   '/images/Duo_Recharge_1%2C5%20L_bouteille_500ml.png',
  pack_famille:        '/images/Pack_famille_vinaigre.png',
  pack_prestige:       '/images/pack_prestige.png',
};

const CATALOG = {
  vinaigre_500:         { name: 'Vinaigre de cidre BIO 500 ml',           price: 17,    weight: 0.90 },
  vinaigre_vrac_1_5l:   { name: 'Vinaigre de cidre BIO vrac 1,5 L',       price: 43.50, weight: 1.60 },
  vinaigre_vrac_3l:     { name: 'Vinaigre de cidre BIO vrac 3 L',          price: 78,    weight: 3.65 },
  xipister:             { name: 'Xipister — Sauce plancha 500 ml',         price: 19,    weight: 0.95 },
  poudre_guindillas:    { name: 'Poudre de Guindillas 40 g',               price: 13.90, weight: 0.10 },
  noisettes_250g:       { name: 'Noisettes BIO coques 250 g',              price: 4.90,  weight: 0.30 },
  noisettes_500g:       { name: 'Noisettes BIO coques 500 g',              price: 8.90,  weight: 0.65 },
  duo_decouverte:       { name: 'Duo Découverte BroKa',                    price: 36,    weight: 1.85 },
  pack_cuisine_basque:  { name: 'Pack Cuisine Basque',                     price: 50,    weight: 2.10 },
  pack_recharge_3l:     { name: 'Pack Recharge 3 L optimisé',              price: 91.90, weight: 3.75 },
  duo_recharge_1_5l:    { name: 'Duo Recharge 1,5 L + bouteille 500 ml',   price: 60.50, weight: 2.50 },
  pack_famille:         { name: 'Pack Recharge Famille BroKa',             price: 95,    weight: 4.65 },
  pack_prestige:        { name: 'Pack Prestige BroKa',                     price: 59,    weight: 2.70 },
};

const COMPLEMENT_KEYS = ['poudre_guindillas', 'noisettes_250g', 'noisettes_500g'];
const COMPLEMENT_MIN  = 39;
const GUINDILLAS_MAX  = 3;

/* ── State ── */
let cart = JSON.parse(localStorage.getItem('broka_cart') || '[]')
  .filter(i => CATALOG[i.key]);

let _cartRelay = 0;
let _cartHome  = 0;
let _selectedDelivery   = null;
let _selectedRelayPoint = null;

/* ── Shipping grids ── */
function relayShipping(total, weight) {
  let r;
  if      (total < 29) r = 7.90;
  else if (total < 49) r = 6.90;
  else if (total < 79) r = 4.90;
  else if (total < 99) r = 3.90;
  else                  r = 0;
  if (weight > 4 && r < 5.90) r = 5.90;
  return r;
}
function homeShipping(total, weight) {
  let r;
  if      (total < 49)  r = 11.90;
  else if (total < 79)  r = 9.90;
  else if (total < 129) r = 7.90;
  else if (total < 179) r = 4.90;
  else                   r = 0;
  if (weight > 4 && r < 7.90) r = 7.90;
  return r;
}

/* ── Cart actions ── */
function addToCart(key) {
  const prod = CATALOG[key];
  if (!prod) return;
  if (COMPLEMENT_KEYS.includes(key)) {
    const subtotalAfter = cart.reduce((s,i) => s + CATALOG[i.key].price * i.qty, 0) + prod.price;
    if (subtotalAfter < COMPLEMENT_MIN) {
      showToast('⚠️ ' + prod.name + ' est disponible à partir de 39 € de commande.', 5500);
      return;
    }
  }
  if (key === 'poudre_guindillas') {
    const ex = cart.find(i => i.key === 'poudre_guindillas');
    if (ex && ex.qty >= GUINDILLAS_MAX) {
      showToast('⚠️ Maximum ' + GUINDILLAS_MAX + ' pots par commande.', 4500);
      return;
    }
  }
  const existing = cart.find(i => i.key === key);
  if (existing) existing.qty++;
  else cart.push({ key, qty: 1 });
  saveCart(); renderCart();
  showToast('✓ ' + prod.name + ' ajouté');
  updateCartBtn();
  openCart();
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart(); renderCart(); updateCartBtn();
}

function changeQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  if (key === 'poudre_guindillas' && delta > 0 && item.qty >= GUINDILLAS_MAX) {
    showToast('⚠️ Maximum ' + GUINDILLAS_MAX + ' pots par commande.', 4500);
    return;
  }
  item.qty = Number(item.qty) + delta;
  if (item.qty <= 0) cart = cart.filter(i => i.key !== key);
  saveCart(); renderCart(); updateCartBtn();
}

function saveCart() { localStorage.setItem('broka_cart', JSON.stringify(cart)); }

function updateCartBtn() {
  const cta = document.getElementById('cart-cta');
  if (cta) cta.style.display = cart.length > 0 ? 'block' : 'none';
}

/* ── Render cart ── */
function renderCart() {
  const totalQty = cart.reduce((s,i) => s + Number(i.qty), 0);
  const subtotal = Math.round(cart.reduce((s,i) => s + CATALOG[i.key].price * Number(i.qty), 0) * 100) / 100;
  const weight   = cart.reduce((s,i) => s + (CATALOG[i.key].weight ?? 0.5) * Number(i.qty), 0);
  const relay    = relayShipping(subtotal, weight);
  const home     = homeShipping(subtotal, weight);
  _cartRelay = relay; _cartHome = home;

  const hasComplement    = cart.some(i => COMPLEMENT_KEYS.includes(i.key));
  const complementWarn   = hasComplement && subtotal < COMPLEMENT_MIN;
  const badge = document.getElementById('cart-badge');
  if (badge) { badge.textContent = totalQty; badge.classList.toggle('visible', totalQty > 0); }

  const emptyEl = document.getElementById('cart-empty');
  const itemsEl = document.getElementById('cart-items');
  const footEl  = document.getElementById('cart-foot');
  if (emptyEl) emptyEl.style.display = cart.length === 0 ? 'block' : 'none';
  if (footEl)  footEl.style.display  = cart.length > 0   ? 'block' : 'none';

  const fmt = n => n % 1 === 0 ? n + ',00 €' : n.toFixed(2).replace('.',',') + ' €';

  if (itemsEl) {
    itemsEl.innerHTML = cart.map(item => {
      const p = CATALOG[item.key];
      return `<div class="cart-item">
        <div class="cart-item-info">
          <span class="cart-item-name">${p.name}</span>
          <span class="cart-item-unit">${fmt(p.price)} / unité</span>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${item.key}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.key}',1)">+</button>
        </div>
        <span class="cart-item-price">${fmt(p.price * item.qty)}</span>
        <button class="cart-item-del" onclick="removeFromCart('${item.key}')" title="Supprimer">✕</button>
      </div>`;
    }).join('');
  }

  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl    = document.getElementById('cart-total');
  const relayEl    = document.getElementById('cart-relay');
  const homeNoteEl = document.getElementById('cart-home-note');
  const francoEl   = document.getElementById('cart-franco-note');

  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  if (totalEl)    totalEl.textContent    = cart.length > 0 ? fmt(subtotal + relay) : '0 €';

  if (relayEl) {
    if (cart.length === 0) relayEl.innerHTML = '—';
    else if (relay === 0)  relayEl.innerHTML = '<span style="color:#4ADE80;font-weight:700">Offert !</span>';
    else relayEl.textContent = fmt(relay);
  }
  if (homeNoteEl) {
    if (cart.length === 0) homeNoteEl.textContent = '';
    else if (home === 0)   homeNoteEl.innerHTML = 'Domicile : <span style="color:#4ADE80;font-weight:700">offert également</span>';
    else homeNoteEl.textContent = `Domicile : ${fmt(home)} — offert dès 179 €`;
  }
  if (francoEl) {
    if (cart.length === 0) francoEl.textContent = '';
    else if (complementWarn) francoEl.innerHTML = '<span style="color:#f59e0b;font-weight:700">⚠️ Ajoutez des produits principaux pour valider votre commande (min. 39 €).</span>';
    else if (subtotal >= 99 && weight <= 4) francoEl.innerHTML = '<span style="color:#4ADE80;font-weight:700">✓ Livraison offerte en Point Relais !</span>';
    else if (subtotal >= 99 && weight > 4) francoEl.innerHTML = '<span style="color:#C9A45A;font-weight:700">Colis lourd — participation maintenue (5,90 €).</span>';
    else francoEl.textContent = `Plus que ${fmt(99 - subtotal)} pour la livraison offerte en Point Relais.`;
  }

  renderUpsell(subtotal, weight);
}

function renderUpsell(subtotal, weight) {
  const el = document.getElementById('cart-upsell');
  if (!el) return;
  const remaining = Math.round((99 - subtotal) * 100) / 100;
  if (cart.length === 0 || remaining <= 0 || remaining > 70 || weight > 4) { el.innerHTML = ''; return; }
  const inCart = new Set(cart.map(i => i.key));
  const candidates = Object.entries(CATALOG)
    .filter(([key, p]) => {
      if (inCart.has(key)) return false;
      if (weight + p.weight > 4) return false;
      if (COMPLEMENT_KEYS.includes(key) && subtotal < COMPLEMENT_MIN) return false;
      if (key === 'poudre_guindillas') { const ex = cart.find(i => i.key === key); if (ex && ex.qty >= GUINDILLAS_MAX) return false; }
      return true;
    })
    .map(([key, p]) => ({ key, ...p }))
    .sort((a,b) => {
      const aF = a.price >= remaining, bF = b.price >= remaining;
      if (aF && !bF) return -1; if (!aF && bF) return 1;
      if (aF && bF) return a.price - b.price;
      return b.price - a.price;
    }).slice(0, 3);
  if (!candidates.length) { el.innerHTML = ''; return; }
  const fmtP  = n => n % 1 === 0 ? n + ' €' : n.toFixed(2).replace('.',',') + ' €';
  el.innerHTML = `
    <div class="upsell-head">🎯 Plus que <strong>${fmtP(remaining)}</strong> pour la livraison offerte</div>
    <div class="upsell-cards">
      ${candidates.map(p => `
        <div class="upsell-card">
          <img class="upsell-img" src="${PRODUCT_IMAGES[p.key]||''}" alt="${p.name}" onerror="this.style.display='none'">
          <div class="upsell-name">${p.name}</div>
          <div class="upsell-footer">
            <span class="upsell-price">${fmtP(p.price)}</span>
            <button class="upsell-add" onclick="addToCart('${p.key}')" title="Ajouter">+</button>
          </div>
        </div>`).join('')}
    </div>`;
}

/* ── Cart open/close ── */
function openCart() {
  document.getElementById('cart-drawer')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Checkout ── */
function checkoutCart() {
  if (!cart.length) return;
  const fmt = n => n === 0
    ? '<span style="color:#4ADE80;font-weight:700">Offert !</span>'
    : n.toFixed(2).replace('.',',') + ' €';
  const relayEl = document.getElementById('dlv-relay-price');
  const homeEl  = document.getElementById('dlv-home-price');
  if (relayEl) relayEl.innerHTML = fmt(_cartRelay);
  if (homeEl)  homeEl.innerHTML  = fmt(_cartHome);
  // Reset
  _selectedDelivery = null; _selectedRelayPoint = null;
  ['dlv-opt-relay','dlv-opt-home'].forEach(id => document.getElementById(id)?.classList.remove('selected'));
  const relaySection = document.getElementById('dlv-relay-section');
  const homeSection  = document.getElementById('dlv-home-section');
  const modal        = document.getElementById('dlv-modal');
  if (relaySection) relaySection.style.display = 'none';
  if (homeSection)  homeSection.style.display  = 'none';
  if (modal)        modal.classList.remove('dlv-modal--wide');
  ['dlv-cp-input','mr-manual-input','home-name','home-street','home-postal','home-city','dlv-email','dlv-phone']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cpHint = document.getElementById('mr-cp-hint');
  if (cpHint) cpHint.textContent = 'Entrez votre code postal';
  const mrSteps = document.getElementById('mr-steps');
  if (mrSteps) mrSteps.style.display = 'none';
  const confirmBtn = document.getElementById('dlv-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;
  document.getElementById('dlv-overlay')?.classList.add('open');
  modal?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDeliveryModal() {
  document.getElementById('dlv-overlay')?.classList.remove('open');
  document.getElementById('dlv-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

function selectDeliveryOption(method) {
  _selectedDelivery = method; _selectedRelayPoint = null;
  document.getElementById('dlv-opt-relay')?.classList.toggle('selected', method === 'relay');
  document.getElementById('dlv-opt-home')?.classList.toggle('selected',  method === 'home');
  const relaySection = document.getElementById('dlv-relay-section');
  const homeSection  = document.getElementById('dlv-home-section');
  const modal        = document.getElementById('dlv-modal');
  if (relaySection) relaySection.style.display = method === 'relay' ? 'block' : 'none';
  if (homeSection)  homeSection.style.display  = method === 'home'  ? 'block' : 'none';
  if (modal)        modal.classList.toggle('dlv-modal--wide', method === 'relay');
  updateDeliveryConfirmBtn();
}

function onRelayPostalInput(val) {
  _selectedRelayPoint = null;
  const hint  = document.getElementById('mr-cp-hint');
  const steps = document.getElementById('mr-steps');
  if (hint)  hint.textContent = val.length >= 4 ? '' : 'Entrez votre code postal';
  if (steps) steps.style.display = val.length >= 4 ? 'block' : 'none';
  if (val.length < 4) { const el = document.getElementById('mr-manual-input'); if (el) el.value = ''; }
  updateDeliveryConfirmBtn();
}
function onManualRelayInput() { updateDeliveryConfirmBtn(); }

function updateDeliveryConfirmBtn() {
  const btn = document.getElementById('dlv-confirm-btn');
  if (!btn || !_selectedDelivery) { if (btn) btn.disabled = true; return; }
  let addrOk = false;
  if (_selectedDelivery === 'relay') {
    addrOk = (document.getElementById('mr-manual-input')?.value.trim().length ?? 0) >= 3;
  } else {
    const street = document.getElementById('home-street')?.value.trim() || '';
    const postal = document.getElementById('home-postal')?.value.trim() || '';
    const city   = document.getElementById('home-city')?.value.trim() || '';
    addrOk = street.length >= 3 && postal.length >= 4 && city.length >= 2;
  }
  const email   = document.getElementById('dlv-email')?.value.trim() || '';
  const phone   = (document.getElementById('dlv-phone')?.value || '').replace(/\D/g,'');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const phoneOk = phone.length >= 9;
  btn.disabled  = !addrOk || !emailOk || !phoneOk;
}

async function confirmDelivery() {
  const btn = document.getElementById('dlv-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirection…'; }
  const email    = document.getElementById('dlv-email')?.value.trim() || '';
  const phone    = document.getElementById('dlv-phone')?.value.trim() || '';
  const relay    = document.getElementById('mr-manual-input')?.value.trim() || '';
  let homeAddress = null;
  if (_selectedDelivery === 'home') {
    homeAddress = {
      name:   document.getElementById('home-name')?.value.trim() || '',
      street: document.getElementById('home-street')?.value.trim() || '',
      postal: document.getElementById('home-postal')?.value.trim() || '',
      city:   document.getElementById('home-city')?.value.trim() || '',
    };
  }
  try {
    const res  = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart, deliveryMethod: _selectedDelivery, relayPoint: relay, homeAddress, email, phone }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; }
    else throw new Error(data.error || 'Erreur inconnue');
  } catch (err) {
    showToast('❌ ' + (err.message?.length < 80 ? err.message : 'Erreur, réessayez.'));
    if (btn) { btn.disabled = false; btn.textContent = 'Payer →'; }
    closeDeliveryModal();
  }
}

function formatTel(input) {
  const d = input.value.replace(/\D/g,'').slice(0,10);
  input.value = d.replace(/(\d{2})(?=\d)/g,'$1 ').trim();
}

/* ── Toast ── */
function showToast(msg, duration) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration || 3500);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  updateCartBtn();
});
