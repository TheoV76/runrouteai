/**
 * API Route: /api/routes
 * POST body: { lat, lng, distanceKm, preferGreen, pace, alternativeStart }
 * - Plus de champ "type" : l'algo propose lui-même le meilleur mix boucles/aller-retours
 * - alternativeStart:true → propose des boucles depuis des parcs/bois accessibles en TC
 */

import { generateMockRoutes, generateAlternativeRoutes } from '../../lib/mockData';
import { generateRouteSummary } from '../../lib/ai';
import { generateGoogleMapsURL } from '../../lib/routing';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.OPENROUTESERVICE_API_KEY;

const requestCounts = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60*60*1000;

function checkRateLimit(ip) {
  const key = `${ip}:${Math.floor(Date.now()/RATE_WINDOW)}`;
  const count = (requestCounts.get(key)||0)+1;
  requestCounts.set(key, count);
  if(requestCounts.size>10000) requestCounts.clear();
  return count <= RATE_LIMIT;
}

export default async function handler(req, res) {
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const ip = req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown';
  if(!checkRateLimit(ip)) return res.status(429).json({error:'Trop de requêtes. Réessayez dans quelques minutes.'});

  const { lat, lng, distanceKm, preferGreen=true, pace=6.0, alternativeStart=false } = req.body;

  if(!lat||!lng||typeof lat!=='number'||typeof lng!=='number')
    return res.status(400).json({error:'Coordonnées invalides'});
  if(!distanceKm||distanceKm<1||distanceKm>60)
    return res.status(400).json({error:'Distance doit être entre 1 et 60 km'});

  try {
    let rawRoutes;

    if(DEMO_MODE) {
      rawRoutes = alternativeStart
        ? generateAlternativeRoutes(lat, lng, distanceKm, preferGreen)
        : generateMockRoutes(lat, lng, distanceKm, preferGreen);
    } else {
      // Production ORS — TODO: adapter avec round_trip et aller-retour
      rawRoutes = generateMockRoutes(lat, lng, distanceKm, preferGreen);
    }

    // Résumés IA + URLs Maps
    const routes = await Promise.all(
      rawRoutes.map(async (route, idx) => {
        const aiSummary = await generateRouteSummary(route, preferGreen);
        return {
          ...route,
          rank: idx+1,
          aiSummary,
          googleMapsUrl: generateGoogleMapsURL(route.coordinates),
          isDemoData: DEMO_MODE,
        };
      })
    );

    return res.status(200).json({ routes, demoMode:DEMO_MODE });

  } catch(err) {
    console.error('Route generation error:', err);
    return res.status(500).json({
      error:'Erreur lors de la génération des itinéraires',
      details: process.env.NODE_ENV==='development' ? err.message : undefined,
    });
  }
}
