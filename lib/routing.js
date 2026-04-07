/**
 * RunRouteAI — routing.js v6
 *
 * Utilise OpenRouteService (ORS) avec les vrais paramètres :
 *  - profile: foot-walking
 *  - options.round-trip pour les boucles (distance exacte en mètres)
 *  - profile_params.weightings.green = 1 si preferGreen
 *  - profile_params.weightings.quiet = 1 (toujours : moins de circulation)
 *  - avoid_features: ["fords"] (évite gués)
 *  - extra_info: waytype, surface, waycategory → pour scorer
 *
 * Pour générer plusieurs routes différentes :
 *  - 3 boucles avec seeds différents (0, 42, 99)
 *  - 2 aller-retours dans des directions différentes (N, E, S, O, NE…)
 *  Puis on trie par score.
 */

const ORS_BASE = 'https://api.openrouteservice.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// ─────────────────────────────────────────────────────────────
// GÉOCODAGE (inchangé)
// ─────────────────────────────────────────────────────────────
export async function geocodeAddress(address) {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'RunRouteAI/1.0' } });
  const data = await res.json();
  if (!data.length) throw new Error('Adresse introuvable');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// ─────────────────────────────────────────────────────────────
// ORS — OPTIONS DE BASE pour foot-walking
// ─────────────────────────────────────────────────────────────
function orsOptions(preferGreen) {
  return {
    avoid_features: ['fords'],
    profile_params: {
      weightings: {
        // green=1 → favorise parcs, sentiers, espaces verts
        green: preferGreen ? 1 : 0,
        // quiet=1 → favorise rues calmes, évite routes principales
        quiet: 1,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// ORS — BOUCLE (round_trip)
// Génère une vraie boucle sur le réseau routier OSM
// seed différent → tracé différent à chaque appel
// ─────────────────────────────────────────────────────────────
export async function fetchORSLoop(apiKey, lat, lng, distanceM, preferGreen, seed = 0) {
  const url = `${ORS_BASE}/v2/directions/foot-walking/geojson`;

  const body = {
    coordinates: [[lng, lat]],  // ORS attend [lng, lat]
    options: {
      ...orsOptions(preferGreen),
      'round_trip': {
        length: distanceM,      // distance cible en mètres (ex: 10000 pour 10km)
        points: 5,              // waypoints intermédiaires — plus = plus circulaire
        seed: seed,             // graine → tracé différent pour chaque seed
      },
    },
    extra_info: ['waytype', 'surface', 'waycategory'],
    instructions: false,
    elevation: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORS loop error (seed=${seed}): ${text}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// ORS — ALLER-RETOUR
// Départ → point intermédiaire calculé dans une direction → retour
// direction: 0=N, 90=E, 180=S, 270=O
// ─────────────────────────────────────────────────────────────
export async function fetchORSOutAndBack(apiKey, lat, lng, distanceM, preferGreen, directionDeg = 0) {
  const url = `${ORS_BASE}/v2/directions/foot-walking/geojson`;

  // Calculer le point milieu dans la direction souhaitée
  const halfKm = distanceM / 2000;
  const midpoint = movePoint(lat, lng, halfKm, directionDeg);

  const body = {
    coordinates: [
      [lng, lat],               // départ
      [midpoint[1], midpoint[0]], // milieu (lng, lat)
      [lng, lat],               // retour au départ
    ],
    options: orsOptions(preferGreen),
    extra_info: ['waytype', 'surface', 'waycategory'],
    instructions: false,
    elevation: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORS out-and-back error (dir=${directionDeg}): ${text}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// DÉPLACER UN POINT en direction + distance
// ─────────────────────────────────────────────────────────────
function movePoint(lat, lng, dKm, angleDeg) {
  const R = 6371;
  const rad = angleDeg * Math.PI / 180;
  return [
    lat + (dKm * Math.cos(rad)) / R * (180 / Math.PI),
    lng + (dKm * Math.sin(rad)) / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI),
  ];
}

// ─────────────────────────────────────────────────────────────
// EXTRAIRE ET ANALYSER UN FEATURE ORS (GeoJSON)
// ─────────────────────────────────────────────────────────────
export function parseORSFeature(feature, routeType, seed_or_dir) {
  const props = feature.properties || {};
  const summary = props.summary || {};
  const extras = props.extras || {};

  // Coordonnées : ORS renvoie [lng, lat], on convertit en [lat, lng]
  const coords = (feature.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);

  // Analyser les types de voies (waytype extra_info)
  const waytypeValues = extras.waytype?.values || [];
  const totalDist = summary.distance || 0;

  let footwayM = 0, cyclewayM = 0, residentialM = 0, primaryM = 0;
  waytypeValues.forEach(([from, to, typeId]) => {
    const segM = (to - from) / Math.max(coords.length, 1) * totalDist;
    // ORS waytype IDs: 0=Unknown,1=StateRoad,2=Road,3=Path,4=Street,5=Cycleway,6=FootWay,7=Steps,10=Ferry,11=Construction
    if (typeId === 6 || typeId === 3) footwayM += segM;     // footway, path
    else if (typeId === 5) cyclewayM += segM;               // cycleway
    else if (typeId === 4) residentialM += segM;            // street
    else if (typeId === 1 || typeId === 2) primaryM += segM; // state road, road
  });

  // Analyser la surface (surface extra_info)
  const surfaceValues = extras.surface?.values || [];
  let naturalSurfaceM = 0;
  surfaceValues.forEach(([from, to, surfId]) => {
    const segM = (to - from) / Math.max(coords.length, 1) * totalDist;
    // ORS surface IDs: 4=Gravel,5=Dirt,6=Ground,7=Ice,8=Paving_stones,9=Sand,10=Woodchips,11=Grass,12=GrassPath
    if ([4,5,6,9,10,11,12].includes(surfId)) naturalSurfaceM += segM;
  });

  const greenM = footwayM + cyclewayM + naturalSurfaceM * 0.5;
  const greenRatio = totalDist > 0 ? Math.min(1, greenM / totalDist) : 0;
  const primaryRatio = totalDist > 0 ? primaryM / totalDist : 0;

  // Estimation feux et croisements basée sur le type de voie
  const distKm = totalDist / 1000;
  const trafficLights = Math.round(distKm * (primaryRatio > 0.3 ? 2.5 : primaryRatio > 0.1 ? 1.2 : 0.4));
  const crossings = Math.round(distKm * (primaryRatio > 0.3 ? 3.5 : primaryRatio > 0.1 ? 2.0 : 0.8));

  // D+ depuis les données d'élévation ORS (si disponibles)
  let elevationGain = summary.ascent || 0;

  return {
    coords,
    distanceM: totalDist,
    distanceKm: parseFloat((totalDist / 1000).toFixed(2)),
    elevationGain: Math.round(elevationGain),
    greenRatio,
    primaryRatio,
    trafficLights,
    crossings,
    routeType,
    variantId: seed_or_dir,
  };
}

// ─────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────
export function scoreAnalysis(analysis, preferGreen) {
  const { greenRatio, trafficLights, crossings, primaryRatio, distanceKm } = analysis;

  const greenScore     = Math.min(100, greenRatio * 100 * (preferGreen ? 1.35 : 1.0));
  const lightScore     = Math.max(0, 100 - Math.min(60, trafficLights * 5));
  const crossingScore  = Math.max(0, 100 - Math.min(60, crossings * 3));
  const primaryScore   = Math.max(0, 100 - Math.min(70, primaryRatio * 100));

  const w = preferGreen
    ? { green: 0.40, light: 0.20, crossing: 0.20, primary: 0.20 }
    : { green: 0.25, light: 0.25, crossing: 0.25, primary: 0.25 };

  const overall    = Math.round(greenScore*w.green + lightScore*w.light + crossingScore*w.crossing + primaryScore*w.primary);
  const tranquility = Math.round(lightScore*0.4 + crossingScore*0.35 + primaryScore*0.25);

  return {
    overall:    Math.min(100, overall),
    tranquility: Math.min(100, tranquility),
    green:      Math.round(greenRatio * 100),
  };
}

// ─────────────────────────────────────────────────────────────
// NOMMER UN ITINÉRAIRE selon ses caractéristiques
// ─────────────────────────────────────────────────────────────
export function nameRoute(analysis, score, routeType) {
  const prefix = routeType === 'loop' ? 'Boucle' : 'Aller-retour';
  if (score.green >= 70)       return `${prefix} — Espaces verts`;
  if (score.tranquility >= 80) return `${prefix} — Rues calmes`;
  if (analysis.primaryRatio < 0.05) return `${prefix} — Sentiers`;
  if (score.green >= 40)       return `${prefix} — Mixte vert`;
  return `${prefix} — Urbain`;
}

// ─────────────────────────────────────────────────────────────
// TAGS selon analyse
// ─────────────────────────────────────────────────────────────
export function tagsFromAnalysis(analysis, score) {
  const tags = [];
  if (score.green >= 70)          tags.push('espaces verts');
  if (analysis.trafficLights <= 2) tags.push('peu de feux');
  if (analysis.crossings <= 4)    tags.push('peu de croisements');
  if (analysis.primaryRatio < 0.1) tags.push('voies douces');
  if (tags.length === 0)          tags.push('urbain');
  return tags;
}

// ─────────────────────────────────────────────────────────────
// COULEURS (palette sobre)
// ─────────────────────────────────────────────────────────────
const PALETTE = ['#2563eb','#15803d','#b45309','#6d28d9','#0e7490'];
export function routeColor(idx) { return PALETTE[idx % PALETTE.length]; }

// ─────────────────────────────────────────────────────────────
// EXPORT GPX
// ─────────────────────────────────────────────────────────────
export function generateGPX(route) {
  const { name, coordinates, metrics } = route;
  const now = new Date().toISOString();
  const trkpts = coordinates
    .map(([lat, lng]) => `    <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunRouteAI" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name><time>${now}</time></metadata>
  <trk><name>${name}</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`;
}

// ─────────────────────────────────────────────────────────────
// URL GOOGLE MAPS
// ─────────────────────────────────────────────────────────────
export function generateGoogleMapsURL(coordinates) {
  if (!coordinates?.length) return '#';
  const start = coordinates[0];
  const mid1  = coordinates[Math.floor(coordinates.length * 0.33)];
  const mid2  = coordinates[Math.floor(coordinates.length * 0.66)];
  const waypoints = `${mid1[0]},${mid1[1]}|${mid2[0]},${mid2[1]}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${start[0]},${start[1]}&waypoints=${waypoints}&travelmode=walking`;
}
