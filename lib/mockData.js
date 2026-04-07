/**
 * RunRouteAI — Données mock améliorées
 * - Vraies boucles fermées (dernier point = premier point exact)
 * - Itinéraires parisiens iconiques avec coordonnées réelles
 * - Tolérance distance ±15% (ex: 10km → entre 8.5 et 11.5km)
 * - Détection automatique de la ville (Paris, Lyon, Bordeaux...)
 */

// ============================================================
// ITINÉRAIRES PARISIENS ICONIQUES — coordonnées GPS réelles
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
    color: '#22c55e',
    description: 'Les berges piétonnes rive gauche et rive droite, le parcours iconique parisien. Quasi zéro voiture.',
    spine: [
      [48.8534, 2.3488],
      [48.8551, 2.3441],
      [48.8567, 2.3412],
      [48.8591, 2.3380],
      [48.8606, 2.3335],
      [48.8623, 2.3273],
      [48.8638, 2.3218],
      [48.8647, 2.3143],
      [48.8632, 2.3010],
      [48.8601, 2.2944],
    ],
    minKm: 3,
    maxKm: 20,
    center: [48.8600, 2.3200],
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
    color: '#10b981',
    description: "L'ancienne voie ferrée reconvertie en jardin suspendu de 4,5 km. Le paradis du coureur urbain.",
    spine: [
      [48.8533, 2.3693],
      [48.8520, 2.3760],
      [48.8507, 2.3840],
      [48.8493, 2.3928],
      [48.8479, 2.4012],
      [48.8463, 2.4095],
      [48.8447, 2.4178],
      [48.8431, 2.4260],
    ],
    minKm: 2,
    maxKm: 12,
    center: [48.849, 2.397],
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
    color: '#16a34a',
    description: 'Le poumon vert de Paris : 8 km² de sentiers variés, lacs et allées cavalières. Idéal pour le trail.',
    spine: [
      [48.8670, 2.2490],
      [48.8640, 2.2420],
      [48.8590, 2.2350],
      [48.8530, 2.2290],
      [48.8470, 2.2320],
      [48.8420, 2.2380],
      [48.8380, 2.2450],
      [48.8360, 2.2560],
      [48.8400, 2.2640],
      [48.8460, 2.2590],
    ],
    minKm: 5,
    maxKm: 42,
    center: [48.850, 2.245],
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
    color: '#0891b2',
    description: 'Les écluses romantiques et péniches du canal Saint-Martin, ambiance bohème garantie.',
    spine: [
      [48.8697, 2.3626],
      [48.8716, 2.3641],
      [48.8738, 2.3657],
      [48.8762, 2.3669],
      [48.8785, 2.3682],
      [48.8810, 2.3695],
      [48.8840, 2.3710],
      [48.8870, 2.3730],
    ],
    minKm: 3,
    maxKm: 15,
    center: [48.878, 2.367],
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
    color: '#15803d',
    description: 'Le plus grand bois de Paris côté est. Lacs, château et 35 km de chemins forestiers.',
    spine: [
      [48.8431, 2.4260],
      [48.8400, 2.4330],
      [48.8360, 2.4390],
      [48.8320, 2.4450],
      [48.8280, 2.4520],
      [48.8250, 2.4600],
      [48.8280, 2.4680],
      [48.8330, 2.4620],
    ],
    minKm: 4,
    maxKm: 30,
    center: [48.835, 2.448],
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
    color: '#84cc16',
    description: 'Du Champ de Mars aux Invalides en passant par le Trocadéro. Vues sur la Tour Eiffel garanties.',
    spine: [
      [48.8556, 2.2986],
      [48.8570, 2.2960],
      [48.8540, 2.2980],
      [48.8510, 2.3000],
      [48.8520, 2.3070],
      [48.8545, 2.3120],
      [48.8574, 2.3130],
      [48.8601, 2.3140],
      [48.8638, 2.3143],
    ],
    minKm: 4,
    maxKm: 15,
    center: [48.856, 2.307],
  },
];

// ============================================================
// DÉTECTION DE VILLE
// ============================================================
function detectCity(lat, lng) {
  if (lat > 48.78 && lat < 48.92 && lng > 2.20 && lng < 2.50) return 'paris';
  if (lat > 45.70 && lat < 45.82 && lng > 4.77 && lng < 4.90) return 'lyon';
  if (lat > 44.78 && lat < 44.90 && lng > -0.65 && lng < -0.52) return 'bordeaux';
  if (lat > 43.26 && lat < 43.34 && lng > 5.32 && lng < 5.42) return 'marseille';
  return null;
}

// ============================================================
// CONSTRUCTION D'UNE VRAIE BOUCLE depuis une spine GPS
// ============================================================
function haversine(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function buildLoopFromSpine(startLat, startLng, spine, targetKm) {
  // Trouver le point de la spine le plus proche du départ utilisateur
  let closestIdx = 0;
  let closestDist = Infinity;
  spine.forEach(([sLat, sLng], i) => {
    const d = haversine([startLat, startLng], [sLat, sLng]);
    if (d < closestDist) { closestDist = d; closestIdx = i; }
  });

  // Longueur de la spine
  let spineLen = 0;
  for (let i = 1; i < spine.length; i++) spineLen += haversine(spine[i-1], spine[i]);

  const distToSpine = closestDist;
  const availableForSpine = targetKm - distToSpine * 2;
  const spineUseFraction = Math.min(1, Math.max(0.3, availableForSpine / Math.max(spineLen, 0.1)));

  const coords = [[startLat, startLng]];

  // Interpolation vers la spine
  const stepsToSpine = 4;
  for (let i = 1; i <= stepsToSpine; i++) {
    const t = i / stepsToSpine;
    coords.push([
      startLat + t * (spine[closestIdx][0] - startLat),
      startLng + t * (spine[closestIdx][1] - startLng),
    ]);
  }

  // Parcourir la spine
  const spinePoints = Math.round(spineUseFraction * (spine.length - 1));
  for (let i = closestIdx + 1; i <= Math.min(closestIdx + spinePoints, spine.length - 1); i++) {
    coords.push([...spine[i]]);
  }

  // Retour vers le départ
  const lastOnSpine = coords[coords.length - 1];
  const returnSteps = 6;
  for (let i = 1; i < returnSteps; i++) {
    const t = i / returnSteps;
    const latOffset = Math.sin(t * Math.PI) * 0.003;
    coords.push([
      lastOnSpine[0] + t * (startLat - lastOnSpine[0]) + latOffset,
      lastOnSpine[1] + t * (startLng - lastOnSpine[1]),
    ]);
  }

  // Fermeture exacte
  coords.push([startLat, startLng]);
  return coords;
}

// ============================================================
// GÉNÉRATION DE BOUCLE GÉNÉRIQUE
// ============================================================
function generateTrueLoop(centerLat, centerLng, targetKm, offsetAngle, seed) {
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
    const variation = 0.88 + noise(i) * 0.12 + 0.12;
    const r = radius * variation;
    const dLat = (r * Math.cos(angle)) / R * (180 / Math.PI);
    const dLng = (r * Math.sin(angle)) / (R * Math.cos(centerLat * Math.PI / 180)) * (180 / Math.PI);
    coords.push([centerLat + dLat, centerLng + dLng]);
  }

  // Fermeture exacte
  coords.push([coords[0][0], coords[0][1]]);
  return coords;
}

// ============================================================
// GÉNÉRATION ALLER-RETOUR
// ============================================================
function generateOutAndBack(centerLat, centerLng, targetKm, angle) {
  const R = 6371;
  const rad = angle * Math.PI / 180;
  const halfDist = targetKm / 2;
  const steps = 10;

  const outPoints = [];
  for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * halfDist;
    const perpOffset = Math.sin(i / steps * Math.PI) * halfDist * 0.05;
    const perpRad = rad + Math.PI / 2;
    const dLat = (d * Math.cos(rad) + perpOffset * Math.cos(perpRad)) / R * (180 / Math.PI);
    const dLng = (d * Math.sin(rad) + perpOffset * Math.sin(perpRad)) / (R * Math.cos(centerLat * Math.PI / 180)) * (180 / Math.PI);
    outPoints.push([centerLat + dLat, centerLng + dLng]);
  }

  // Retour avec léger décalage pour visualiser les deux sens
  const shift = 0.00018;
  const returnPoints = [...outPoints].reverse().map(([pLat, pLng]) => [
    pLat + shift * Math.cos(rad + Math.PI/2),
    pLng + shift * Math.sin(rad + Math.PI/2),
  ]);

  return [...outPoints, ...returnPoints.slice(1)];
}

// ============================================================
// DISTANCE AJUSTÉE ±15%
// ============================================================
function clampDistance(targetKm) {
  const variation = (Math.random() - 0.5) * 0.24; // ±12%
  return parseFloat((targetKm * (1 + variation)).toFixed(2));
}

// ============================================================
// ROUTES PARISIENNES
// ============================================================
function buildParisRoutes(lat, lng, distanceKm, type, preferGreen) {
  const compatible = PARIS_ICONIC.filter(r => distanceKm >= r.minKm && distanceKm <= r.maxKm);
  const candidates = compatible.length >= 3 ? compatible : PARIS_ICONIC;

  const sorted = [...candidates].sort((a, b) =>
    preferGreen ? b.greenRatio - a.greenRatio : b.trafficScore - a.trafficScore
  );

  return sorted.slice(0, 5).map((template, idx) => {
    const actualDistance = clampDistance(distanceKm);
    const pace = 6.0;
    const trafficLights = Math.round(actualDistance * template.lightsPerKm);
    const crossings = Math.round(actualDistance * template.crossingsPerKm);

    const coords = type === 'loop'
      ? buildLoopFromSpine(lat, lng, template.spine, actualDistance)
      : generateOutAndBack(lat, lng, actualDistance, Math.atan2(
          template.spine[1][0] - template.spine[0][0],
          template.spine[1][1] - template.spine[0][1]
        ) * 180 / Math.PI);

    return {
      id: template.id,
      rank: idx + 1,
      name: template.name,
      tags: template.tags,
      color: template.color,
      coordinates: coords,
      metrics: {
        distance: actualDistance,
        elevationGain: Math.round(actualDistance * template.elevationPerKm),
        durationMin: Math.round(actualDistance * pace),
        crossings,
        trafficLights,
        lightWaitSec: Math.round(trafficLights * 35),
        greenRatio: template.greenRatio,
      },
      score: {
        tranquility: Math.round(template.trafficScore * 10),
        green: Math.round(template.greenRatio * 100),
        overall: Math.round((template.trafficScore * 0.6 + template.greenRatio * 10 * 0.4) * 10),
      },
      description: template.description,
      aiSummary: null,
    };
  });
}

// ============================================================
// ROUTES GÉNÉRIQUES
// ============================================================
function buildGenericRoutes(lat, lng, distanceKm, type, preferGreen) {
  const templates = [
    { id: 'r1', name: 'Parcours des Berges', tags: ['berges', 'parcs', 'piétons'], greenRatio: 0.80, trafficScore: 9.2, elevationPerKm: 3.5, crossingsPerKm: 0.8, lightsPerKm: 0.5, color: '#22c55e', angle: 0, seed: 1 },
    { id: 'r2', name: 'Circuit des Allées', tags: ['allées', 'petites rues'], greenRatio: 0.55, trafficScore: 7.8, elevationPerKm: 5.2, crossingsPerKm: 1.5, lightsPerKm: 1.0, color: '#84cc16', angle: 60, seed: 2 },
    { id: 'r3', name: 'Route Urbaine', tags: ['mixte', 'rues'], greenRatio: 0.35, trafficScore: 5.4, elevationPerKm: 8.1, crossingsPerKm: 3.2, lightsPerKm: 2.5, color: '#f59e0b', angle: 120, seed: 3 },
    { id: 'r4', name: 'Circuit Panoramique', tags: ['vues', 'collines'], greenRatio: 0.62, trafficScore: 7.0, elevationPerKm: 12.5, crossingsPerKm: 2.0, lightsPerKm: 1.2, color: '#06b6d4', angle: 180, seed: 4 },
    { id: 'r5', name: 'Sentier Nature', tags: ['sentiers', 'nature', 'calme'], greenRatio: 0.90, trafficScore: 9.7, elevationPerKm: 6.8, crossingsPerKm: 0.3, lightsPerKm: 0.1, color: '#10b981', angle: 240, seed: 5 },
  ];

  const sorted = preferGreen
    ? [...templates].sort((a, b) => b.greenRatio - a.greenRatio)
    : templates;

  return sorted.map((r, idx) => {
    const actualDistance = clampDistance(distanceKm);
    const pace = 6.0;
    const trafficLights = Math.round(actualDistance * r.lightsPerKm);
    const crossings = Math.round(actualDistance * r.crossingsPerKm);

    const coords = type === 'loop'
      ? generateTrueLoop(lat, lng, actualDistance, r.angle, r.seed)
      : generateOutAndBack(lat, lng, actualDistance, r.angle);

    return {
      id: r.id,
      rank: idx + 1,
      name: r.name,
      tags: r.tags,
      color: r.color,
      coordinates: coords,
      metrics: {
        distance: actualDistance,
        elevationGain: Math.round(actualDistance * r.elevationPerKm),
        durationMin: Math.round(actualDistance * pace),
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
