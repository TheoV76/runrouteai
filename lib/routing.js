/**
 * RunRouteAI — Moteur de routing et scoring
 * Utilise OpenRouteService + Overpass API + Open-Elevation
 */

const ORS_BASE = 'https://api.openrouteservice.org';
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';
const ELEVATION_BASE = 'https://api.open-elevation.com/api/v1';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// ============================================================
// GEOCODING
// ============================================================
export async function geocodeAddress(address) {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RunRouteAI/1.0' },
  });
  const data = await res.json();
  if (!data.length) throw new Error('Adresse introuvable');
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display: data[0].display_name,
  };
}

export async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RunRouteAI/1.0' },
  });
  const data = await res.json();
  return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ============================================================
// OVERPASS — récupère les données OSM (parcs, sentiers, feux)
// ============================================================
export async function fetchOSMContext(lat, lng, radiusM = 3000) {
  const query = `
    [out:json][timeout:25];
    (
      way["leisure"="park"](around:${radiusM},${lat},${lng});
      way["landuse"="forest"](around:${radiusM},${lat},${lng});
      way["highway"="cycleway"](around:${radiusM},${lat},${lng});
      way["highway"="footway"](around:${radiusM},${lat},${lng});
      way["highway"="path"](around:${radiusM},${lat},${lng});
      node["highway"="traffic_signals"](around:${radiusM},${lat},${lng});
      way["highway"="primary"](around:${radiusM},${lat},${lng});
      way["highway"="secondary"](around:${radiusM},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = await res.json();
    return analyzeOSMData(data.elements);
  } catch {
    return { trafficLightsNearby: 0, greenAreasNearby: 0, majorRoadsNearby: 0 };
  }
}

function analyzeOSMData(elements) {
  const trafficLights = elements.filter(
    (e) => e.type === 'node' && e.tags?.highway === 'traffic_signals'
  ).length;

  const greenAreas = elements.filter(
    (e) => e.type === 'way' && (
      e.tags?.leisure === 'park' ||
      e.tags?.landuse === 'forest' ||
      e.tags?.highway === 'footway' ||
      e.tags?.highway === 'path'
    )
  ).length;

  const majorRoads = elements.filter(
    (e) => e.type === 'way' && (
      e.tags?.highway === 'primary' ||
      e.tags?.highway === 'secondary'
    )
  ).length;

  return { trafficLightsNearby: trafficLights, greenAreasNearby: greenAreas, majorRoadsNearby: majorRoads };
}

// ============================================================
// OPENROUTESERVICE — génère les itinéraires
// ============================================================
export async function generateRouteORS(apiKey, start, end, profile = 'foot-walking') {
  const url = `${ORS_BASE}/v2/directions/${profile}/geojson`;
  const body = {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat],
    ],
    alternative_routes: {
      target_count: 3,
      weight_factor: 1.8,
      share_factor: 0.6,
    },
    extra_info: ['steepness', 'surface', 'waycategory', 'waytype'],
    instructions: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ORS error: ${err}`);
  }

  return res.json();
}

// Génère un point "opposé" pour une boucle ou aller-retour
export function computeLoopMidpoint(lat, lng, distanceKm, angle = 0) {
  const R = 6371;
  const d = distanceKm / Math.PI; // rayon si boucle
  const rad = (angle * Math.PI) / 180;
  const newLat = lat + (d / R) * (180 / Math.PI) * Math.cos(rad);
  const newLng = lng + (d / R) * (180 / Math.PI) * Math.sin(rad) / Math.cos(lat * Math.PI / 180);
  return { lat: newLat, lng: newLng };
}

// ============================================================
// ÉLÉVATION
// ============================================================
export async function fetchElevation(coordinates) {
  // Open Elevation API — gratuit, open source
  try {
    const locations = coordinates
      .filter((_, i) => i % 5 === 0) // échantillonne 1 point sur 5
      .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

    const res = await fetch(`${ELEVATION_BASE}/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
    });

    const data = await res.json();
    const elevations = data.results.map((r) => r.elevation);

    let gain = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) gain += diff;
    }
    return Math.round(gain);
  } catch {
    // Fallback: estimation basée sur la distance
    const distKm = coordinates.length * 0.01;
    return Math.round(distKm * 4);
  }
}

// ============================================================
// ANALYSE D'UN ITINÉRAIRE ORS
// ============================================================
export function analyzeORSRoute(feature, osmContext) {
  const props = feature.properties;
  const coords = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  // Extraire les extras ORS
  const extras = props.extras || {};
  const waytypes = extras.waytypes?.values || [];
  const surfaces = extras.surface?.values || [];

  // Compter les types de voies
  let footwayLength = 0;
  let cyclwayLength = 0;
  let residentialLength = 0;
  let primaryLength = 0;
  let totalLength = props.summary?.distance || 0;

  waytypes.forEach(([start, end, type]) => {
    const segLen = (end - start) / coords.length * totalLength;
    if (type === 2 || type === 3) footwayLength += segLen; // footway/path
    else if (type === 4) cyclwayLength += segLen;
    else if (type === 5 || type === 6) residentialLength += segLen; // residential/service
    else if (type === 1) primaryLength += segLen; // primary
  });

  const greenLength = footwayLength + cyclwayLength;
  const greenRatio = totalLength > 0 ? greenLength / totalLength : 0;

  // Estimer les intersections et feux selon densité OSM
  const distKm = totalLength / 1000;
  const lightDensity = osmContext.trafficLightsNearby > 10 ? 2.5 :
                       osmContext.trafficLightsNearby > 5 ? 1.5 : 0.8;
  const crossingDensity = osmContext.majorRoadsNearby > 8 ? 3.5 : 2.0;

  return {
    coordinates: coords,
    distanceM: totalLength,
    greenRatio: Math.min(1, greenRatio + (osmContext.greenAreasNearby * 0.02)),
    trafficLights: Math.round(distKm * lightDensity * (1 - greenRatio * 0.5)),
    crossings: Math.round(distKm * crossingDensity * (1 - greenRatio * 0.3)),
    primaryRoadRatio: totalLength > 0 ? primaryLength / totalLength : 0,
  };
}

// ============================================================
// SCORING ALGORITHM
// ============================================================
/**
 * Calcule un score de 0 à 100 pour un itinéraire.
 * 
 * Facteurs positifs:
 * - greenRatio: proportion en espaces verts/sentiers (×35)
 * - peu de feux rouges (×20)
 * - peu de traversées (×20)
 * - peu de routes principales (×25)
 * 
 * Pénalités:
 * - boulevard/route principale: -15 pts max
 * - feux rouges nombreux: -10 pts max
 * - traversées nombreuses: -10 pts max
 */
export function scoreRoute(analysis, distanceKm, preferGreen) {
  const {
    greenRatio,
    trafficLights,
    crossings,
    primaryRoadRatio,
  } = analysis;

  // Scores normalisés (0-100)
  const greenScore = Math.min(100, greenRatio * 100 * (preferGreen ? 1.3 : 1.0));
  
  // Pénalité feux rouges (0-100, inversé)
  const lightPenalty = Math.min(50, trafficLights * 4);
  const lightScore = Math.max(0, 100 - lightPenalty);

  // Pénalité traversées
  const crossingPenalty = Math.min(50, crossings * 2.5);
  const crossingScore = Math.max(0, 100 - crossingPenalty);

  // Pénalité routes principales
  const primaryPenalty = Math.min(60, primaryRoadRatio * 100 * 0.8);
  const primaryScore = Math.max(0, 100 - primaryPenalty);

  // Score pondéré
  const weights = preferGreen
    ? { green: 0.40, light: 0.20, crossing: 0.20, primary: 0.20 }
    : { green: 0.25, light: 0.25, crossing: 0.25, primary: 0.25 };

  const overall = Math.round(
    greenScore * weights.green +
    lightScore * weights.light +
    crossingScore * weights.crossing +
    primaryScore * weights.primary
  );

  // Tranquillité = score sans bruit et feux
  const tranquility = Math.round(
    (lightScore * 0.4 + crossingScore * 0.35 + primaryScore * 0.25)
  );

  return {
    overall: Math.min(100, overall),
    tranquility: Math.min(100, tranquility),
    green: Math.round(greenRatio * 100),
    breakdown: {
      greenScore: Math.round(greenScore),
      lightScore: Math.round(lightScore),
      crossingScore: Math.round(crossingScore),
      primaryScore: Math.round(primaryScore),
    },
  };
}

// ============================================================
// EXPORT GPX
// ============================================================
export function generateGPX(route) {
  const { name, coordinates, metrics } = route;
  const now = new Date().toISOString();

  const trkpts = coordinates
    .map(([lat, lng]) => `    <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunRouteAI"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${now}</time>
    <desc>Itinéraire généré par RunRouteAI - ${metrics.distance}km, D+${metrics.elevationGain}m</desc>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

// ============================================================
// URL GOOGLE MAPS
// ============================================================
export function generateGoogleMapsURL(coordinates) {
  if (!coordinates?.length) return '#';
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  // Pour une boucle, on passe par quelques waypoints intermédiaires
  const waypointIndices = [
    Math.floor(coordinates.length * 0.25),
    Math.floor(coordinates.length * 0.5),
    Math.floor(coordinates.length * 0.75),
  ];

  const waypoints = waypointIndices
    .map((i) => `${coordinates[i][0]},${coordinates[i][1]}`)
    .join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${end[0]},${end[1]}&waypoints=${waypoints}&travelmode=walking`;
}
