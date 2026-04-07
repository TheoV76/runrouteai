/**
 * API Route: /api/export-gpx
 * Génère un fichier GPX téléchargeable
 */

import { generateGPX } from '../../lib/routing';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { route } = req.body;

  if (!route || !route.coordinates?.length) {
    return res.status(400).json({ error: 'Route invalide' });
  }

  try {
    const gpxContent = generateGPX(route);
    const filename = `runrouteai-${route.name?.replace(/\s+/g, '-').toLowerCase() || 'route'}-${Date.now()}.gpx`;

    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    return res.status(200).send(gpxContent);
  } catch (err) {
    console.error('GPX export error:', err);
    return res.status(500).json({ error: 'Export GPX échoué' });
  }
}
