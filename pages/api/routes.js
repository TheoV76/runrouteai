/**
 * RunRouteAI — /api/routes v6
 *
 * Stratégie :
 *  Si clé ORS disponible → vraies routes sur le réseau OSM (TOUJOURS)
 *    - 3 boucles (seeds 0, 42, 99) avec green+quiet weightings
 *    - 2 aller-retours (directions N=0° et SE=135°) avec green+quiet
 *    - Tri par score → les 5 meilleurs
 *
 *  Si pas de clé ORS → erreur explicite (fini le mode démo avec lignes droites)
 *
 *  alternativeStart=true → même logique mais depuis des spots alternatifs (parcs)
 *
 * POST body: { lat, lng, distanceKm, preferGreen, pace, alternativeStart }
 */

import {
  fetchORSLoop,
  fetchORSOutAndBack,
  parseORSFeature,
  scoreAnalysis,
  nameRoute,
  tagsFromAnalysis,
  routeColor,
  generateGPX,
  generateGoogleMapsURL,
} from '../../lib/routing';
import { generateAlternativeRoutes } from '../../lib/mockData';
import { generateRouteSummary } from '../../lib/ai';

// Rate limiting
const counts = new Map();
function rateOk(ip) {
  const key = `${ip}:${Math.floor(Date.now()/3600000)}`;
  const n = (counts.get(key)||0)+1;
  counts.set(key, n);
  if(counts.size>5000) counts.clear();
  return n <= 30;
}

export default async function handler(req, res) {
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if(!rateOk(ip)) return res.status(429).json({error:'Trop de requêtes. Réessayez dans quelques minutes.'});

  const { lat, lng, distanceKm, preferGreen=true, pace=6.0, alternativeStart=false } = req.body;

  if(typeof lat!=='number'||typeof lng!=='number') return res.status(400).json({error:'Coordonnées invalides'});
  if(!distanceKm||distanceKm<1||distanceKm>60) return res.status(400).json({error:'Distance entre 1 et 60 km'});

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  try {
    let routes;

    if(alternativeStart) {
      // Spots alternatifs (parcs/bois) avec vraies boucles ORS si clé dispo
      routes = await buildAlternativeRoutes(lat, lng, distanceKm, preferGreen, pace, apiKey);
    } else {
      if(!apiKey) {
        return res.status(503).json({
          error: 'Clé OpenRouteService manquante. Ajoutez OPENROUTESERVICE_API_KEY dans les variables d\'environnement Vercel.',
          setupUrl: 'https://openrouteservice.org/dev/#/signup',
        });
      }
      routes = await buildRealRoutes(lat, lng, distanceKm, preferGreen, pace, apiKey);
    }

    return res.status(200).json({ routes, demoMode: false });

  } catch(err) {
    console.error('Route error:', err.message);
    return res.status(500).json({
      error: 'Erreur lors de la génération. Vérifiez votre clé OpenRouteService.',
      detail: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// ROUTES RÉELLES via ORS
// ─────────────────────────────────────────────────────────────
async function buildRealRoutes(lat, lng, distanceKm, preferGreen, pace, apiKey) {
  const distanceM = distanceKm * 1000;

  // Lancer les appels ORS en parallèle
  // 3 boucles avec seeds différents + 2 aller-retours dans directions différentes
  const jobs = [
    { type:'loop',       variant:0,   fn: () => fetchORSLoop(apiKey, lat, lng, distanceM, preferGreen, 0)   },
    { type:'loop',       variant:42,  fn: () => fetchORSLoop(apiKey, lat, lng, distanceM, preferGreen, 42)  },
    { type:'loop',       variant:99,  fn: () => fetchORSLoop(apiKey, lat, lng, distanceM, preferGreen, 99)  },
    { type:'outAndBack', variant:0,   fn: () => fetchORSOutAndBack(apiKey, lat, lng, distanceM, preferGreen, 0)   }, // Nord
    { type:'outAndBack', variant:135, fn: () => fetchORSOutAndBack(apiKey, lat, lng, distanceM, preferGreen, 135) }, // Sud-Est
  ];

  const results = await Promise.allSettled(jobs.map(j => j.fn()));

  const analyzed = [];
  results.forEach((result, idx) => {
    if(result.status !== 'fulfilled') {
      console.warn(`Job ${idx} failed:`, result.reason?.message);
      return;
    }
    const data = result.value;
    const features = data.features || [];
    if(!features.length) return;

    const job = jobs[idx];
    const feature = features[0]; // ORS renvoie 1 feature par appel round_trip
    try {
      const analysis = parseORSFeature(feature, job.type, job.variant);
      // Filtrer les routes trop loin de la distance demandée (±30%)
      const ratio = analysis.distanceKm / distanceKm;
      if(ratio < 0.70 || ratio > 1.35) return;
      analyzed.push(analysis);
    } catch(e) {
      console.warn('Parse error:', e.message);
    }
  });

  if(analyzed.length === 0) {
    throw new Error('Aucun itinéraire valide généré par OpenRouteService. Vérifiez votre clé API ou essayez une adresse différente.');
  }

  // Scorer + trier
  const scored = analyzed.map((analysis, idx) => {
    const score = scoreAnalysis(analysis, preferGreen);
    const name  = nameRoute(analysis, score, analysis.routeType);
    const tags  = tagsFromAnalysis(analysis, score);
    const color = routeColor(idx);
    const lightWait = Math.round(analysis.trafficLights * 35);
    const durationMin = Math.round(analysis.distanceKm * pace);

    return {
      id: `route-${analysis.routeType}-${analysis.variantId}`,
      rank: idx+1,
      name, tags, color,
      routeType: analysis.routeType,
      coordinates: analysis.coords,
      metrics: {
        distance: analysis.distanceKm,
        elevationGain: analysis.elevationGain,
        durationMin,
        crossings: analysis.crossings,
        trafficLights: analysis.trafficLights,
        lightWaitSec: lightWait,
        greenRatio: analysis.greenRatio,
      },
      score,
      googleMapsUrl: generateGoogleMapsURL(analysis.coords),
      isDemoData: false,
    };
  });

  scored.sort((a,b) => b.score.overall - a.score.overall);

  // Résumés IA
  const withAI = await Promise.all(
    scored.slice(0,5).map(async (route, idx) => {
      const aiSummary = await generateRouteSummary(route, preferGreen);
      return { ...route, rank: idx+1, aiSummary };
    })
  );

  return withAI;
}

// ─────────────────────────────────────────────────────────────
// ROUTES ALTERNATIVES (depuis des parcs/bois)
// ─────────────────────────────────────────────────────────────
async function buildAlternativeRoutes(homeLat, homeLng, distanceKm, preferGreen, pace, apiKey) {
  // Importer les spots
  const { PARIS_ALT_SPOTS } = await import('../../lib/mockData');
  const isParis = homeLat>48.78&&homeLat<48.92&&homeLng>2.20&&homeLng<2.50;
  const spots   = isParis ? PARIS_ALT_SPOTS : [];
  const compatible = spots.filter(s => distanceKm>=s.minKm && distanceKm<=s.maxKm);
  const pool = compatible.length>=2 ? compatible : spots.slice(0,4);

  const distanceM = distanceKm * 1000;

  const results = await Promise.allSettled(
    pool.map(spot => apiKey
      ? fetchORSLoop(apiKey, spot.lat, spot.lng, distanceM, true, 0)
      : Promise.reject(new Error('no key'))
    )
  );

  // Si pas de clé ou échec ORS → fallback mock pour les alternatives
  const { generateAlternativeRoutes: genAlt } = await import('../../lib/mockData');
  const fallback = genAlt(homeLat, homeLng, distanceKm, preferGreen);

  const routes = [];
  results.forEach((result, idx) => {
    const spot = pool[idx];
    if(result.status !== 'fulfilled') {
      // Utiliser le mock pour ce spot
      const mock = fallback.find(f => f.id.includes(spot.id.replace('alt-','')));
      if(mock) routes.push({ ...mock, isDemoData:true });
      return;
    }
    const features = result.value.features || [];
    if(!features.length) return;
    try {
      const analysis = parseORSFeature(features[0], 'loop', 0);
      const score    = scoreAnalysis(analysis, true);
      const R = 6371;
      const dLat = (spot.lat-homeLat)*Math.PI/180;
      const dLng = (spot.lng-homeLng)*Math.PI/180;
      const x = Math.sin(dLat/2)**2 + Math.cos(homeLat*Math.PI/180)*Math.cos(spot.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      const distToSpot = R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
      const transitMin = spot.transitMinutes || Math.round(distToSpot*4);
      const runMin = Math.round(analysis.distanceKm * pace);

      routes.push({
        id: spot.id,
        rank: idx+1,
        name: spot.name,
        tags: spot.tags,
        color: routeColor(idx),
        routeType: 'loop',
        isAlternativeStart: true,
        alternativeInfo: {
          address: spot.address,
          transport: spot.transport,
          transitMinutes: transitMin,
          totalMinutes: transitMin + runMin + transitMin,
          distanceToSpotKm: parseFloat(distToSpot.toFixed(1)),
        },
        coordinates: analysis.coords,
        metrics: {
          distance: analysis.distanceKm,
          elevationGain: analysis.elevationGain,
          durationMin: runMin,
          crossings: analysis.crossings,
          trafficLights: analysis.trafficLights,
          lightWaitSec: Math.round(analysis.trafficLights*35),
          greenRatio: analysis.greenRatio,
        },
        score,
        googleMapsUrl: generateGoogleMapsURL(analysis.coords),
        isDemoData: false,
        description: spot.description,
        aiSummary: null,
      });
    } catch(e) { console.warn('Alt parse error:', e.message); }
  });

  // Résumés IA
  const withAI = await Promise.all(
    routes.slice(0,5).map(async (route, idx) => {
      const aiSummary = await generateRouteSummary(route, true);
      return { ...route, rank: idx+1, aiSummary };
    })
  );
  return withAI;
}
