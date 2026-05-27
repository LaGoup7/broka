# BroKa · Page QR Code Marché — Résumé de projet

> **Contexte** : Page démo réalisée pour BroKa / GAEC Goyhenetxea, producteur artisanal de vinaigre de cidre de pomme au Pays Basque. L'objectif : convertir les passants d'un stand de marché en contacts et clients, via un QR code.

---

## Le problème client

Un producteur local présent sur les marchés a du mal à :
- **Garder le contact** avec les personnes intéressées mais qui repartent sans acheter
- **Vendre à distance** entre deux marchés
- **Partager ses produits** sur les réseaux sans site professionnel

Un site complet (5 à 10 pages, CMS, back-office) est souvent trop cher et trop complexe pour ce type de structure.

---

## La solution proposée

Une **page mobile-first** accessible via QR code, hébergée sur un domaine existant (`yourqr.page/broka`), construite en HTML/CSS/JS pur — sans framework, sans abonnement SaaS.

**Coût d'hébergement : 0 € supplémentaire** (sous-dossier d'un hébergement déjà en place).

---

## Ce qui a été développé

### 1. `index.html` — Page principale (landing page)

Architecture de conversion optimisée :

| # | Section | Rôle |
|---|---|---|
| 1 | **Hero** | Accroche visuelle, CTA vers le formulaire |
| 2 | **Formulaire** | Capture Nom + Prénom + Téléphone + Email |
| 3 | **Avis clients** | Preuve sociale avant la présentation produit |
| 4 | **Produit** | Présentation Sagar Ozpina + bénéfices |
| 5 | **Histoire** | Storytelling ferme / couple / terroir |
| 6 | **Nos Packs** | 3 offres avec commande WhatsApp directe |
| 7 | **Contact** | WhatsApp + Email + Facebook |
| 8 | **Footer** | Mentions légales légères |

**Fonctionnalités clés :**
- Formulaire avec envoi automatique par email (via `send.js`) — aucune action manuelle
- Téléchargement immédiat du guide PDF après inscription
- 3 packs commandables directement via WhatsApp (message pré-rempli)
- Bouton WhatsApp flottant visible en permanence
- Animations au scroll (IntersectionObserver)
- 100 % responsive, optimisé mobile

---

### 2. `send.js` — Backend léger (envoi email)

Script PHP minimal hébergé sur le même serveur :
- Reçoit les données du formulaire (Prénom, Nom, Email, Téléphone)
- Envoie un email de notification au propriétaire
- Aucun compte tiers, aucune API payante
- Extensible vers Google Sheets ou Brevo si besoin d'un CRM

---

### 3. `generer-qr.html` — Générateur de QR code permanent

Outil standalone pour créer le QR code une seule fois :
- Tailles : 800 px / 1200 px / 2000 px (impression haute résolution)
- Styles : classique vert, inversé, noir/blanc
- Export PNG téléchargeable avec logo BroKa et tagline
- Utilise `qrcode.js` (CDN, sans serveur)

---

### 4. `stand.html` — Affichage pour le stand marché

Page à afficher sur tablette/écran derrière le stand :
- Génère le QR code automatiquement depuis l'URL en cours
- Affiche le logo, tagline et message "Scannez pour en savoir plus"
- Champ de configuration d'URL pour pointer vers n'importe quelle page

---

## Stack technique

| Technologie | Usage |
|---|---|
| HTML5 / CSS3 / JS vanilla | Tout le front — aucun framework |
| CSS custom properties | Thème cohérent (couleurs, rayons, ombres) |
| Google Fonts | Playfair Display + Lato |
| IntersectionObserver API | Animations au scroll |
| `qrcode.js` (CDN) | Génération QR côté client |
| Canvas API | Export PNG du QR code brandé |
| PHP `mail()` | Envoi email serveur sans dépendance |
| WhatsApp `wa.me` | Liens de commande et contact direct |
| Infomaniak | Hébergement (sous-dossier du domaine client) |

---

## Les 3 packs produits

| Pack | Prix | Contenu |
|---|---|---|
| **Découverte** | 15 € (+ 3 € port) | 1 bouteille Sagar Ozpina + sauce XÜ-BEROA + guide |
| **Famille** | 35 € (+ 3 € port) | 3 bouteilles + jus de pomme + sauce + guide |
| **Cadeau** | 42 € (+ 5 € port) | 2 bouteilles + sauce + surprise + guide + emballage cadeau + mot manuscrit |

Chaque pack a un **bouton WhatsApp avec message pré-rempli** → le producteur confirme et encaisse au marché suivant ou par envoi postal.

---

## Déploiement

```
sites/
└── yourqr.page/
    └── broka/
        ├── index.html
        ├── send.js
        ├── generer-qr.html
        ├── stand.html
        ├── Guide_BroKa_7_idees_vinaigre_pomme.pdf
        └── images/
            ├── broka_bouteille_verger.jpg
            ├── broka_bouteille_pommes.jpg
            └── broka_couples_berger_verger.jpg
```

Upload via WebFTP Infomaniak. Accessible à `https://yourqr.page/broka`.

---

## Ce que ça résout concrètement

- **Avant** : un passant repart, pas de moyen de le recontacter
- **Après** : il scanne le QR → remplit le formulaire → reçoit le guide → Olivier reçoit un email avec ses coordonnées

- **Avant** : vendre entre deux marchés = impossible
- **Après** : partager l'URL ou le QR sur les réseaux → commande WhatsApp directe

---

## Ce que l'on peut proposer aux PME

Ce type de livrable est adapté à tout commerce local présent sur des marchés, salons ou événements :

- Producteurs agricoles, artisans alimentaires
- Artisans (bijoux, poterie, cosmétiques)
- Associations et petites structures
- Restaurants, traiteurs, caves

**Avantages vs site complet :**
- Livraison en quelques jours (pas semaines)
- Pas de CMS à maintenir, pas de mises à jour
- Hébergeable sur un domaine existant
- Prix bien inférieur à une prestation agence

**Extensions possibles selon le besoin :**
- Connexion Google Sheets pour centraliser les contacts
- Envoi automatique du guide par email (EmailJS / Brevo)
- Prise de commande avec paiement (Stripe / SumUp)
- Ajout de photos et variantes produits
- Version multilingue (basque, espagnol…)
