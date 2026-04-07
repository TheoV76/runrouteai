/**
 * RunRouteAI — mockData v5
 *
 * Logique centrale :
 *   generateMockRoutes() renvoie TOUJOURS un mix boucles + aller-retours,
 *   classés par score. L'appelant n'a plus besoin de passer "type".
 *
 *   generateAlternativeRoutes() renvoie des boucles depuis des parcs/bois
 *   accessibles en TC, avec temps total (TC aller + course + TC retour).
 */

const COLORS = ['#2563eb','#15803d','#b45309','#6d28d9','#0e7490'];

// ─────────────────────────────────────────────────────────────
// GÉO-UTILS
// ─────────────────────────────────────────────────────────────
function haversine(a, b) {
  const R = 6371;
  const dLat = (b[0]-a[0])*Math.PI/180;
  const dLng = (b[1]-a[1])*Math.PI/180;
  const x = Math.sin(dLat/2)**2 +
    Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function movePoint(lat, lng, dKm, angleDeg) {
  const R = 6371;
  const rad = angleDeg*Math.PI/180;
  return [
    lat + (dKm*Math.cos(rad))/R*(180/Math.PI),
    lng + (dKm*Math.sin(rad))/(R*Math.cos(lat*Math.PI/180))*(180/Math.PI),
  ];
}

function cardinal(deg) {
  const names = ['Nord','Nord-Est','Est','Sud-Est','Sud','Sud-Ouest','Ouest','Nord-Ouest'];
  return names[Math.round(((deg%360)+360)%360/45)%8];
}

function varyDistance(targetKm, seed) {
  const v = (Math.sin(seed*9301+49297)*0.5+0.5)*0.10 - 0.05; // ±5%
  return parseFloat((targetKm*(1+v)).toFixed(2));
}

// ─────────────────────────────────────────────────────────────
// TRACÉ — BOUCLE GÉNÉRIQUE
// ─────────────────────────────────────────────────────────────
function buildLoop(lat, lng, targetKm, offsetAngle, seed) {
  const R = 6371;
  const radius = targetKm/(2*Math.PI);
  const noise = i => { const x=Math.sin(i*127.1+seed*311.7)*43758.5453; return (x-Math.floor(x))*2-1; };
  const pts = 20;
  const coords = [];
  for (let i=0;i<pts;i++) {
    const angle = (i/pts)*2*Math.PI + offsetAngle*Math.PI/180;
    const r = radius*(0.86 + noise(i)*0.09 + 0.14);
    coords.push([
      lat + (r*Math.cos(angle))/R*(180/Math.PI),
      lng + (r*Math.sin(angle))/(R*Math.cos(lat*Math.PI/180))*(180/Math.PI),
    ]);
  }
  coords.push([coords[0][0], coords[0][1]]); // fermeture exacte
  return coords;
}

// Boucle le long d'une spine GPS connue
function buildLoopFromSpine(lat, lng, spine, targetKm) {
  // Point le plus proche de l'utilisateur sur la spine
  let ci=0, cd=Infinity;
  spine.forEach(([sLat,sLng],i)=>{ const d=haversine([lat,lng],[sLat,sLng]); if(d<cd){cd=d;ci=i;} });

  let spineLen=0;
  for(let i=1;i<spine.length;i++) spineLen+=haversine(spine[i-1],spine[i]);

  const fraction = Math.min(1,Math.max(0.25,(targetKm-cd*2)/Math.max(spineLen,0.1)));
  const coords = [[lat,lng]];

  // Aller vers la spine
  for(let i=1;i<=4;i++){
    const t=i/4;
    coords.push([lat+t*(spine[ci][0]-lat), lng+t*(spine[ci][1]-lng)]);
  }
  // Suivre la spine
  const nPts = Math.round(fraction*(spine.length-1));
  for(let i=ci+1;i<=Math.min(ci+nPts,spine.length-1);i++) coords.push([...spine[i]]);

  // Retour au départ
  const last = coords[coords.length-1];
  for(let i=1;i<6;i++){
    const t=i/6;
    coords.push([last[0]+t*(lat-last[0])+Math.sin(t*Math.PI)*0.002, last[1]+t*(lng-last[1])]);
  }
  coords.push([lat,lng]);
  return coords;
}

// ─────────────────────────────────────────────────────────────
// TRACÉ — ALLER-RETOUR
// distance totale = targetKm  (aller = targetKm/2, retour = targetKm/2)
// ─────────────────────────────────────────────────────────────
function buildOutAndBack(lat, lng, targetKm, directionDeg) {
  const halfKm = targetKm/2;
  const steps = 14;
  const out = [];

  for(let i=0;i<=steps;i++){
    const t = i/steps;
    const main = movePoint(lat, lng, t*halfKm, directionDeg);
    // sinusoïde latérale légère (4% de la demi-distance)
    const lateral = Math.sin(t*Math.PI)*halfKm*0.04;
    const pt = movePoint(main[0], main[1], lateral, directionDeg+90);
    out.push(pt);
  }

  // Retour : décalage perpendiculaire de 20m pour distinguer les deux sens
  const ret = [...out].reverse().map(([pLat,pLng]) =>
    movePoint(pLat, pLng, 0.020, directionDeg+90)
  );
  ret[ret.length-1] = [lat, lng]; // retour exactement au départ
  return [...out, ...ret.slice(1)];
}

// ─────────────────────────────────────────────────────────────
// BUILDER COMMUN
// ─────────────────────────────────────────────────────────────
function makeRoute(id, name, tags, color, coords, distKm, tpl, routeType) {
  const lights    = Math.round(distKm*tpl.lightsPerKm);
  const crossings = Math.round(distKm*tpl.crossingsPerKm);
  return {
    id, rank:1, name, tags, color, coordinates:coords,
    routeType, // 'loop' | 'outAndBack'
    metrics:{
      distance: distKm,
      elevationGain: Math.round(distKm*tpl.elevationPerKm),
      durationMin: Math.round(distKm*6.0),
      crossings, trafficLights:lights,
      lightWaitSec: Math.round(lights*35),
      greenRatio: tpl.greenRatio,
    },
    score:{
      tranquility: Math.round(tpl.trafficScore*10),
      green: Math.round(tpl.greenRatio*100),
      overall: Math.round((tpl.trafficScore*0.6+tpl.greenRatio*10*0.4)*10),
    },
    description: tpl.description||'',
    aiSummary: null,
  };
}

// ─────────────────────────────────────────────────────────────
// DÉTECTION VILLE
// ─────────────────────────────────────────────────────────────
function detectCity(lat,lng){
  if(lat>48.78&&lat<48.92&&lng>2.20&&lng<2.50) return 'paris';
  return null;
}

// ─────────────────────────────────────────────────────────────
// DONNÉES PARISIENNES
// ─────────────────────────────────────────────────────────────
const PARIS_ROUTES = [
  {
    id:'quais-seine', name:'Quais de Seine',
    tags:['berges','piétons','sans voitures'],
    greenRatio:0.93, trafficScore:9.8,
    elevationPerKm:1.5, crossingsPerKm:0.3, lightsPerKm:0.2,
    spine:[[48.8534,2.3488],[48.8567,2.3412],[48.8606,2.3335],[48.8638,2.3218],[48.8647,2.3143],[48.8601,2.2944]],
    loopAngle:270, oabDir:270,
    minKm:3, maxKm:20,
    description:'Les berges piétonnes de la Seine. Quasi zéro voiture.',
  },
  {
    id:'coulee-verte', name:'Coulée Verte',
    tags:['promenade plantée','jardin','sans voitures'],
    greenRatio:0.97, trafficScore:9.9,
    elevationPerKm:2, crossingsPerKm:0.1, lightsPerKm:0.1,
    spine:[[48.8533,2.3693],[48.8507,2.3840],[48.8479,2.4012],[48.8447,2.4178],[48.8431,2.4260]],
    loopAngle:120, oabDir:115,
    minKm:2, maxKm:12,
    description:"L'ancienne voie ferrée en jardin suspendu de 4,5 km.",
  },
  {
    id:'bois-boulogne', name:'Bois de Boulogne',
    tags:['forêt','sentiers','lacs'],
    greenRatio:0.98, trafficScore:9.7,
    elevationPerKm:4, crossingsPerKm:0.2, lightsPerKm:0.1,
    spine:[[48.8670,2.2490],[48.8590,2.2350],[48.8470,2.2320],[48.8380,2.2450],[48.8360,2.2560]],
    loopAngle:200, oabDir:245,
    minKm:5, maxKm:42,
    description:'8 km² de sentiers variés, lacs et allées cavalières.',
  },
  {
    id:'canal-saint-martin', name:'Canal Saint-Martin',
    tags:['canal','écluses','bohème'],
    greenRatio:0.72, trafficScore:8.2,
    elevationPerKm:1, crossingsPerKm:0.8, lightsPerKm:0.5,
    spine:[[48.8697,2.3626],[48.8738,2.3657],[48.8785,2.3682],[48.8840,2.3710],[48.8870,2.3730]],
    loopAngle:10, oabDir:15,
    minKm:3, maxKm:15,
    description:'Les écluses et péniches du canal Saint-Martin.',
  },
  {
    id:'bois-vincennes', name:'Bois de Vincennes',
    tags:['forêt','château','lacs'],
    greenRatio:0.96, trafficScore:9.5,
    elevationPerKm:3, crossingsPerKm:0.2, lightsPerKm:0.1,
    spine:[[48.8431,2.4260],[48.8360,2.4390],[48.8280,2.4520],[48.8250,2.4600],[48.8280,2.4680]],
    loopAngle:130, oabDir:125,
    minKm:4, maxKm:30,
    description:'Le plus grand bois de Paris côté est. Lacs et 35 km de chemins.',
  },
  {
    id:'champ-de-mars', name:'Champ de Mars – Invalides',
    tags:['monument','pelouses','Tour Eiffel'],
    greenRatio:0.70, trafficScore:8.5,
    elevationPerKm:2, crossingsPerKm:1.2, lightsPerKm:0.8,
    spine:[[48.8556,2.2986],[48.8540,2.2980],[48.8520,2.3070],[48.8574,2.3130],[48.8638,2.3143]],
    loopAngle:80, oabDir:290,
    minKm:4, maxKm:15,
    description:'Du Champ de Mars aux Invalides. Vues Tour Eiffel garanties.',
  },
];

// Lieux alternatifs Paris (pour "Démarrer ailleurs")
export const PARIS_ALT_SPOTS = [
  {
    id:'alt-bois-vincennes', name:'Bois de Vincennes',
    address:'Porte Dorée, 75012 Paris',
    lat:48.8380, lng:2.4390,
    tags:['forêt','château','lacs'],
    transport:'Métro 8 — Porte Dorée', transitMinutes:18,
    greenRatio:0.96, trafficScore:9.5,
    elevationPerKm:3, crossingsPerKm:0.2, lightsPerKm:0.1,
    minKm:4, maxKm:30,
    description:'Le plus grand bois de Paris, accessible en 18 min depuis le centre.',
    spine:[[48.8431,2.4260],[48.8360,2.4390],[48.8280,2.4520],[48.8250,2.4600],[48.8280,2.4680]],
    loopAngle:130,
  },
  {
    id:'alt-bois-boulogne', name:'Bois de Boulogne',
    address:'Porte Maillot, 75116 Paris',
    lat:48.8640, lng:2.2490,
    tags:['forêt','lacs','16e'],
    transport:'Métro 1 — Porte Maillot', transitMinutes:15,
    greenRatio:0.98, trafficScore:9.7,
    elevationPerKm:4, crossingsPerKm:0.2, lightsPerKm:0.1,
    minKm:5, maxKm:42,
    description:'8 km² de sentiers et lacs, à 15 min en métro.',
    spine:[[48.8670,2.2490],[48.8590,2.2350],[48.8470,2.2320],[48.8380,2.2450],[48.8360,2.2560]],
    loopAngle:200,
  },
  {
    id:'alt-canal-ourcq', name:"Canal de l'Ourcq",
    address:'Parc de la Villette, 75019 Paris',
    lat:48.8940, lng:2.3870,
    tags:['canal','berges','19e'],
    transport:'Métro 5 — Porte de Pantin', transitMinutes:22,
    greenRatio:0.80, trafficScore:8.8,
    elevationPerKm:1, crossingsPerKm:0.5, lightsPerKm:0.3,
    minKm:4, maxKm:20,
    description:'Berges du canal de l\'Ourcq, parcours plat et ombragé.',
    spine:[[48.8940,2.3870],[48.8980,2.3960],[48.9020,2.4060],[48.9060,2.4150]],
    loopAngle:50,
  },
  {
    id:'alt-buttes-chaumont', name:'Parc des Buttes-Chaumont',
    address:'Rue Botzaris, 75019 Paris',
    lat:48.8800, lng:2.3830,
    tags:['parc','collines','19e'],
    transport:'Métro 7bis — Buttes Chaumont', transitMinutes:20,
    greenRatio:0.88, trafficScore:9.0,
    elevationPerKm:8, crossingsPerKm:0.3, lightsPerKm:0.2,
    minKm:2, maxKm:8,
    description:'Le parc le plus vallonné de Paris, sentiers variés et vues dégagées.',
    spine:[[48.8800,2.3830],[48.8820,2.3880],[48.8840,2.3930],[48.8820,2.3980]],
    loopAngle:60,
  },
  {
    id:'alt-montsouris', name:'Parc Montsouris',
    address:'Av. Reille, 75014 Paris',
    lat:48.8216, lng:2.3392,
    tags:['parc','étang','14e'],
    transport:'RER B — Cité Universitaire', transitMinutes:25,
    greenRatio:0.85, trafficScore:8.8,
    elevationPerKm:3, crossingsPerKm:0.4, lightsPerKm:0.2,
    minKm:2, maxKm:8,
    description:'Parc calme avec étang, boucle possible autour du parc et du quartier.',
    spine:[[48.8216,2.3392],[48.8200,2.3440],[48.8180,2.3410],[48.8195,2.3360]],
    loopAngle:0,
  },
  {
    id:'alt-saint-cloud', name:'Parc de Saint-Cloud',
    address:'Domaine national, 92210 Saint-Cloud',
    lat:48.8380, lng:2.2120,
    tags:['parc royal','vues','hauts-de-seine'],
    transport:'Transilien L — Saint-Cloud', transitMinutes:30,
    greenRatio:0.92, trafficScore:9.3,
    elevationPerKm:12, crossingsPerKm:0.2, lightsPerKm:0.1,
    minKm:5, maxKm:20,
    description:'460 ha de forêt royale avec des vues spectaculaires sur Paris.',
    spine:[[48.8380,2.2120],[48.8330,2.2080],[48.8280,2.2100],[48.8260,2.2180]],
    loopAngle:180,
  },
];

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION — ROUTES NORMALES (mix boucles + aller-retours)
// ─────────────────────────────────────────────────────────────
const GENERIC_TEMPLATES = [
  {seed:1, angle:0,   dir:0,   greenRatio:0.80, trafficScore:9.1, elevationPerKm:3.0, crossingsPerKm:0.6, lightsPerKm:0.4, tags:['berges','parcs']},
  {seed:2, angle:72,  dir:72,  greenRatio:0.55, trafficScore:7.5, elevationPerKm:5.0, crossingsPerKm:1.5, lightsPerKm:1.0, tags:['allées','résidentiel']},
  {seed:3, angle:144, dir:144, greenRatio:0.65, trafficScore:7.2, elevationPerKm:6.0, crossingsPerKm:1.8, lightsPerKm:1.1, tags:['sentiers','calme']},
  {seed:4, angle:216, dir:216, greenRatio:0.38, trafficScore:5.5, elevationPerKm:7.5, crossingsPerKm:3.0, lightsPerKm:2.2, tags:['mixte','urbain']},
  {seed:5, angle:288, dir:288, greenRatio:0.88, trafficScore:9.5, elevationPerKm:4.0, crossingsPerKm:0.3, lightsPerKm:0.1, tags:['nature','espaces verts']},
];

function terrainLabel(tags) {
  if(tags.includes('berges')||tags.includes('canal')) return 'Berges';
  if(tags.includes('forêt')||tags.includes('nature')||tags.includes('espaces verts')) return 'Nature';
  if(tags.includes('sentiers')||tags.includes('calme')) return 'Sentiers';
  if(tags.includes('allées')||tags.includes('résidentiel')) return 'Résidentiel';
  return 'Urbain';
}

export function generateMockRoutes(lat, lng, distanceKm, preferGreen) {
  const city = detectCity(lat, lng);
  const results = [];

  if(city === 'paris') {
    // Candidats compatibles avec la distance
    const pool = PARIS_ROUTES.filter(r => distanceKm>=r.minKm && distanceKm<=r.maxKm);
    const src  = pool.length>=3 ? pool : PARIS_ROUTES;
    const sorted = [...src].sort((a,b)=> preferGreen ? b.greenRatio-a.greenRatio : b.trafficScore-a.trafficScore);

    sorted.slice(0,6).forEach((tpl, idx) => {
      // On alterne boucle / aller-retour pour varier
      const isLoop = idx%2===0;
      const dist   = varyDistance(distanceKm, idx+10);
      const coords = isLoop
        ? buildLoopFromSpine(lat, lng, tpl.spine, dist)
        : buildOutAndBack(lat, lng, dist, tpl.oabDir + idx*5); // +idx*5 pour varier la direction
      const label  = isLoop ? `Boucle — ${tpl.name}` : `Aller-retour — ${tpl.name}`;
      results.push(makeRoute(tpl.id+(isLoop?'-l':'-oab'), label, tpl.tags, COLORS[idx%COLORS.length], coords, dist, tpl, isLoop?'loop':'outAndBack'));
    });
  } else {
    // Générique : 3 boucles + 2 aller-retours ou inversement
    GENERIC_TEMPLATES.forEach((tpl, idx) => {
      const isLoop = idx < 3; // les 3 premiers en boucle, les 2 derniers en aller-retour
      const dist   = varyDistance(distanceKm, tpl.seed);
      const terrain= terrainLabel(tpl.tags);
      const dir    = cardinal(isLoop ? tpl.angle : tpl.dir);
      const label  = isLoop ? `Boucle ${terrain} ${dir}` : `Aller-retour ${terrain} ${dir}`;
      const coords = isLoop
        ? buildLoop(lat, lng, dist, tpl.angle, tpl.seed)
        : buildOutAndBack(lat, lng, dist, tpl.dir);
      results.push(makeRoute('r'+idx, label, tpl.tags, COLORS[idx%COLORS.length], coords, dist, tpl, isLoop?'loop':'outAndBack'));
    });
  }

  // Trier par score global décroissant
  return results.sort((a,b)=>b.score.overall-a.score.overall);
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION — ROUTES "DÉMARRER AILLEURS" (depuis un parc/bois)
// ─────────────────────────────────────────────────────────────
export function generateAlternativeRoutes(homeLat, homeLng, distanceKm, preferGreen) {
  const city = detectCity(homeLat, homeLng);
  const spots = city === 'paris' ? PARIS_ALT_SPOTS : [];

  const compatible = spots.filter(s => distanceKm>=s.minKm && distanceKm<=s.maxKm);
  const pool = compatible.length>=2 ? compatible : spots;
  const sorted = [...pool].sort((a,b)=> preferGreen ? b.greenRatio-a.greenRatio : b.trafficScore-a.trafficScore);

  return sorted.slice(0,5).map((spot, idx) => {
    const dist   = varyDistance(distanceKm, idx+30);
    const coords = buildLoopFromSpine(spot.lat, spot.lng, spot.spine, dist);

    const distToSpot = haversine([homeLat,homeLng],[spot.lat,spot.lng]);
    const transitMin = spot.transitMinutes || Math.round(distToSpot*4);
    const runMin     = Math.round(dist*6.0);
    const totalMin   = transitMin + runMin + transitMin; // TC aller + course + TC retour

    const lights    = Math.round(dist*spot.lightsPerKm);
    const crossings = Math.round(dist*spot.crossingsPerKm);

    return {
      id: spot.id,
      rank: idx+1,
      name: spot.name,
      tags: spot.tags,
      color: COLORS[idx%COLORS.length],
      coordinates: coords,
      routeType: 'loop',
      isAlternativeStart: true,
      alternativeInfo: {
        address: spot.address,
        transport: spot.transport,
        transitMinutes: transitMin,
        totalMinutes: totalMin,
        distanceToSpotKm: parseFloat(distToSpot.toFixed(1)),
      },
      metrics:{
        distance: dist,
        elevationGain: Math.round(dist*spot.elevationPerKm),
        durationMin: runMin,
        crossings, trafficLights:lights,
        lightWaitSec: Math.round(lights*35),
        greenRatio: spot.greenRatio,
      },
      score:{
        tranquility: Math.round(spot.trafficScore*10),
        green: Math.round(spot.greenRatio*100),
        overall: Math.round((spot.trafficScore*0.6+spot.greenRatio*10*0.4)*10),
      },
      description: spot.description,
      aiSummary: null,
    };
  });
}

export const MOCK_GEOCODE = {
  paris:    {lat:48.8566,lng:2.3522,display:'Paris, France'},
  lyon:     {lat:45.7640,lng:4.8357,display:'Lyon, France'},
  bordeaux: {lat:44.8378,lng:-0.5792,display:'Bordeaux, France'},
};
