/* BroKa V2 — Logique marchés (alternance semaine paire/impaire) */
const MARCHES = [
  {
    nom:   'Marché Bio de Billère',
    city:  'Billère · 64140',
    addr:  '31 Route de Bayonne',
    hours: 'Sam. · 7h30–13h30',
  },
  {
    nom:   'Marché des Halles',
    city:  'Biarritz',
    addr:  'Place Sobradiel · 3–11 rue des Halles',
    hours: 'Samedi matin',
  },
];

// Référence fixe : samedi 30 mai 2026 → index 0 (Billère)
const REF_SAT_MS    = Date.UTC(2026, 4, 30);
const REF_SAT_INDEX = 0;

function saturdayIndexFor(satMs) {
  const weeks = Math.round((satMs - REF_SAT_MS) / (7 * 24 * 60 * 60 * 1000));
  return ((weeks % 2) + 2) % 2 === 0 ? REF_SAT_INDEX : 1 - REF_SAT_INDEX;
}

function thisSaturdayUTC() {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=dim, 6=sam
  const offset = dow === 0 ? -1 : (6 - dow);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset);
}

function fillMarcheCard(prefix, marche) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set(prefix + '-nom',   marche.nom);
  set(prefix + '-city',  marche.city);
  set(prefix + '-addr',  marche.addr);
  set(prefix + '-hours', marche.hours);
}

function initMarches() {
  const thisSat = thisSaturdayUTC();
  const nextSat = thisSat + 7 * 24 * 60 * 60 * 1000;

  const nowIdx  = saturdayIndexFor(thisSat);
  const nextIdx = saturdayIndexFor(nextSat);

  fillMarcheCard('marche-now',  MARCHES[nowIdx]);
  fillMarcheCard('marche-next', MARCHES[nextIdx]);

  // Badge hero
  const marketText = document.getElementById('market-text');
  if (marketText) {
    const m   = MARCHES[nowIdx];
    const sat = new Date(thisSat);
    const day = sat.getUTCDate();
    const mon = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][sat.getUTCMonth()];
    marketText.textContent = `${m.nom} — sam. ${day} ${mon} · ${m.hours}`;
  }
}

document.addEventListener('DOMContentLoaded', initMarches);
