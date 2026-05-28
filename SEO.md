# Plan SEO — ferme-broka.fr

> Document de suivi de la mise en place du référencement naturel.
> Statut global : 🟡 En cours

---

## Contexte

- **Site** : ferme-broka.fr — SPA statique (index.html), hébergé sur Vercel
- **Produits** : Vinaigre de cidre BIO Sagar Ozpina, Xipister, Poudre de Guindillas, Noisettes BIO
- **Localisation** : GAEC Goyhenetxea — Soule, Pays Basque français
- **Cible** : clients BIO en France, intérêt vinaigre de cidre artisanal, Pays Basque

---

## Mots-clés cibles

### Principaux
- `vinaigre de cidre BIO artisanal`
- `vinaigre de cidre Pays Basque`
- `Sagar Ozpina` (marque propre)
- `xipister sauce plancha`
- `vinaigre de cidre avec la mère`

### Secondaires
- `vinaigre de cidre vrac BIO`
- `ferme bio Pays Basque`
- `vinaigre artisanal Soule`
- `GAEC Goyhenetxea`
- `cure vinaigre de cidre`
- `poudre de guindillas BIO`

---

## Phases

---

### Phase 1 — Fondations techniques
> Priorité : 🔴 Haute — invisible sans ces éléments

- [x] **`<title>`** — "Vinaigre de cidre BIO artisanal | Sagar Ozpina — BroKa Pays Basque" (69 car.)
- [x] **`<meta name="description">`** — 157 caractères avec mot-clé principal
- [x] **`<html lang="fr">`** — attribut de langue présent
- [x] **Open Graph** (`og:title`, `og:description`, `og:image`, `og:url`, `og:image:height`) — complet
- [x] **Twitter Card** (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) — présent
- [x] **Canonical** (`<link rel="canonical" href="https://ferme-broka.fr/">`) — ajouté
- [x] **`robots.txt`** — créé à la racine avec directive Sitemap
- [x] **`sitemap.xml`** — créé à la racine (URL canonique, lastmod 2026-05-28)
- [x] **Favicon** — présent (logo_seul.png + apple-touch-icon)

---

### Phase 2 — Données structurées (JSON-LD)
> Priorité : 🔴 Haute — génère des rich snippets dans les résultats Google

- [x] **Organization** — nom, URL, logo, réseaux sociaux, coordonnées GAEC Goyhenetxea
- [x] **LocalBusiness** — adresse Soule, téléphone, horaires marchés Billère + Biarritz, areaServed France
- [x] **Product** × 5 — vinaigre 500ml (17 €), vrac 1,5L (39 €), vrac 3L (69 €), Xipister (19 €), Guindillas (13,90 €)
- [x] **FAQPage** — 7 questions/réponses de la section FAQ
- [x] **BreadcrumbList** — 4 nœuds : Accueil > Produits > Sagar Ozpina > FAQ

---

### Phase 3 — Sémantique HTML
> Priorité : 🟡 Moyenne — améliore la compréhension du contenu par les robots

- [x] Vérifier la hiérarchie H1 → H2 → H3 — un seul H1 : "Sagar Ozpina — vinaigre de cidre BIO de la ferme Goyhenetxea" ✓
- [x] Attributs `alt` enrichis sur 5 images produits clés (vinaigre 500ml, vrac 3L, Xipister, Coffret, Sagar Ozpina transparent)
- [x] Balises sémantiques : `<main>` ✓, `<footer>` ✓, `<nav aria-label="Nos produits">` ajouté dans footer
- [x] Textes des liens : tous descriptifs ("Voir nos produits →", "+ Ajouter au panier", etc.) — aucun "cliquez ici"

---

### Phase 4 — SEO local
> Priorité : 🟡 Moyenne — essentiel pour capter la clientèle régionale

- [ ] **Fiche Google Business Profile** — créer ou revendiquer la fiche GAEC Goyhenetxea
  - Nom, adresse, téléphone (NAP)
  - Horaires marchés (Billère + Biarritz)
  - Photos produits
  - Lien vers ferme-broka.fr
- [ ] **Cohérence NAP** — vérifier que Nom/Adresse/Téléphone sont identiques sur le site, Google, réseaux sociaux
- [ ] **Schéma LocalBusiness** avec coordonnées GPS et zones desservies

---

### Phase 5 — Performance & Core Web Vitals
> Priorité : 🟡 Moyenne — facteur de classement Google depuis 2021

- [ ] Audit Google PageSpeed Insights (desktop + mobile) — ⚠️ ACTION MANUELLE : https://pagespeed.web.dev/ → tester ferme-broka.fr
- [x] **LCP** — `<link rel="preload" as="image" fetchpriority="high">` ajouté pour images/header.jpg (hero CSS background)
- [x] **CLS** — containers avec `aspect-ratio` CSS (1/1 pour produits, 4/5 pour histoire) → pas de layout shift. `loading="lazy"` ajoute la gestion intrinsic size.
- [ ] **INP** — à surveiller dans Search Console (Expérience de page). JS SPA léger → risque faible.
- [ ] Compression images WebP — ⚠️ ACTION MANUELLE : utiliser Squoosh, ImageOptim ou sharp pour convertir JPEG/PNG en WebP (gain ~30%)
- [x] Lazy loading : 10 images below-fold avec `loading="lazy"` (packs, produits individuels, histoire, Sagar Ozpina)

---

### Phase 6 — Contenu optimisé
> Priorité : 🟢 Moyen terme — renforce l'autorité thématique

- [ ] Intégrer les mots-clés principaux naturellement dans les textes existants (sans sur-optimisation)
- [ ] Page mentions légales : ajouter adresse complète GAEC (signal local)
- [ ] Texte alternatif enrichi sur les images produits
- [ ] Vérifier la densité de mots-clés : "vinaigre de cidre BIO" doit apparaître plusieurs fois sans être répétitif

---

### Phase 7 — Netlinking & autorité
> Priorité : 🟢 Moyen terme — construction progressive

- [ ] Soumission dans les annuaires BIO : bio-annuaire.fr, Nature & Progrès, etc.
- [ ] Fiche sur les plateformes producteurs locaux (Amap, La Ruche qui dit Oui, etc.)
- [ ] Liens depuis les pages des marchés de Billère et Biarritz si possible
- [ ] Encourager les mentions presse / blogs sur le vinaigre artisanal

---

### Phase 8 — Mesure & suivi
> Priorité : 🔴 Haute — sans mesure, pas d'optimisation possible

- [ ] **Google Search Console** — ⚠️ ACTION MANUELLE : (1) Aller sur search.google.com/search-console, (2) Ajouter la propriété https://ferme-broka.fr/, (3) Vérifier via Google Analytics (lier le même compte GA4) ou via balise HTML/DNS TXT, (4) Soumettre https://ferme-broka.fr/sitemap.xml
- [x] **Google Analytics 4** — snippet gtag.js intégré dans `<head>` (⚠️ remplacer G-XXXXXXXXXX par votre Measurement ID réel)
- [x] Suivi des conversions câblé : `add_to_cart`, `begin_checkout`, `purchase` (avec valeur panier et items)
- [ ] Suivre le positionnement sur les mots-clés cibles (outil : Google Search Console → Performances, après vérification)

---

## Ordre d'exécution recommandé

```
Phase 1 (title, meta, og, robots, sitemap)
    ↓
Phase 2 (JSON-LD : Organization + Product + FAQ)
    ↓
Phase 8 (Search Console + Analytics — pour mesurer dès le départ)
    ↓
Phase 3 (sémantique HTML)
    ↓
Phase 5 (Core Web Vitals)
    ↓
Phase 4 (Google Business Profile — action externe)
    ↓
Phase 6 (contenu)
    ↓
Phase 7 (netlinking — long terme)
```

---

## Notes techniques

- Le site est une **SPA** (Single Page Application) — Google crawle le HTML statique directement, pas de problème de rendu JS pour les balises `<head>`
- `vercel.json` gère les rewrites — `robots.txt` et `sitemap.xml` doivent être à la racine ou servis via l'API
- Les prix en JSON-LD doivent correspondre exactement à ceux de `api/checkout.js`
- L'image OG recommandée : 1200×630 px, produit reconnaissable sur fond propre

---

*Dernière mise à jour : 2026-05-28*
