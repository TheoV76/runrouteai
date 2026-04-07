/**
 * API Route: /api/geocode
 * Géocode une adresse via Nominatim (OpenStreetMap) — gratuit, sans clé API
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RunRouteAI/1.0 (contact@runrouteai.com)',
        'Accept-Language': 'fr',
      },
    });

    if (!response.ok) {
      throw new Error('Nominatim error');
    }

    const data = await response.json();
    const results = data.map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display: item.display_name,
      city: item.address?.city || item.address?.town || item.address?.village || '',
      country: item.address?.country || '',
    }));

    // Cache 1h (Nominatim le recommande)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ results });
  } catch (err) {
    console.error('Geocode error:', err);
    return res.status(500).json({ error: 'Geocoding failed', details: err.message });
  }
}
