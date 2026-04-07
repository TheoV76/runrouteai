/**
 * API Route: /api/routes
 * Génère des itinéraires de course optimisés
 * 
 * POST body:
 * {
 *   lat: number,
 *   lng: number,
 *   distanceKm: number,
 *   type: 'loop' | 'outAndBack',
 *   preferGreen: boolean,
 *   pace: number (min/km, optionnel)
 * }
 */

import { generateMockRoutes } from '../../lib/mockData';
import {
  fetchOSMContext,
  generateRouteORS,
  computeLoopMidpoint,
  analyzeORSRoute,
  scoreRoute,
  fetchElevation,
  generateGoogleMapsURL,
} from '../../lib/routing';
import { generateRouteSummary, aiEnhancedScore } from '../../lib/ai';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.OPENROUTESERVICE_API_KEY;

// Rate limiting simple (en production, utiliser Redis ou Upstash)
const requestCounts = new Map();
const RATE_LIMIT = 20; // requêtes par heure par IP
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / RATE_WINDOW)}`;
  const count = requestCounts.get(key) || 0;
  if (count >= RATE_LIMIT) return false;
  requestCounts.set(key, count + 1);
  // Nettoyage mémoire
  if (requestCounts.size > 10000) requestCounts.clear();
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' });
  }

  const { lat, lng, distanceKm, type, preferGreen, pace = 6.0 } = req.body;

  // Validation
  if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }
  if (!distanceKm || distanceKm < 1 || distanceKm > 60) {
    return res.status(400).json({ error: 'Distance doit être entre 1 et 60 km' });
  }
  if (!['loop', 'outAndBack'].includes(type)) {
    return res.status(400).json({ error: 'Type invalide' });
  }

  try {
    let routes;

    if (DEMO_MODE) {
      // === MODE DEMO — données mock ===
      console.log('Running in DEMO mode');
      const mockRoutes = generateMockRoutes(lat, lng, distanceKm, type, preferGreen);

      // Ajouter les résumés IA (avec ou sans OpenAI)
      routes = await Promise.all(
        mockRoutes.map(async (route, idx) => {
          const summary = await generateRouteSummary(route, preferGreen);
          return {
            ...route,
            rank: idx + 1,
            aiSummary: summary,
            googleMapsUrl: generateGoogleMapsURL(route.coordinates),
            isDemoData: true,
          };
        })
      );
    } else {
      // === MODE PRODUCTION — vraies APIs ===
      routes = await generateRealRoutes({
        lat, lng, distanceKm, type, preferGreen, pace,
        apiKey: process.env.OPENROUTESERVICE_API_KEY,
      });
    }

    // Trier par score global
    routes.sort((a, b) => b.score.overall - a.score.overall);
    routes = routes.slice(0, 6).map((r, idx) => ({ ...r, rank: idx + 1 }));

    return res.status(200).json({ routes, demoMode: DEMO_MODE });
  } catch (err) {
    console.error('Route generation error:', err);
    return res.status(500).json({
      error: 'Erreur lors de la génération des itinéraires',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

async function generateRealRoutes({ lat, lng, distanceKm, type, preferGreen, pace, apiKey }) {
  const start = { lat, lng };
  const distanceM = distanceKm * 1000;

  // 1. Contexte OSM
  const osmContext = await fetchOSMContext(lat, lng, distanceM * 0.4);

  // 2. Générer plusieurs routes avec des graines différentes (pour varier les tracés)
  const seeds = [0, 42, 99, 17, 55, 7];
  const routePromises = seeds.slice(0, 4).map(async (seed) => {
    try {
      const orsData = await generateRouteORS(apiKey, start, distanceM, type, seed);
      return orsData.features || [];
    } catch {
      return [];
    }
  });

  const routeGroups = await Promise.all(routePromises);
  let allFeatures = routeGroups.flat();

  if (allFeatures.length === 0) {
    throw new Error('Aucune route générée par ORS');
  }

  // 3. Analyser et scorer
  const scoredRoutes = await Promise.all(
    allFeatures.slice(0, 8).map(async (feature, idx) => {
      const analysis = analyzeORSRoute(feature, osmContext);
      const distKm = analysis.distanceM / 1000;
      const baseScore = scoreRoute(analysis, distKm, preferGreen);
      const finalScore = aiEnhancedScore(baseScore, osmContext);

      let elevationGain = 0;
      if (idx < 3) {
        elevationGain = await fetchElevation(analysis.coordinates);
      } else {
        elevationGain = Math.round(distKm * 5);
      }

      const durationMin = Math.round(distKm * pace);
      const lightWait = Math.round(analysis.trafficLights * 35);

      const route = {
        id: `route-${idx}`,
        name: getRouteName(finalScore, analysis, idx, type),
        tags: getRouteTags(analysis),
        color: getRouteColor(idx),
        coordinates: analysis.coordinates,
        metrics: {
          distance: parseFloat(distKm.toFixed(2)),
          elevationGain,
          durationMin,
          crossings: analysis.crossings,
          trafficLights: analysis.trafficLights,
          lightWaitSec: lightWait,
          greenRatio: analysis.greenRatio,
        },
        score: finalScore,
        googleMapsUrl: generateGoogleMapsURL(analysis.coordinates),
        isDemoData: false,
      };

      route.aiSummary = await generateRouteSummary(route, preferGreen);
      return route;
    })
  );

  // 4. Filtrer par tolérance de distance ±25%
  const tolerance = 0.25;
  const filtered = scoredRoutes.filter(r => {
    const ratio = r.metrics.distance / distanceKm;
    return ratio >= (1 - tolerance) && ratio <= (1 + tolerance);
  });

  // Si trop peu après filtrage, garder les plus proches de la cible
  return filtered.length >= 2
    ? filtered
    : scoredRoutes.sort((a, b) =>
        Math.abs(a.metrics.distance - distanceKm) - Math.abs(b.metrics.distance - distanceKm)
      ).slice(0, 5);
}

function getRouteName(score, analysis, idx, type) {
  // Noms basés sur le type + caractéristique principale
  const prefix = type === 'loop' ? 'Boucle' : 'Aller-retour';
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  const dir = dirs[idx % dirs.length];
  if (score.green >= 70) return prefix + ' Verte ' + dir;
  if (score.tranquility >= 80) return prefix + ' Tranquille ' + dir;
  if (analysis.primaryRoadRatio < 0.1) return prefix + ' ' + dir + ' (calme)';
  return prefix + ' Urbaine ' + dir;
}

function getRouteTags(analysis) {
  const tags = [];
  if (analysis.greenRatio >= 0.6) tags.push('espaces verts');
  if (analysis.trafficLights <= 3) tags.push('peu de feux');
  if (analysis.crossings <= 5) tags.push('peu de traversées');
  if (analysis.primaryRoadRatio < 0.1) tags.push('voies douces');
  if (tags.length === 0) tags.push('urbain');
  return tags;
}

// Palette douce — pas de rouge fluo
const ROUTE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

function getRouteColor(idx) {
  return ROUTE_COLORS[idx % ROUTE_COLORS.length];
}
