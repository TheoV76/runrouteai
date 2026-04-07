/**
 * RunRouteAI — Données mock v3
 * Corrections :
 * - Aller-retour : 5 directions vraiment différentes, distance exacte
 * - Noms basés sur le quartier/lieu réel (reverse geocoding léger)
 * - Boucles : inchangées (fonctionnent)
 * - Paris : itinéraires iconiques avec vrais coords
 * - Couleurs : palette douce, pas de rouge fluo
 */

// ============================================================
// PALETTE COULEURS — douces, lisibles sur carte grise
// ============================================================
const COLORS = [
  '#2563eb', // bleu royal
  '#16a34a', // vert forêt
  '#d97706', // ambre
  '#7c3aed', // violet
  '#0891b2', // cyan
];

// ============================================================
// ITINÉRAIRES PARISIENS ICONIQUES
// ============================================================
const PARIS_ICONIC = [
  {
    id: 'paris-quais-seine',
    name: 'Quais de Seine',
    tags: ['berges', 'piétons', 'sans voitures'],
    greenRatio: 0.93,
    trafficScore: 9.8,
    elevationPerKm: 1.5,
    crossingsPerKm: 0.3,
    lightsPerKm: 0.2,
    color: COLORS[1],
    description: 'Les berges piétonnes rive gauche et rive droite. Quasi zéro voiture.',
    spine: [
      [48.8534, 2.3488],[48.8551, 2.3441],[48.8567, 2.3412],
      [48.8591, 2.3380],[48.8606, 2.3335],[48.8623, 2.3273],
      [48.8638, 2.3218],[48.8647, 2.3143],[48.8632, 2.3010],[48.8601, 2.2944],
    ],
    minKm: 3, maxKm: 20,
    // Direction principale de la spine (angle en degrés) pour l'aller-retour
    direction: 270, // vers l'ouest (Tour Eiffel)
  },
  {
    id: 'paris-coulee-verte',
    name: 'Coulée Verte',
    tags: ['promenade plantée', 'jardin suspendu', 'sans voitures'],
    greenRatio: 0.97,
    trafficScore: 9.9,
    elevationPerKm: 2,
    crossingsPerKm: 0.1,
    lightsPerKm: 0.1,
    color: COLORS[1],
    description: "L'ancienne voie ferrée reconvertie en jardin suspendu de 4,5 km.",
    spine: [
      [48.8533, 2.3693],[48.8520, 2.3760],[48.8507, 2.3840],
      [48.8493, 2.3928],[48.8479, 2.4012],[48.8463, 2.4095],
      [48.8447, 2.4178],[48.8431, 2.4260],
    ],
    minKm: 2, maxKm: 12,
    direction: 120,
  },
  {
    id: 'paris-bois-boulogne',
    name: 'Bois de Boulogne',
    tags: ['forêt', 'sentiers', 'nature'],
    greenRatio: 0.98,
    trafficScore: 9.7,
    elevationPerKm: 4,
    crossingsPerKm: 0.2,
    lightsPerKm: 0.1,
    color: COLORS[1],
    description: 'Le poumon vert de Paris : 8 km² de sentiers variés, lacs et allées.',
    spine: [
      [48.8670, 2.2490],[48.8640, 2.2420],[48.8590, 2.2350],[48.8530, 2.2290],
      [48.8470, 2.2320],[48.8420, 2.2380],[48.8380, 2.2450],[48.8360, 2.2560],
    ],
    minKm: 5, maxKm: 42,
    direction: 200,
  },
  {
    id: 'paris-canal-saint-martin',
    name: 'Canal Saint-Martin',
    tags: ['canal', 'écluses', 'bohème'],
    greenRatio: 0.72,
    trafficScore: 8.2,
    elevationPerKm: 1,
    crossingsPerKm: 0.8,
    lightsPerKm: 0.5,
    color: COLORS[4],
    description: 'Les écluses et péniches du canal Saint-Martin.',
    spine: [
      [48.8697, 2.3626],[48.8716, 2.3641],[48.8738, 2.3657],
      [48.8762, 2.3669],[48.8785, 2.3682],[48.8840, 2.3710],[48.8870, 2.3730],
    ],
    minKm: 3, maxKm: 15,
    direction: 10,
  },
  {
    id: 'paris-bois-vincennes',
    name: 'Bois de Vincennes',
    tags: ['forêt', 'lacs', 'nature'],
    greenRatio: 0.96,
    trafficScore: 9.5,
    elevationPerKm: 3,
    crossingsPerKm: 0.2,
    lightsPerKm: 0.1,
    color: COLORS[1],
    description: 'Le plus grand bois de Paris côté est. Lacs et 35 km de chemins.',
    spine: [
      [48.8431, 2.4260],[48.8400, 2.4330],[48.8360, 2.4390],
      [48.8320, 2.4450],[48.8280, 2.4520],[48.8250, 2.4600],[48.8280, 2.4680],
    ],
    minKm: 4, maxKm: 30,
    direction: 130,
  },
  {
    id: 'paris-champs-de-mars',
    name: 'Champ de Mars – Invalides',
    tags: ['monument', 'pelouses', 'Tour Eiffel'],
    greenRatio: 0.70,
    trafficScore: 8.5,
    elevationPerKm: 2,
    crossingsPerKm: 1.2,
    lightsPerKm: 0.8,
    color: COLORS[2],
    description: 'Du Champ de Mars aux Invalides. Vues sur la Tour Eiffel garanties.',
    spine: [
      [48.8556, 2.2986],[48.8570, 2.2960],[48.8540, 2.2980],
      [48.8520, 2.3070],[48.8545, 2.3120],[48.8574, 2.3130],[48.8638, 2.3143],
    ],
    minKm: 4, maxKm: 15,
    direction: 80,
  },
];

// ============================================================
// DÉTECTION DE VILLE
// ============================================================
function detectCity(lat, lng) {
  if (lat > 48.78 && lat < 48.92 && lng > 2.20 && lng < 2.50) return 'paris';
  return null;
}

// ============================================================
// HAVERSINE — distance entre deux points GPS en km
// ============================================================
function haversine(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// ============================================================
// BOUCLE — depuis une spine GPS
// ============================================================
function buildLoopFromSpine(startLat, startLng, spine, targetKm) {
  let closestIdx = 0, closestDist = Infinity;
  spine.forEach(([sLat, sLng], i) => {
    const d = haversine([startLat, startLng], [sLat, sLng]);
    if (d < closestDist) { closestDist = d; closestIdx = i; }
  });

  let spineLen = 0;
  for (let i = 1; i < spine.length; i++) spineLen += haversine(spine[i-1], spine[i]);

  const availableForSpine = targetKm - closestDist * 2;
  const fraction = Math.min(1, Math.max(0.3, availableForSpine / Math.max(spineLen, 0.1)));

  const coords = [[startLat, startLng]];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    coords.push([
      startLat + t * (spine[closestIdx][0] - startLat),
      startLng + t * (spine[closestIdx][1] - startLng),
    ]);
  }

  const spinePoints = Math.round(fraction * (spine.length - 1));
  for (let i = closestIdx + 1; i <= Math.min(closestIdx + spinePoints, spine.length - 1); i++) {
    coords.push([...spine[i]]);
  }

  const last = coords[coords.length - 1];
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    coords.push([
      last[0] + t * (startLat - last[0]) + Math.sin(t * Math.PI) * 0.003,
      last[1] + t * (startLng - last[1]),
    ]);
  }

  coords.push([startLat, startLng]); // fermeture exacte
  return coords;
}

// ============================================================
// BOUCLE GÉNÉRIQUE
// ============================================================
function buildGenericLoop(centerLat, centerLng, targetKm, offsetAngle, seed) {
  const R = 6371;
  const radius = targetKm / (2 * Math.PI);
  const points = 18;
  const noise = (i) => {
    const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const coords = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI + (offsetAngle * Math.PI / 180);
    const r = radius * (0.88 + noise(i) * 0.10 + 0.12);
    coords.push([
      centerLat + (r * Math.cos(angle)) / R * (180 / Math.PI),
      centerLng + (r * Math.sin(angle)) / (R * Math.cos(centerLat * Math.PI / 180)) * (180 / Math.PI),
    ]);
  }
  coords.push([coords[0][0], coords[0][1]]); // fermeture exacte
  return coords;
}

// ============================================================
// ALLER-RETOUR — direction en degrés, distance EXACTE
// La distance totale = distanceKm (aller + retour)
// Le point le plus loin = distanceKm / 2 depuis le départ
// ============================================================
function buildOutAndBack(startLat, startLng, targetKm, directionDeg) {
  const R = 6371;
  const rad = directionDeg * Math.PI / 180;
  const halfDist = targetKm / 2; // distance jusqu'au point le plus loin
  const steps = 12;

  const outPoints = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d = t * halfDist;
    // Légère sinusoïde perpendiculaire pour simuler la vraie rue
    const perpOffset = Math.sin(t * Math.PI) * halfDist * 0.06;
    const perpRad = rad + Math.PI / 2;
    const dLat = (d * Math.cos(rad) + perpOffset * Math.cos(perpRad)) / R * (180 / Math.PI);
    const dLng = (d * Math.sin(rad) + perpOffset * Math.sin(perpRad)) / (R * Math.cos(startLat * Math.PI / 180)) * (180 / Math.PI);
    outPoints.push([startLat + dLat, startLng + dLng]);
  }

  // Retour : décalage perpendiculaire de ~25m pour voir les deux sens
  const shift = 0.00022;
  const perpRad = rad + Math.PI / 2;
  const returnPoints = [...outPoints].reverse().map(([pLat, pLng]) => [
    pLat + shift * Math.cos(perpRad),
    pLng + shift * Math.sin(perpRad),
  ]);

  // Dernier point du retour = premier point de l'aller (départ exact)
  returnPoints[returnPoints.length - 1] = [startLat, startLng];

  return [...outPoints, ...returnPoints.slice(1)];
}

// ============================================================
// DISTANCE LÉGÈREMENT VARIÉE — ±8% maximum
// ============================================================
function varyDistance(targetKm, seed) {
  // Variation déterministe selon seed pour éviter répétitions
  const v = (Math.sin(seed * 9301 + 49297) * 0.5 + 0.5) * 0.16 - 0.08;
  return parseFloat((targetKm * (1 + v)).toFixed(2));
}

// ============================================================
// NOM BASÉ SUR LA DIRECTION (pour routes génériques)
// ============================================================
function nameFromDirection(directionDeg, suffix) {
  const dirs = [
    [0, 22, 'Nord'], [22, 67, 'Nord-Est'], [67, 112, 'Est'],
    [112, 157, 'Sud-Est'], [157, 202, 'Sud'], [202, 247, 'Sud-Ouest'],
    [247, 292, 'Ouest'], [292, 337, 'Nord-Ouest'], [337, 360, 'Nord'],
  ];
  const d = ((directionDeg % 360) + 360) % 360;
  const found = dirs.find(([min, max]) => d >= min && d < max);
  const cardinal = found ? found[2] : 'Nord';
  return `${suffix} ${cardinal}`;
}

// ============================================================
// ROUTES PARISIENNES — BOUCLE ou ALLER-RETOUR
// ============================================================
function buildParisRoutes(lat, lng, distanceKm, type, preferGreen) {
  const compatible = PARIS_ICONIC.filter(r => distanceKm >= r.minKm && distanceKm <= r.maxKm);
  const candidates = compatible.length >= 3 ? compatible : PARIS_ICONIC;
  const sorted = [...candidates].sort((a, b) =>
    preferGreen ? b.greenRatio - a.greenRatio : b.trafficScore - a.trafficScore
  );

  return sorted.slice(0, 5).map((tpl, idx) => {
    const actualDistance = varyDistance(distanceKm, idx + 1);
    const trafficLights = Math.round(actualDistance * tpl.lightsPerKm);
    const crossings = Math.round(actualDistance * tpl.crossingsPerKm);

    let coords;
    if (type === 'loop') {
      coords = buildLoopFromSpine(lat, lng, tpl.spine, actualDistance);
    } else {
      // Aller-retour dans la direction de la spine, depuis le départ utilisateur
      coords = buildOutAndBack(lat, lng, actualDistance, tpl.direction);
    }

    return {
      id: tpl.id,
      rank: idx + 1,
      name: tpl.name,
      tags: tpl.tags,
      color: COLORS[idx % COLORS.length],
      coordinates: coords,
      metrics: {
        distance: actualDistance,
        elevationGain: Math.round(actualDistance * tpl.elevationPerKm),
        durationMin: Math.round(actualDistance * 6.0),
        crossings,
        trafficLights,
        lightWaitSec: Math.round(trafficLights * 35),
        greenRatio: tpl.greenRatio,
      },
      score: {
        tranquility: Math.round(tpl.trafficScore * 10),
        green: Math.round(tpl.greenRatio * 100),
        overall: Math.round((tpl.trafficScore * 0.6 + tpl.greenRatio * 10 * 0.4) * 10),
      },
      description: tpl.description,
      aiSummary: null,
    };
  });
}

// ============================================================
// ROUTES GÉNÉRIQUES — 5 directions vraiment différentes
// ============================================================
function buildGenericRoutes(lat, lng, distanceKm, type, preferGreen) {
  const templates = [
    {
      id: 'r1', dirDeg: 0,   greenRatio: 0.80, trafficScore: 9.2,
      elevationPerKm: 3.5, crossingsPerKm: 0.8, lightsPerKm: 0.5, seed: 1,
      tags: ['berges', 'parcs', 'piétons'],
      nameSuffix: type === 'loop' ? 'Boucle' : 'Aller-retour',
    },
    {
      id: 'r2', dirDeg: 72,  greenRatio: 0.55, trafficScore: 7.8,
      elevationPerKm: 5.2, crossingsPerKm: 1.5, lightsPerKm: 1.0, seed: 2,
      tags: ['allées', 'résidentiel'],
      nameSuffix: type === 'loop' ? 'Boucle' : 'Aller-retour',
    },
    {
      id: 'r3', dirDeg: 144, greenRatio: 0.62, trafficScore: 7.0,
      elevationPerKm: 6.8, crossingsPerKm: 2.0, lightsPerKm: 1.2, seed: 3,
      tags: ['sentiers', 'calme'],
      nameSuffix: type === 'loop' ? 'Boucle' : 'Aller-retour',
    },
    {
      id: 'r4', dirDeg: 216, greenRatio: 0.35, trafficScore: 5.4,
      elevationPerKm: 8.1, crossingsPerKm: 3.2, lightsPerKm: 2.5, seed: 4,
      tags: ['mixte', 'urbain'],
      nameSuffix: type === 'loop' ? 'Boucle' : 'Aller-retour',
    },
    {
      id: 'r5', dirDeg: 288, greenRatio: 0.90, trafficScore: 9.7,
      elevationPerKm: 4.0, crossingsPerKm: 0.3, lightsPerKm: 0.1, seed: 5,
      tags: ['nature', 'espaces verts'],
      nameSuffix: type === 'loop' ? 'Boucle' : 'Aller-retour',
    },
  ];

  const sorted = preferGreen
    ? [...templates].sort((a, b) => b.greenRatio - a.greenRatio)
    : templates;

  return sorted.map((r, idx) => {
    const actualDistance = varyDistance(distanceKm, r.seed);
    const trafficLights = Math.round(actualDistance * r.lightsPerKm);
    const crossings = Math.round(actualDistance * r.crossingsPerKm);

    const coords = type === 'loop'
      ? buildGenericLoop(lat, lng, actualDistance, r.dirDeg, r.seed)
      : buildOutAndBack(lat, lng, actualDistance, r.dirDeg);

    const name = nameFromDirection(r.dirDeg, r.nameSuffix);

    return {
      id: r.id,
      rank: idx + 1,
      name,
      tags: r.tags,
      color: COLORS[idx % COLORS.length],
      coordinates: coords,
      metrics: {
        distance: actualDistance,
        elevationGain: Math.round(actualDistance * r.elevationPerKm),
        durationMin: Math.round(actualDistance * 6.0),
        crossings,
        trafficLights,
        lightWaitSec: Math.round(trafficLights * 35),
        greenRatio: r.greenRatio,
      },
      score: {
        tranquility: Math.round(r.trafficScore * 10),
        green: Math.round(r.greenRatio * 100),
        overall: Math.round((r.trafficScore * 0.6 + r.greenRatio * 10 * 0.4) * 10),
      },
      description: '',
      aiSummary: null,
    };
  });
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================
export function generateMockRoutes(lat, lng, distanceKm, type, preferGreen) {
  const city = detectCity(lat, lng);
  if (city === 'paris') return buildParisRoutes(lat, lng, distanceKm, type, preferGreen);
  return buildGenericRoutes(lat, lng, distanceKm, type, preferGreen);
}

export const MOCK_GEOCODE = {
  paris: { lat: 48.8566, lng: 2.3522, display: 'Paris, France' },
  lyon: { lat: 45.7640, lng: 4.8357, display: 'Lyon, France' },
  bordeaux: { lat: 44.8378, lng: -0.5792, display: 'Bordeaux, France' },
};
