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

  // 1. Récupérer le contexte OSM (espaces verts, feux, etc.)
  const osmContext = await fetchOSMContext(lat, lng, distanceKm * 400);

  // 2. Générer plusieurs points de destination (pour diversifier les routes)
  const angles = [0, 60, 120, 180, 240, 300];
  const midpoints = angles.map((angle) =>
    computeLoopMidpoint(lat, lng, distanceKm, angle)
  );

  // 3. Appels ORS en parallèle (max 3 pour éviter rate limiting)
  const routePromises = midpoints.slice(0, 3).map(async (mid) => {
    try {
      const orsData = await generateRouteORS(apiKey, start, mid);
      return orsData.features || [];
    } catch {
      return [];
    }
  });

  const routeGroups = await Promise.all(routePromises);
  let allFeatures = routeGroups.flat();

  // Dédupliquer les routes trop similaires
  if (allFeatures.length === 0) {
    throw new Error('Aucune route générée par ORS');
  }

  // 4. Analyser et scorer chaque route
  const scoredRoutes = await Promise.all(
    allFeatures.slice(0, 8).map(async (feature, idx) => {
      const analysis = analyzeORSRoute(feature, osmContext);
      const distKm = analysis.distanceM / 1000;
      const baseScore = scoreRoute(analysis, distKm, preferGreen);
      const finalScore = aiEnhancedScore(baseScore, osmContext);

      // Élévation (appel limité)
      let elevationGain = 0;
      if (idx < 3) { // limiter les appels élévation
        elevationGain = await fetchElevation(analysis.coordinates);
      } else {
        elevationGain = Math.round(distKm * 5);
      }

      const durationMin = Math.round(distKm * pace);
      const lightWait = Math.round(analysis.trafficLights * 35); // 35s par feu en moyenne

      const route = {
        id: `route-${idx}`,
        name: getRouteName(finalScore, analysis),
        tags: getRouteTags(analysis),
        color: getRouteColor(finalScore.overall),
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

      // Résumé IA
      route.aiSummary = await generateRouteSummary(route, preferGreen);
      return route;
    })
  );

  return scoredRoutes;
}

function getRouteName(score, analysis) {
  if (score.green >= 70) return 'Parcours Nature';
  if (score.green >= 50) return 'Circuit Vert';
  if (score.tranquility >= 80) return 'Route Tranquille';
  if (analysis.primaryRoadRatio < 0.1) return 'Sentier Calme';
  return 'Circuit Urbain';
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

function getRouteColor(overall) {
  if (overall >= 80) return '#22c55e';
  if (overall >= 65) return '#84cc16';
  if (overall >= 50) return '#f59e0b';
  return '#f87171';
}
