/**
 * RunRouteAI — Module IA
 * Génère des résumés en langage naturel et améliore le scoring
 * Utilise OpenAI GPT-4o-mini (modèle économique, ~$0.001 par résumé)
 */

/**
 * Génère un résumé IA pour un itinéraire.
 * Appelé côté SERVEUR uniquement (la clé API n'est jamais exposée au client).
 */
export async function generateRouteSummary(route, preferGreen) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return generateFallbackSummary(route, preferGreen);
  }

  const { metrics, score, name, tags } = route;
  const prompt = buildPrompt(route, preferGreen);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `Tu es un coach de running expert qui décrit des itinéraires de manière concise, enthousiaste et utile. 
Réponds en 2-3 phrases maximum. Style direct, motivant, en français.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error('OpenAI error:', res.status);
      return generateFallbackSummary(route, preferGreen);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || generateFallbackSummary(route, preferGreen);
  } catch (err) {
    console.error('AI summary error:', err);
    return generateFallbackSummary(route, preferGreen);
  }
}

function buildPrompt(route, preferGreen) {
  const { metrics, score, name } = route;
  const greenPct = score.green;
  const lights = metrics.trafficLights;
  const crossings = metrics.crossings;
  const dPlus = metrics.elevationGain;
  const dist = metrics.distance;
  const tranquility = score.tranquility;

  const terrainDesc = greenPct >= 70
    ? 'majoritairement en parcs et sentiers naturels'
    : greenPct >= 40
    ? 'mixant espaces verts et rues calmes'
    : 'principalement urbain avec quelques espaces verts';

  return `Décris cet itinéraire de course à pied de manière motivante:
- Nom: ${name}
- Distance: ${dist} km
- Dénivelé positif: ${dPlus} m
- Terrain: ${terrainDesc} (${greenPct}% vert)
- Feux rouges: ${lights}
- Carrefours avec trafic: ${crossings}
- Score de tranquillité: ${tranquility}/100
- Préférence coureur: ${preferGreen ? 'favorise espaces verts' : 'neutre'}`;
}

/**
 * Résumé de fallback si pas d'API IA disponible
 */
function generateFallbackSummary(route, preferGreen) {
  const { metrics, score } = route;
  const greenPct = score.green;

  const terrain = greenPct >= 70
    ? 'les parcs et sentiers naturels'
    : greenPct >= 40
    ? 'les allées et espaces verts'
    : 'les rues calmes de la ville';

  const tranquilDesc = score.tranquility >= 80
    ? 'Quasi zéro voiture, un vrai plaisir.'
    : score.tranquility >= 60
    ? 'Peu de trafic, ambiance agréable.'
    : 'Quelques passages plus urbains à prévoir.';

  const dPlusDesc = metrics.elevationGain > 50
    ? ` Avec ${metrics.elevationGain}m de D+, préparez-vous à travailler !`
    : metrics.elevationGain > 20
    ? ` Terrain légèrement vallonné (${metrics.elevationGain}m D+).`
    : ' Parcours essentiellement plat.';

  return `Cet itinéraire privilégie ${terrain} pour ${metrics.distance} km de course. ${tranquilDesc}${dPlusDesc}`;
}

/**
 * Score IA amélioré — pondère davantage les facteurs qualitatifs
 */
export function aiEnhancedScore(baseScore, osmContext) {
  // Bonus si beaucoup d'espaces verts OSM à proximité
  const greenBonus = Math.min(10, osmContext.greenAreasNearby * 0.8);

  // Malus si nombreuses routes principales
  const trafficMalus = Math.min(10, osmContext.majorRoadsNearby * 0.5);

  return {
    ...baseScore,
    overall: Math.min(100, Math.max(0, baseScore.overall + greenBonus - trafficMalus)),
  };
}
