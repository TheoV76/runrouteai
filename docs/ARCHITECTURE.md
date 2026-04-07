# RunRouteAI — Architecture Technique

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR                           │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────────────────┐ │
│  │  SearchPanel     │      │         MapView              │ │
│  │  (paramètres)    │      │      (Leaflet + OSM)         │ │
│  │                  │      │                              │ │
│  │  - Adresse       │      │  Polylignes colorées         │ │
│  │  - Distance      │      │  Légende interactive         │ │
│  │  - Type          │      │  Marqueur de départ          │ │
│  │  - Espaces verts │      │                              │ │
│  │  - Allure        │      └──────────────────────────────┘ │
│  └──────────────────┘                                       │
│           │                 ┌──────────────────────────────┐ │
│           │                 │       RouteCard (×N)         │ │
│           │                 │                              │ │
│           │                 │  - Score global              │ │
│           │                 │  - Métriques                 │ │
│           │                 │  - Résumé IA                 │ │
│           │                 │  - Export GPX / GMaps        │ │
│           │                 └──────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────┘
            │ HTTP POST /api/routes
            ▼
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS API ROUTES (Serverless)           │
│                                                             │
│  /api/geocode      → Nominatim (OpenStreetMap)             │
│  /api/routes       → Orchestrateur principal               │
│  /api/export-gpx   → Génération fichier GPX                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              lib/routing.js                         │   │
│  │                                                     │   │
│  │  1. geocodeAddress() → Nominatim                    │   │
│  │  2. fetchOSMContext() → Overpass API                │   │
│  │  3. generateRouteORS() → OpenRouteService           │   │
│  │  4. analyzeORSRoute() → Extraction métriques        │   │
│  │  5. scoreRoute() → Algorithme de scoring            │   │
│  │  6. fetchElevation() → Open-Elevation API           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              lib/ai.js                              │   │
│  │                                                     │   │
│  │  generateRouteSummary() → OpenAI GPT-4o-mini        │   │
│  │  generateFallbackSummary() → Template-based         │   │
│  │  aiEnhancedScore() → Bonus/malus OSM                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              lib/mockData.js                        │   │
│  │                                                     │   │
│  │  generateMockRoutes() → Données de test             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                      APIs EXTERNES                          │
│                                                             │
│  Nominatim (OSM)     → Géocodage (gratuit, sans clé)       │
│  Overpass API        → Données OSM enrichies (gratuit)      │
│  OpenRouteService    → Routing piéton (2000 req/j gratuit)  │
│  Open-Elevation      → Altitude / D+ (gratuit)              │
│  OpenAI GPT-4o-mini  → Résumés IA (payant, ~$0.001/résumé) │
└─────────────────────────────────────────────────────────────┘
```

## Algorithme de génération d'itinéraires

### Étape 1 — Géocodage
```
adresse_texte → Nominatim → { lat, lng }
```

### Étape 2 — Contexte OSM (Overpass)
Requête Overpass dans un rayon de `distance × 400m` :
- Parcs, forêts, sentiers, pistes cyclables
- Feux de signalisation
- Routes principales (primary, secondary)

Résultat : `{ trafficLightsNearby, greenAreasNearby, majorRoadsNearby }`

### Étape 3 — Génération des routes (OpenRouteService)
On génère 6 points "destination" à différents angles (0°, 60°, 120°...) autour du départ, à une distance calculée pour obtenir la boucle souhaitée.

Pour chaque point, ORS retourne jusqu'à 3 variantes d'itinéraires avec :
- Géométrie (polyline)
- Type de voies (footway, cycleway, primary...)
- Surfaces
- Pentes

### Étape 4 — Analyse de chaque route
```javascript
analyzeORSRoute(feature, osmContext) → {
  coordinates,       // tableau [lat, lng]
  distanceM,         // distance en mètres
  greenRatio,        // 0 à 1, proportion en espace vert
  trafficLights,     // nombre estimé de feux rouges
  crossings,         // nombre estimé de traversées
  primaryRoadRatio,  // proportion sur routes principales
}
```

### Étape 5 — Scoring

```
Score global = 
  greenScore    × 0.40 (si préfère vert) ou × 0.25
  lightScore    × 0.20 (ou × 0.25)
  crossingScore × 0.20 (ou × 0.25)
  primaryScore  × 0.20 (ou × 0.25)

Où :
  greenScore    = min(100, greenRatio × 100 × (1.3 si préfère vert))
  lightScore    = max(0, 100 - trafficLights × 4)
  crossingScore = max(0, 100 - crossings × 2.5)
  primaryScore  = max(0, 100 - primaryRoadRatio × 80)

Score tranquillité = lightScore × 0.4 + crossingScore × 0.35 + primaryScore × 0.25
```

### Étape 6 — IA (OpenAI)
Chaque route reçoit un résumé en langage naturel généré par `gpt-4o-mini`.  
Si l'API OpenAI n'est pas configurée, un résumé template est généré localement.

### Étape 7 — Tri et retour
Les routes sont triées par `score.overall` décroissant.  
Les 6 meilleures sont retournées au client.

---

## Classement préférentiel des types de voies

| Type OSM | Tag | Poids scoring |
|---|---|---|
| Sentiers / chemins | `highway=footway`, `highway=path` | +++ |
| Pistes cyclables | `highway=cycleway` | +++ |
| Parcs / forêts | `leisure=park`, `landuse=forest` | +++ |
| Voies résidentielles | `highway=residential`, `highway=service` | ++ |
| Voies secondaires | `highway=secondary` | + |
| Voies principales | `highway=primary` | - |
| Boulevards / nationales | `highway=trunk`, `highway=motorway` | --- |

---

## Limites et améliorations (V2)

1. **Routing personnalisé** : Construire un graphe OSM local avec NetworkX/OSMnx pour un contrôle total
2. **Tuiles sombres** : Intégrer Stadia Maps / MapTiler pour un rendu visuel cohérent
3. **Profil altimétrique** : Afficher le graphe D+/km sur la carte
4. **Historique** : Sauvegarder les routes en base (SQLite/Postgres)
5. **Météo** : Intégrer OpenWeatherMap pour conseiller sur les conditions
6. **Communauté** : Permettre aux coureurs de noter et partager les routes
7. **App mobile** : PWA ou React Native
8. **Cache Redis** : Mettre en cache les réponses ORS pour les mêmes zones
