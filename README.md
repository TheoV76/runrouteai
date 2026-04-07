# 🏃 RunRouteAI

> **Itinéraires de course à pied optimisés par IA**  
> Trouve les meilleurs parcours en privilégiant les espaces verts, en évitant le trafic, avec export GPX et résumés IA.

![RunRouteAI](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=nextdotjs)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![OpenStreetMap](https://img.shields.io/badge/data-OpenStreetMap-blue?style=flat-square)

---

## 📋 Table des matières

1. [Description](#description)
2. [Fonctionnalités](#fonctionnalités)
3. [Stack technique](#stack-technique)
4. [Installation locale](#installation-locale)
5. [Configuration des APIs](#configuration-des-apis)
6. [Structure du projet](#structure-du-projet)
7. [Guide GitHub](#guide-github)
8. [Déploiement Vercel](#déploiement-vercel)
9. [Mode démo](#mode-démo)
10. [Améliorations futures (V2)](#améliorations-futures-v2)

---

## Description

RunRouteAI est une application web qui génère des itinéraires de course à pied personnalisés en fonction de :
- Le point de départ (adresse ou GPS)
- La distance souhaitée (2 à 42 km)
- Le type de parcours (boucle ou aller-retour)
- La préférence pour les espaces verts

L'algorithme analyse les données OpenStreetMap pour scorer chaque itinéraire selon la qualité du terrain (sentiers, parcs, petites rues) et minimiser l'exposition au trafic automobile.

---

## Fonctionnalités

- 📍 **Géocodage** avec autocomplétion d'adresse (Nominatim/OSM)
- 🎯 **Géolocalisation GPS** via le navigateur
- 🗺️ **Carte interactive** (Leaflet + OpenStreetMap)
- 🤖 **Résumés IA** en langage naturel (OpenAI GPT-4o-mini)
- 📊 **Métriques détaillées** : D+, feux rouges, traversées, score tranquillité
- ⬇️ **Export GPX** téléchargeable pour chaque route
- 🗺️ **Lien Google Maps** avec waypoints
- ⚡ **Mode démo** sans dépendances externes

---

## Stack technique

| Couche | Technologie | Justification |
|---|---|---|
| Frontend | Next.js 14 + React 18 | SSR/SSG, API routes intégrées, déploiement Vercel |
| Style | TailwindCSS | Utilitaire, rapide, responsive |
| Carte | Leaflet + react-leaflet | Gratuit, OSM natif, léger |
| Routing | OpenRouteService | Gratuit (2000 req/j), API routes piétonnes |
| Géocodage | Nominatim (OSM) | Entièrement gratuit, sans clé API |
| Données OSM | Overpass API | Gratuit, richesse des données |
| Élévation | Open-Elevation | Gratuit, open source |
| IA | OpenAI GPT-4o-mini | Très économique (~$0.001/résumé) |

**Pourquoi Next.js plutôt que FastAPI ?**  
Next.js permet de tout déployer sur Vercel (frontend + backend) sans gérer d'infrastructure séparée. Les API Routes sont suffisantes pour ce cas d'usage. FastAPI serait préférable si le backend devenait très lourd (ML on-premise, gros graphes OSM).

---

## Installation locale

### Prérequis
- Node.js 18+ ([télécharger](https://nodejs.org))
- npm ou yarn

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/TON_USERNAME/runrouteai.git
cd runrouteai

# 2. Installer les dépendances
npm install

# 3. Copier le fichier d'environnement
cp .env.example .env.local

# 4. Éditer .env.local avec tes clés (voir section suivante)
nano .env.local

# 5. Lancer en développement
npm run dev

# Le site est accessible sur http://localhost:3000
```

### Commandes utiles

```bash
npm run dev      # Démarrage développement (hot reload)
npm run build    # Build de production
npm run start    # Lancer la version de production buildée
npm run lint     # Vérifier le code avec ESLint
```

---

## Configuration des APIs

### Variables d'environnement (`.env.local`)

```env
# OpenAI (optionnel — pour les résumés IA)
# Sans cette clé, des résumés template seront utilisés
OPENAI_API_KEY=sk-...

# OpenRouteService (recommandé — pour les vrais itinéraires)
# Sans cette clé, le mode démo est activé automatiquement
OPENROUTESERVICE_API_KEY=eyJ...

# Mode démo forcé (true = toujours utiliser les données mock)
NEXT_PUBLIC_DEMO_MODE=false
```

### Obtenir les clés API

#### 1. OpenRouteService (gratuit, recommandé)
1. Aller sur [openrouteservice.org](https://openrouteservice.org/dev/#/signup)
2. Créer un compte gratuit
3. Dans le dashboard → "Tokens" → "Create Token"
4. Plan gratuit : **2000 requêtes/jour** (largement suffisant)
5. Copier la clé dans `OPENROUTESERVICE_API_KEY`

#### 2. OpenAI (optionnel, payant)
1. Aller sur [platform.openai.com](https://platform.openai.com/api-keys)
2. Créer un compte
3. Ajouter des crédits (minimum $5 — durera des mois pour ce projet)
4. Créer une clé API
5. Copier dans `OPENAI_API_KEY`

**Coût estimé OpenAI** : GPT-4o-mini coûte ~$0.00015/1K tokens.  
Un résumé = ~200 tokens = **$0.00003** (moins d'un centime pour 30 résumés).

#### 3. Nominatim et Overpass
**Aucune clé requise** — ces APIs sont libres d'accès.  
Respecter les [conditions d'utilisation Nominatim](https://operations.osmfoundation.org/policies/nominatim/) :
- Maximum 1 requête par seconde
- Header `User-Agent` obligatoire (déjà configuré dans le code)

---

## Structure du projet

```
runrouteai/
├── pages/
│   ├── _app.js              # Wrapper Next.js (styles globaux)
│   ├── _document.js         # HTML document (Leaflet CSS)
│   ├── index.js             # Page principale (layout)
│   └── api/
│       ├── geocode.js       # GET  /api/geocode?q=...
│       ├── routes.js        # POST /api/routes
│       └── export-gpx.js   # POST /api/export-gpx
│
├── components/
│   ├── SearchPanel.js       # Panneau gauche (formulaire)
│   ├── MapView.js           # Carte Leaflet (client-side only)
│   └── RouteCard.js         # Carte résultat individuelle
│
├── lib/
│   ├── routing.js           # Algorithme routing + scoring + GPX
│   ├── ai.js                # Intégration OpenAI
│   └── mockData.js          # Données de démo (sans APIs)
│
├── styles/
│   └── globals.css          # CSS global + variables + Leaflet overrides
│
├── docs/
│   └── ARCHITECTURE.md      # Schéma technique détaillé
│
├── public/                  # Assets statiques (favicon, etc.)
├── .env.example             # Template variables d'environnement
├── .env.local               # Tes clés (jamais committé !)
├── .gitignore               # Fichiers ignorés par Git
├── next.config.js           # Configuration Next.js
├── tailwind.config.js       # Configuration TailwindCSS
├── postcss.config.js        # PostCSS (requis par Tailwind)
└── package.json             # Dépendances
```

---

## Guide GitHub

### Première fois — Initialisation complète

```bash
# 1. Créer un compte sur github.com si pas déjà fait

# 2. Créer un nouveau repository sur GitHub :
# → github.com/new
# → Nom : runrouteai
# → Description : Itinéraires de course optimisés par IA
# → Visibilité : Public ou Private
# → NE PAS cocher "Initialize with README" (on le fait nous-mêmes)
# → Cliquer "Create repository"

# 3. Dans ton terminal, dans le dossier du projet :
git init
git add .
git commit -m "feat: initial RunRouteAI project"

# 4. Lier au repository GitHub (remplacer TON_USERNAME)
git remote add origin https://github.com/TON_USERNAME/runrouteai.git
git branch -M main
git push -u origin main
```

### Workflow quotidien

```bash
# Vérifier le statut
git status

# Ajouter des modifications
git add .
# ou pour un fichier spécifique :
git add pages/index.js

# Créer un commit
git commit -m "feat: ajout export GPX"

# Pousser sur GitHub
git push
```

### Gestion des branches (bonnes pratiques)

```bash
# Créer une branche pour une nouvelle fonctionnalité
git checkout -b feature/profil-altimetrique

# Travailler, committer...
git add .
git commit -m "feat: ajout graphe altimétrique sur la carte"

# Fusionner dans main quand c'est prêt
git checkout main
git merge feature/profil-altimetrique
git push

# Supprimer la branche feature
git branch -d feature/profil-altimetrique
```

### .gitignore (à créer à la racine)

```
# Dépendances
node_modules/

# Environnement (JAMAIS committer les clés API !)
.env
.env.local
.env.*.local

# Next.js
.next/
out/

# Misc
.DS_Store
*.log
```

---

## Déploiement Vercel

Vercel est la plateforme officielle de Next.js. Déploiement en 5 minutes, HTTPS automatique, CDN mondial.

### Étapes

#### 1. Créer un compte Vercel
→ [vercel.com](https://vercel.com) → "Sign up with GitHub"

#### 2. Importer le projet
1. Dashboard Vercel → "New Project"
2. "Import Git Repository" → Sélectionner `runrouteai`
3. **Framework Preset** : Next.js (détecté automatiquement)
4. **Root Directory** : laisser vide (racine)
5. Ne pas toucher aux autres paramètres

#### 3. Configurer les variables d'environnement
**AVANT** de cliquer "Deploy" :
1. Cliquer sur "Environment Variables"
2. Ajouter une par une :

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | `sk-...` (ta clé OpenAI) |
| `OPENROUTESERVICE_API_KEY` | `eyJ...` (ta clé ORS) |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |

3. Cliquer "Deploy"

#### 4. Premier déploiement
- Build : ~2 minutes
- L'URL de production sera : `https://runrouteai-TON_USERNAME.vercel.app`

#### 5. Déploiements suivants (automatiques)
À chaque `git push` sur `main` → Vercel redéploie automatiquement.

#### 6. Domaine personnalisé (optionnel)
Dashboard → Projet → "Settings" → "Domains" → Ajouter ton domaine.

### Tester le déploiement

1. Ouvrir l'URL Vercel
2. Tester en mode démo (sans configuration API)
3. Vérifier les logs : Dashboard → Projet → "Functions" → "Logs"

---

## Mode démo

Si tu n'as pas de clé OpenRouteService (ou en développement), le **mode démo** s'active automatiquement :

- Des itinéraires générés algorithmiquement sont utilisés
- La carte affiche de vraies polylignes
- Les métriques sont calculées de manière réaliste
- Les résumés IA fonctionnent (avec ou sans OpenAI)

Pour forcer le mode démo : `NEXT_PUBLIC_DEMO_MODE=true` dans `.env.local`

Un badge **⚡ Mode démo** s'affiche dans l'interface quand il est actif.

---

## Améliorations futures (V2)

### Priorité haute
- [ ] **Graphe OSM local** : Utiliser OSMnx (Python) pour construire le graphe complet et contrôler totalement le routing
- [ ] **Profil altimétrique** : Graphique D+/km affiché sous la carte
- [ ] **Cache Redis** : Mettre en cache les données Overpass par zone géographique

### Priorité moyenne
- [ ] **Tuiles sombres** : Intégrer Stadia Maps pour un rendu visuel cohérent avec le dark theme
- [ ] **Météo** : Afficher les conditions météo actuelles (OpenWeatherMap)
- [ ] **Historique** : Sauvegarder les parcours en base de données (SQLite + Prisma)
- [ ] **Comptes utilisateurs** : Auth avec NextAuth.js

### Priorité basse
- [ ] **Mode hors-ligne** : PWA avec Service Worker
- [ ] **Communauté** : Partager et noter les itinéraires
- [ ] **App mobile** : React Native ou Expo
- [ ] **Multi-sports** : Vélo, marche, trail

---

## Licence

MIT — Utilisation libre, attribution appréciée.

---

*Données cartographiques © [OpenStreetMap](https://openstreetmap.org/copyright) contributeurs*
