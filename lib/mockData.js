/**
 * Données mock pour le mode démo (sans dépendances APIs externes)
 * Simule des itinéraires autour de Paris
 */

export function generateMockRoutes(lat, lng, distanceKm, type, preferGreen) {
  const baseCoords = [lat, lng];

  // Génère des waypoints autour du point de départ
  function generateLoop(centerLat, centerLng, radiusKm, points = 12, offsetAngle = 0) {
    const coords = [];
    const R = 6371; // km
    for (let i = 0; i <= points; i++) {
      const angle = ((i / points) * 2 * Math.PI) + (offsetAngle * Math.PI / 180);
      const variation = 0.85 + Math.random() * 0.3;
      const dLat = (radiusKm * variation * Math.cos(angle)) / R * (180 / Math.PI);
      const dLng = (radiusKm * variation * Math.sin(angle)) / (R * Math.cos(centerLat * Math.PI / 180)) * (180 / Math.PI);
      coords.push([centerLat + dLat, centerLng + dLng]);
    }
    coords.push(coords[0]); // boucle fermée
    return coords;
  }

  function generateOutAndBack(centerLat, centerLng, distKm, angle = 45) {
    const R = 6371;
    const rad = angle * Math.PI / 180;
    const halfDist = distKm / 2;
    
    const points = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * halfDist;
      const variation = 1 + (Math.random() - 0.5) * 0.1;
      const dLat = (d * variation * Math.cos(rad)) / R * (180 / Math.PI);
      const dLng = (d * variation * Math.sin(rad)) / (R * Math.cos(centerLat * Math.PI / 180)) * (180 / Math.PI);
      points.push([centerLat + dLat, centerLng + dLng]);
    }
    // Retour avec légère variation
    const returnPoints = [...points].reverse().map(([pLat, pLng]) => [
      pLat + (Math.random() - 0.5) * 0.001,
      pLng + (Math.random() - 0.5) * 0.001,
    ]);
    return [...points, ...returnPoints.slice(1)];
  }

  const radius = distanceKm / (2 * Math.PI);

  const routeTemplates = [
    {
      id: 'route-1',
      name: 'Parcours des Berges',
      tags: ['berges', 'parcs', 'piétons'],
      greenRatio: 0.75,
      trafficScore: 9.2,
      elevationGain: Math.round(distanceKm * 3.5),
      crossings: Math.round(distanceKm * 0.8),
      trafficLights: Math.round(distanceKm * 0.5),
      color: '#22c55e',
      coords: type === 'loop'
        ? generateLoop(lat, lng, radius, 14, 0)
        : generateOutAndBack(lat, lng, distanceKm, 30),
      description: 'Privilégie les berges et les parcs, très peu de circulation. Idéal pour une sortie tranquille.',
    },
    {
      id: 'route-2',
      name: 'Circuit des Allées',
      tags: ['allées', 'petites rues'],
      greenRatio: 0.55,
      trafficScore: 7.8,
      elevationGain: Math.round(distanceKm * 5.2),
      crossings: Math.round(distanceKm * 1.5),
      trafficLights: Math.round(distanceKm * 1.0),
      color: '#84cc16',
      coords: type === 'loop'
        ? generateLoop(lat, lng, radius * 0.95, 16, 25)
        : generateOutAndBack(lat, lng, distanceKm, 90),
      description: 'Emprunte principalement des allées et petites rues résidentielles avec quelques passages en parc.',
    },
    {
      id: 'route-3',
      name: 'Route Urbaine',
      tags: ['mixte', 'rues'],
      greenRatio: 0.35,
      trafficScore: 5.4,
      elevationGain: Math.round(distanceKm * 8.1),
      crossings: Math.round(distanceKm * 3.2),
      trafficLights: Math.round(distanceKm * 2.5),
      color: '#f59e0b',
      coords: type === 'loop'
        ? generateLoop(lat, lng, radius * 1.05, 12, 60)
        : generateOutAndBack(lat, lng, distanceKm, 150),
      description: 'Parcours urbain varié, alternant rues normales et espaces verts. Quelques passages animés.',
    },
    {
      id: 'route-4',
      name: 'Circuit Élevé',
      tags: ['collines', 'vues'],
      greenRatio: 0.60,
      trafficScore: 6.9,
      elevationGain: Math.round(distanceKm * 12.5),
      crossings: Math.round(distanceKm * 2.0),
      trafficLights: Math.round(distanceKm * 1.2),
      color: '#06b6d4',
      coords: type === 'loop'
        ? generateLoop(lat, lng, radius * 0.9, 18, 90)
        : generateOutAndBack(lat, lng, distanceKm, 210),
      description: 'Itinéraire avec plus de dénivelé, offrant de belles vues. Passages en zones résidentielles calmes.',
    },
    {
      id: 'route-5',
      name: 'Sentier Forestier',
      tags: ['forêt', 'sentiers', 'nature'],
      greenRatio: 0.90,
      trafficScore: 9.8,
      elevationGain: Math.round(distanceKm * 6.8),
      crossings: Math.round(distanceKm * 0.3),
      trafficLights: Math.round(distanceKm * 0.1),
      color: '#10b981',
      coords: type === 'loop'
        ? generateLoop(lat, lng, radius * 1.1, 20, 135)
        : generateOutAndBack(lat, lng, distanceKm, 270),
      description: 'Très proche de la nature, emprunte des sentiers et zones boisées. Quasi zéro voiture.',
    },
  ];

  // Si préférence espaces verts, trier différemment
  let routes = preferGreen
    ? [...routeTemplates].sort((a, b) => b.greenRatio - a.greenRatio)
    : routeTemplates;

  // Calculer les métriques finales
  return routes.map((r, idx) => {
    const actualDistance = distanceKm * (0.95 + Math.random() * 0.12);
    const pace = 6.0; // min/km standard
    const durationMin = Math.round(actualDistance * pace);
    const waitPerLight = 35; // secondes
    const totalLightWait = Math.round(r.trafficLights * waitPerLight);

    return {
      id: r.id,
      rank: idx + 1,
      name: r.name,
      tags: r.tags,
      color: r.color,
      coordinates: r.coords,
      metrics: {
        distance: parseFloat(actualDistance.toFixed(2)),
        elevationGain: r.elevationGain,
        durationMin,
        crossings: r.crossings,
        trafficLights: r.trafficLights,
        lightWaitSec: totalLightWait,
        greenRatio: r.greenRatio,
      },
      score: {
        tranquility: Math.round(r.trafficScore * 10),
        green: Math.round(r.greenRatio * 100),
        overall: Math.round((r.trafficScore * 0.6 + r.greenRatio * 10 * 0.4) * 10),
      },
      description: r.description,
      aiSummary: null, // sera rempli par l'API IA
    };
  });
}

export const MOCK_GEOCODE = {
  paris: { lat: 48.8566, lng: 2.3522, display: 'Paris, France' },
  lyon: { lat: 45.7640, lng: 4.8357, display: 'Lyon, France' },
  bordeaux: { lat: 44.8378, lng: -0.5792, display: 'Bordeaux, France' },
};
