/**
 * RunRouteAI — mockData v4
 * Fixes:
 *  - Aller-retour: 5 directions VRAIMENT différentes (72° d'écart chacune)
 *  - Distance: jamais multipliée par 2, variation max ±6%
 *  - Noms: toponymes réels (Paris) ou "direction + type terrain"
 *  - Couleurs: palette sobre et lisible
 * New:
 *  - Lieux alternatifs (parcs/bois accessibles en TC) pour "Démarrer ailleurs"
 */

// Palette sobre — ni fluo ni terne
const COLORS = ['#2563eb','#15803d','#b45309','#6d28d9','#0e7490'];

// ============================================================
// HAVERSINE
// ============================================================
function haversine(a, b) {
  const R = 6371;
  const dLat = (b[0]-a[0])*Math.PI/180;
  const dLng = (b[1]-a[1])*Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

// Déplace un point de d km dans la direction angleDeg
function movePoint(lat, lng, dKm, angleDeg) {
  const R = 6371;
  const rad = angleDeg * Math.PI / 180;
  return [
    lat  + (dKm * Math.cos(rad)) / R * (180/Math.PI),
    lng  + (dKm * Math.sin(rad)) / (R * Math.cos(lat*Math.PI/180)) * (180/Math.PI),
  ];
}

// ============================================================
// BOUCLE (inchangée, fonctionne bien)
// ============================================================
function buildGenericLoop(lat, lng, targetKm, offsetAngle, seed) {
  const R = 6371;
  const radius = targetKm / (2*Math.PI);
  const pts = 20;
  const noise = i => { const x=Math.sin(i*127.1+seed*311.7)*43758.5453; return (x-Math.floor(x))*2-1; };
  const coords = [];
  for (let i=0;i<pts;i++) {
    const angle = (i/pts)*2*Math.PI + offsetAngle*Math.PI/180;
    const r = radius*(0.88 + noise(i)*0.10 + 0.12);
    coords.push([
      lat  + (r*Math.cos(angle))/R*(180/Math.PI),
      lng  + (r*Math.sin(angle))/(R*Math.cos(lat*Math.PI/180))*(180/Math.PI),
    ]);
  }
  coords.push([coords[0][0], coords[0][1]]);
  return coords;
}

// Boucle depuis une spine connue (Paris)
function buildLoopFromSpine(lat, lng, spine, targetKm) {
  let closestIdx=0, closestDist=Infinity;
  spine.forEach(([sLat,sLng],i) => {
    const d = haversine([lat,lng],[sLat,sLng]);
    if (d<closestDist) { closestDist=d; closestIdx=i; }
  });
  let spineLen=0;
  for (let i=1;i<spine.length;i++) spineLen+=haversine(spine[i-1],spine[i]);
  const fraction = Math.min(1,Math.max(0.3,(targetKm-closestDist*2)/Math.max(spineLen,0.1)));
  const coords = [[lat,lng]];
  for (let i=1;i<=4;i++) {
    const t=i/4;
    coords.push([lat+t*(spine[closestIdx][0]-lat), lng+t*(spine[closestIdx][1]-lng)]);
  }
  const nPts = Math.round(fraction*(spine.length-1));
  for (let i=closestIdx+1;i<=Math.min(closestIdx+nPts,spine.length-1);i++) coords.push([...spine[i]]);
  const last = coords[coords.length-1];
  for (let i=1;i<6;i++) {
    const t=i/6;
    coords.push([last[0]+t*(lat-last[0])+Math.sin(t*Math.PI)*0.003, last[1]+t*(lng-last[1])]);
  }
  coords.push([lat,lng]);
  return coords;
}

// ============================================================
// ALLER-RETOUR — vraiment 5 directions différentes
// Règle: totalDistance = aller + retour = targetKm
//        => point de rebroussement à targetKm/2 du départ
// ============================================================
function buildOutAndBack(lat, lng, targetKm, directionDeg) {
  const halfKm = targetKm / 2;  // distance jusqu'au point le + loin
  const steps = 14;
  const out = [];

  for (let i=0;i<=steps;i++) {
    const t = i/steps;
    const dKm = t * halfKm;
    // Légère sinusoïde latérale pour simuler des rues (±4% de la demi-distance)
    const lateralKm = Math.sin(t*Math.PI) * halfKm * 0.04;
    const lateralDeg = directionDeg + 90;
    const mid = movePoint(lat, lng, dKm, directionDeg);
    const pt  = movePoint(mid[0], mid[1], lateralKm, lateralDeg);
    out.push(pt);
  }

  // Retour: même points en sens inverse + décalage latéral de 20m
  const SHIFT_KM = 0.020; // 20 mètres
  const ret = [...out].reverse().map(([pLat,pLng]) => {
    const shifted = movePoint(pLat, pLng, SHIFT_KM, directionDeg+90);
    return shifted;
  });
  // Le dernier point du retour doit être exactement le point de départ
  ret[ret.length-1] = [lat, lng];

  return [...out, ...ret.slice(1)];
}

// ============================================================
// VARIATION DE DISTANCE — max ±6%, déterministe
// ============================================================
function varyDistance(targetKm, seed) {
  const v = (Math.sin(seed*9301+49297)*0.5+0.5)*0.12 - 0.06;
  return parseFloat((targetKm*(1+v)).toFixed(2));
}

// ============================================================
// CARDINALITÉ
// ============================================================
function cardinal(deg) {
  const d = ((deg%360)+360)%360;
  const names = ['Nord','Nord-Est','Est','Sud-Est','Sud','Sud-Ouest','Ouest','Nord-Ouest'];
  return names[Math.round(d/45)%8];
}

// ============================================================
// DÉTECTION VILLE
// ============================================================
function detectCity(lat,lng) {
  if (lat>48.78&&lat<48.92&&lng>2.20&&lng<2.50) return 'paris';
  return null;
}

// ============================================================
// LIEUX ALTERNATIFS — accessibles en TC/vélo depuis Paris
// "Démarrer ailleurs"
// ============================================================
export const ALTERNATIVE_STARTING_POINTS = {
  paris: [
    { id:'bois-boulogne', name:'Bois de Boulogne', address:'Porte Maillot, 75116 Paris', lat:48.8640, lng:2.2490, tags:['forêt','lacs','16e'], transport:'Métro ligne 1 — Porte Maillot', minKm:5, maxKm:42, color:'#15803d' },
    { id:'bois-vincennes', name:'Bois de Vincennes', address:'Porte Dorée, 75012 Paris', lat:48.8380, lng:2.4390, tags:['forêt','château','12e'], transport:'Métro ligne 8 — Porte Dorée', minKm:4, maxKm:30, color:'#15803d' },
    { id:'parc-montsouris', name:'Parc Montsouris', address:'Av. Reille, 75014 Paris', lat:48.8216, lng:2.3392, tags:['parc','étang','14e'], transport:'RER B — Cité Universitaire', minKm:2, maxKm:8, color:'#15803d' },
    { id:'canal-ourcq', name:'Canal de l\'Ourcq', address:'Parc de la Villette, 75019 Paris', lat:48.8940, lng:2.3870, tags:['canal','berges','19e'], transport:'Métro ligne 5 — Porte de Pantin', minKm:4, maxKm:20, color:'#0e7490' },
    { id:'coulée-verte', name:'Coulée Verte (Promenade Plantée)', address:'Avenue Daumesnil, 75012 Paris', lat:48.8507, lng:2.3840, tags:['jardin suspendu','12e'], transport:'Métro ligne 1 — Bastille', minKm:2, maxKm:9, color:'#15803d' },
    { id:'buttes-chaumont', name:'Parc des Buttes-Chaumont', address:'Rue Botzaris, 75019 Paris', lat:48.8800, lng:2.3830, tags:['parc','collines','19e'], transport:'Métro ligne 7bis — Buttes Chaumont', minKm:2, maxKm:8, color:'#15803d' },
    { id:'saint-cloud', name:'Parc de Saint-Cloud', address:'Domaine national, 92210 Saint-Cloud', lat:48.8380, lng:2.2120, tags:['parc royal','vues','hauts-de-seine'], transport:'Transilien L — Garches-La-Barbière', minKm:5, maxKm:20, color:'#6d28d9' },
    { id:'versailles', name:'Parc de Versailles', address:'Château de Versailles, 78000 Versailles', lat:48.8049, lng:2.1204, tags:['parc royal','grands espaces'], transport:'RER C — Versailles Rive Gauche', minKm:5, maxKm:25, color:'#6d28d9' },
  ],
};

// ============================================================
// ITINÉRAIRES PARISIENS ICONIQUES (pour boucles)
// ============================================================
const PARIS_ICONIC = [
  {
    id:'quais-seine', name:'Quais de Seine', tags:['berges','piétons','sans voitures'],
    greenRatio:0.93, trafficScore:9.8, elevationPerKm:1.5, crossingsPerKm:0.3, lightsPerKm:0.2,
    spine:[[48.8534,2.3488],[48.8567,2.3412],[48.8606,2.3335],[48.8638,2.3218],[48.8647,2.3143],[48.8601,2.2944]],
    loopDir:270, minKm:3, maxKm:20,
    description:'Les berges piétonnes de la Seine. Quasi zéro voiture.',
  },
  {
    id:'coulee-verte', name:'Coulée Verte', tags:['promenade plantée','sans voitures'],
    greenRatio:0.97, trafficScore:9.9, elevationPerKm:2, crossingsPerKm:0.1, lightsPerKm:0.1,
    spine:[[48.8533,2.3693],[48.8507,2.3840],[48.8479,2.4012],[48.8447,2.4178],[48.8431,2.4260]],
    loopDir:120, minKm:2, maxKm:12,
    description:'L\'ancienne voie ferrée en jardin suspendu de 4,5 km.',
  },
  {
    id:'bois-boulogne', name:'Bois de Boulogne', tags:['forêt','sentiers','lacs'],
    greenRatio:0.98, trafficScore:9.7, elevationPerKm:4, crossingsPerKm:0.2, lightsPerKm:0.1,
    spine:[[48.8670,2.2490],[48.8590,2.2350],[48.8470,2.2320],[48.8380,2.2450],[48.8360,2.2560]],
    loopDir:200, minKm:5, maxKm:42,
    description:'8 km² de sentiers, lacs et allées cavalières.',
  },
  {
    id:'canal-saint-martin', name:'Canal Saint-Martin', tags:['canal','écluses'],
    greenRatio:0.72, trafficScore:8.2, elevationPerKm:1, crossingsPerKm:0.8, lightsPerKm:0.5,
    spine:[[48.8697,2.3626],[48.8738,2.3657],[48.8785,2.3682],[48.8840,2.3710],[48.8870,2.3730]],
    loopDir:10, minKm:3, maxKm:15,
    description:'Les écluses et péniches du canal Saint-Martin.',
  },
  {
    id:'bois-vincennes', name:'Bois de Vincennes', tags:['forêt','château','lacs'],
    greenRatio:0.96, trafficScore:9.5, elevationPerKm:3, crossingsPerKm:0.2, lightsPerKm:0.1,
    spine:[[48.8431,2.4260],[48.8360,2.4390],[48.8280,2.4520],[48.8250,2.4600],[48.8280,2.4680]],
    loopDir:130, minKm:4, maxKm:30,
    description:'Le plus grand bois de Paris. Lacs et 35 km de chemins.',
  },
  {
    id:'champ-de-mars', name:'Champ de Mars – Invalides', tags:['monument','pelouses'],
    greenRatio:0.70, trafficScore:8.5, elevationPerKm:2, crossingsPerKm:1.2, lightsPerKm:0.8,
    spine:[[48.8556,2.2986],[48.8540,2.2980],[48.8520,2.3070],[48.8574,2.3130],[48.8638,2.3143]],
    loopDir:80, minKm:4, maxKm:15,
    description:'Du Champ de Mars aux Invalides. Vues Tour Eiffel garanties.',
  },
];

// ============================================================
// TEMPLATES GÉNÉRIQUES ALLER-RETOUR
// 5 directions espacées de 72° exactement → toutes différentes
// ============================================================
const OUT_AND_BACK_TEMPLATES = [
  { id:'oab-0',  dir:0,   greenRatio:0.80, trafficScore:9.1, elevationPerKm:3.0, crossingsPerKm:0.6, lightsPerKm:0.4, tags:['berges','parcs'], seed:11 },
  { id:'oab-72', dir:72,  greenRatio:0.55, trafficScore:7.5, elevationPerKm:5.0, crossingsPerKm:1.5, lightsPerKm:1.0, tags:['allées','résidentiel'], seed:22 },
  { id:'oab-144',dir:144, greenRatio:0.65, trafficScore:7.2, elevationPerKm:6.0, crossingsPerKm:1.8, lightsPerKm:1.1, tags:['sentiers','calme'], seed:33 },
  { id:'oab-216',dir:216, greenRatio:0.38, trafficScore:5.5, elevationPerKm:7.5, crossingsPerKm:3.0, lightsPerKm:2.2, tags:['mixte','urbain'], seed:44 },
  { id:'oab-288',dir:288, greenRatio:0.88, trafficScore:9.5, elevationPerKm:4.0, crossingsPerKm:0.3, lightsPerKm:0.1, tags:['nature','espaces verts'], seed:55 },
];

// ============================================================
// TEMPLATES GÉNÉRIQUES BOUCLE (5 orientations différentes)
// ============================================================
const LOOP_TEMPLATES = [
  { id:'loop-0',  angle:0,   greenRatio:0.80, trafficScore:9.2, elevationPerKm:3.5, crossingsPerKm:0.8, lightsPerKm:0.5, tags:['berges','parcs'], seed:1 },
  { id:'loop-72', angle:72,  greenRatio:0.55, trafficScore:7.8, elevationPerKm:5.2, crossingsPerKm:1.5, lightsPerKm:1.0, tags:['allées','résidentiel'], seed:2 },
  { id:'loop-144',angle:144, greenRatio:0.62, trafficScore:7.0, elevationPerKm:6.8, crossingsPerKm:2.0, lightsPerKm:1.2, tags:['sentiers','calme'], seed:3 },
  { id:'loop-216',angle:216, greenRatio:0.35, trafficScore:5.4, elevationPerKm:8.1, crossingsPerKm:3.2, lightsPerKm:2.5, tags:['mixte','urbain'], seed:4 },
  { id:'loop-288',angle:288, greenRatio:0.90, trafficScore:9.7, elevationPerKm:4.0, crossingsPerKm:0.3, lightsPerKm:0.1, tags:['nature','espaces verts'], seed:5 },
];

// ============================================================
// TERRAIN → NOM LISIBLE
// ============================================================
function terrainName(tags, greenRatio) {
  if (tags.includes('berges') || tags.includes('canal')) return 'Berges';
  if (tags.includes('forêt') || tags.includes('nature') || tags.includes('espaces verts')) return 'Nature';
  if (tags.includes('sentiers') || tags.includes('calme')) return 'Sentiers';
  if (tags.includes('allées') || tags.includes('résidentiel')) return 'Quartier résidentiel';
  if (tags.includes('urbain') || tags.includes('mixte')) return 'Centre-ville';
  return greenRatio >= 0.7 ? 'Parcs' : 'Urbain';
}

// ============================================================
// BUILDER COMMUN
// ============================================================
function buildRoute(id, name, tags, color, coords, distKm, tpl) {
  const lights   = Math.round(distKm * tpl.lightsPerKm);
  const crossings= Math.round(distKm * tpl.crossingsPerKm);
  return {
    id, rank:1, name, tags, color, coordinates:coords,
    metrics:{
      distance: distKm,
      elevationGain: Math.round(distKm * tpl.elevationPerKm),
      durationMin: Math.round(distKm * 6.0),
      crossings, trafficLights:lights,
      lightWaitSec: Math.round(lights*35),
      greenRatio: tpl.greenRatio,
    },
    score:{
      tranquility: Math.round(tpl.trafficScore*10),
      green: Math.round(tpl.greenRatio*100),
      overall: Math.round((tpl.trafficScore*0.6 + tpl.greenRatio*10*0.4)*10),
    },
    description: tpl.description || '',
    aiSummary: null,
  };
}

// ============================================================
// PARIS — BOUCLES
// ============================================================
function buildParisLoops(lat, lng, distanceKm, preferGreen) {
  const candidates = PARIS_ICONIC.filter(r => distanceKm>=r.minKm && distanceKm<=r.maxKm);
  const pool = candidates.length>=3 ? candidates : PARIS_ICONIC;
  const sorted = [...pool].sort((a,b)=> preferGreen ? b.greenRatio-a.greenRatio : b.trafficScore-a.trafficScore);

  return sorted.slice(0,5).map((tpl,idx) => {
    const dist = varyDistance(distanceKm, idx+10);
    const coords = buildLoopFromSpine(lat, lng, tpl.spine, dist);
    const r = buildRoute(tpl.id, tpl.name, tpl.tags, COLORS[idx%COLORS.length], coords, dist, tpl);
    r.description = tpl.description;
    return r;
  });
}

// ============================================================
// PARIS — ALLER-RETOURS
// Chaque template a une direction différente → 5 tracés uniques
// ============================================================
function buildParisOutAndBack(lat, lng, distanceKm, preferGreen) {
  // On associe chaque lieu iconique à UNE direction fixe différente
  const PARIS_OAB = [
    { ...PARIS_ICONIC[0], dir:270 }, // Quais Seine → Ouest (vers Tour Eiffel)
    { ...PARIS_ICONIC[3], dir:10  }, // Canal SM  → Nord
    { ...PARIS_ICONIC[1], dir:110 }, // Coulée V  → Sud-Est
    { ...PARIS_ICONIC[4], dir:130 }, // Bois Vinc → Est-Sud-Est
    { ...PARIS_ICONIC[5], dir:250 }, // Champ Mars→ Sud-Ouest
  ];

  const candidates = PARIS_OAB.filter(r => distanceKm>=r.minKm && distanceKm<=r.maxKm);
  const pool = candidates.length>=3 ? candidates : PARIS_OAB;
  const sorted = [...pool].sort((a,b)=> preferGreen ? b.greenRatio-a.greenRatio : b.trafficScore-a.trafficScore);

  return sorted.slice(0,5).map((tpl,idx) => {
    const dist = varyDistance(distanceKm, idx+20);
    // Direction UNIQUE par itinéraire — pas de doublon
    const coords = buildOutAndBack(lat, lng, dist, tpl.dir);
    const r = buildRoute(tpl.id+'-oab', tpl.name, tpl.tags, COLORS[idx%COLORS.length], coords, dist, tpl);
    r.description = tpl.description;
    return r;
  });
}

// ============================================================
// GÉNÉRIQUE — BOUCLES
// ============================================================
function buildGenericLoops(lat, lng, distanceKm, preferGreen) {
  const sorted = preferGreen
    ? [...LOOP_TEMPLATES].sort((a,b)=>b.greenRatio-a.greenRatio)
    : LOOP_TEMPLATES;

  return sorted.map((tpl,idx) => {
    const dist = varyDistance(distanceKm, tpl.seed);
    const coords = buildGenericLoop(lat, lng, dist, tpl.angle, tpl.seed);
    const terrain = terrainName(tpl.tags, tpl.greenRatio);
    const name = `Boucle ${terrain} ${cardinal(tpl.angle)}`;
    return buildRoute(tpl.id, name, tpl.tags, COLORS[idx%COLORS.length], coords, dist, tpl);
  });
}

// ============================================================
// GÉNÉRIQUE — ALLER-RETOURS
// ============================================================
function buildGenericOutAndBack(lat, lng, distanceKm, preferGreen) {
  const sorted = preferGreen
    ? [...OUT_AND_BACK_TEMPLATES].sort((a,b)=>b.greenRatio-a.greenRatio)
    : OUT_AND_BACK_TEMPLATES;

  return sorted.map((tpl,idx) => {
    const dist = varyDistance(distanceKm, tpl.seed);
    const coords = buildOutAndBack(lat, lng, dist, tpl.dir);
    const terrain = terrainName(tpl.tags, tpl.greenRatio);
    const name = `Aller-retour ${terrain} ${cardinal(tpl.dir)}`;
    return buildRoute(tpl.id, name, tpl.tags, COLORS[idx%COLORS.length], coords, dist, tpl);
  });
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================
export function generateMockRoutes(lat, lng, distanceKm, type, preferGreen) {
  const city = detectCity(lat, lng);
  if (city === 'paris') {
    return type === 'loop'
      ? buildParisLoops(lat, lng, distanceKm, preferGreen)
      : buildParisOutAndBack(lat, lng, distanceKm, preferGreen);
  }
  return type === 'loop'
    ? buildGenericLoops(lat, lng, distanceKm, preferGreen)
    : buildGenericOutAndBack(lat, lng, distanceKm, preferGreen);
}

export const MOCK_GEOCODE = {
  paris:    { lat:48.8566, lng:2.3522, display:'Paris, France' },
  lyon:     { lat:45.7640, lng:4.8357, display:'Lyon, France' },
  bordeaux: { lat:44.8378, lng:-0.5792, display:'Bordeaux, France' },
};
