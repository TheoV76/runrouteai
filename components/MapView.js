import { useEffect, useRef, useState } from 'react';

let L;

export default function MapView({ routes, activeRouteId, onRouteClick, startLocation }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Charger Leaflet côté client uniquement
  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('leaflet').then((leaflet) => {
      L = leaflet.default;
      setMapReady(true);
    });
  }, []);

  // Initialiser la carte
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [48.8566, 2.3522], // Paris par défaut
      zoom: 13,
      zoomControl: true,
    });

    // Tuiles CartoDB Positron — tons gris, tracés très visibles (gratuit, sans clé)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CartoDB</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapReady]);

  // Marqueur de départ
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !startLocation) return;

    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
    }

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width: 14px; height: 14px;
        background: var(--color-accent, #2d8c44);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 3px rgba(45,140,68,0.3), 0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    markerRef.current = L.marker([startLocation.lat, startLocation.lng], { icon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`<b>📍 Départ</b><br/><small>${startLocation.display}</small>`);

    mapInstanceRef.current.setView([startLocation.lat, startLocation.lng], 13);
  }, [mapReady, startLocation]);

  // Dessiner les routes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !routes?.length) return;

    // Supprimer les anciennes couches
    Object.values(layersRef.current).forEach((layer) => {
      mapInstanceRef.current.removeLayer(layer);
    });
    layersRef.current = {};

    const allBounds = [];

    routes.forEach((route) => {
      if (!route.coordinates?.length) return;
      const isActive = route.id === activeRouteId;

      // Ligne principale — épaisseur augmentée pour meilleure lisibilité
      const polyline = L.polyline(route.coordinates, {
        color: route.color || '#2d8c44',
        weight: isActive ? 8 : 5,
        opacity: isActive ? 1 : 0.75,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Halo pour la route active
      if (isActive) {
        const halo = L.polyline(route.coordinates, {
          color: route.color || '#2d8c44',
          weight: 18,
          opacity: 0.22,
        }).addTo(mapInstanceRef.current);
        layersRef.current[`${route.id}-halo`] = halo;
      }

      polyline.on('click', () => onRouteClick(route.id));
      polyline.on('mouseover', function () {
        if (!isActive) this.setStyle({ opacity: 1, weight: 7 });
        this.bindTooltip(
          `<b>${route.name}</b><br/>${route.metrics.distance} km · D+ ${route.metrics.elevationGain}m`,
          { permanent: false, direction: 'top' }
        ).openTooltip();
      });
      polyline.on('mouseout', function () {
        if (!isActive) this.setStyle({ opacity: 0.75, weight: 5 });
      });

      polyline.addTo(mapInstanceRef.current);
      layersRef.current[route.id] = polyline;
      allBounds.push(...route.coordinates);
    });

    // Ajuster la vue pour englober toutes les routes
    if (allBounds.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40] });
      } catch {}
    }
  }, [mapReady, routes, activeRouteId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Légende */}
      {routes?.length > 0 && (
        <div
          className="absolute bottom-4 left-4 z-[1000] rounded-lg p-3"
          style={{
            background: 'rgba(8, 13, 26, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--color-border)',
            maxWidth: '180px',
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            ITINÉRAIRES
          </p>
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => onRouteClick(route.id)}
              className="flex items-center gap-2 w-full text-left py-1.5 hover:opacity-80 transition-opacity"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: route.color, opacity: route.id === activeRouteId ? 1 : 0.55 }}
              />
              <div className="flex-1 min-w-0">
                <span
                  className="block text-xs truncate"
                  style={{
                    color: route.id === activeRouteId ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontWeight: route.id === activeRouteId ? '600' : '400',
                  }}
                >
                  {route.name}
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                  {route.metrics?.distance} km · {route.metrics?.elevationGain}m D+
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Placeholder si aucune route */}
      {!routes?.length && !mapReady && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-5xl mb-3">🗺️</div>
            <p style={{ color: 'var(--color-text-muted)' }}>Chargement de la carte...</p>
          </div>
        </div>
      )}
    </div>
  );
}
