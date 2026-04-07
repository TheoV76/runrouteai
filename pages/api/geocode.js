/**
 * API Route: /api/geocode
 * Géocode une adresse via Nominatim — retourne numéro+rue, CP+ville
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

    if (!response.ok) throw new Error('Nominatim error');

    const data = await response.json();

    const results = data.map((item) => {
      const a = item.address || {};

      const numero = a.house_number || '';
      const rue = a.road || a.pedestrian || a.footway || a.path || '';
      const cp = a.postcode || '';
      const ville = a.city || a.town || a.village || a.municipality || '';
      const countryCode = a.country_code || '';
      const pays = countryCode !== 'fr' ? (a.country || '') : '';

      // Ligne 1 : numéro + rue, ou nom du lieu
      const ligne1 = rue
        ? [numero, rue].filter(Boolean).join(' ')
        : (a.amenity || a.leisure || a.tourism || a.neighbourhood || item.display_name.split(',')[0]);

      // Ligne 2 : CP Ville (+ Pays si hors France)
      const ligne2 = [cp, ville, pays].filter(Boolean).join(' ');

      // Texte compact affiché dans le champ après sélection
      const shortLabel = [ligne1, ligne2].filter(Boolean).join(', ');

      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        display: item.display_name,
        ligne1: ligne1 || item.display_name.split(',')[0],
        ligne2: ligne2 || item.display_name.split(',').slice(1, 3).join(',').trim(),
        shortLabel: shortLabel || item.display_name.split(',').slice(0, 2).join(','),
        city: ville,
        postcode: cp,
        country: a.country || '',
      };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ results });
  } catch (err) {
    console.error('Geocode error:', err);
    return res.status(500).json({ error: 'Geocoding failed', details: err.message });
  }
}
