import { useState, useCallback } from 'react';

import Head from 'next/head';
import dynamic from 'next/dynamic';
import SearchPanel from '../components/SearchPanel';
import RouteCard from '../components/RouteCard';

// Leaflet ne fonctionne que côté client
const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Home() {
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleGenerate = useCallback(async (params) => {
    setIsLoading(true);
    setError('');
    setRoutes([]);
    setActiveRouteId(null);
    setShowResults(false);

    setStartLocation({ lat: params.lat, lng: params.lng, display: params.display || 'Départ' });

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: params.lat,
          lng: params.lng,
          distanceKm: params.distanceKm,
          type: params.type,
          preferGreen: params.preferGreen,
          pace: params.pace,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur serveur');
      }

      setRoutes(data.routes || []);
      setDemoMode(data.demoMode || false);
      if (data.routes?.length > 0) {
        setActiveRouteId(data.routes[0].id);
        setShowResults(true);
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRouteClick = useCallback((routeId) => {
    setActiveRouteId(routeId);
  }, []);

  const activeRoute = routes.find((r) => r.id === activeRouteId);

  return (
    <>
      <Head>
        <title>RunRouteAI — Itinéraires de course optimisés</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Background radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(45,140,68,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(6,182,212,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Layout principal */}
      <div className="flex h-screen w-full overflow-hidden relative">

        {/* === PANNEAU GAUCHE — Paramètres === */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden relative"
          style={{
            width: '340px',
            minWidth: '300px',
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
          }}
        >
          <SearchPanel onGenerate={handleGenerate} isLoading={isLoading} />
        </div>

        {/* === ZONE PRINCIPALE DROITE === */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Barre supérieure */}
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              height: '52px',
            }}
          >
            <div className="flex items-center gap-3">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-accent-light)' }}>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeDashoffset="10" />
                  </svg>
                  Analyse du terrain en cours...
                </div>
              )}
              {!isLoading && routes.length > 0 && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <span style={{ color: 'var(--color-accent-light)', fontWeight: '600' }}>{routes.length}</span> itinéraires trouvés
                  {demoMode && (
                    <span
                      className="ml-2 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      ⚡ Mode démo
                    </span>
                  )}
                </span>
              )}
              {!isLoading && routes.length === 0 && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Configurez vos paramètres et générez vos itinéraires
                </span>
              )}
            </div>

            {activeRoute && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: activeRoute.color }} />
                {activeRoute.name} · {activeRoute.metrics.distance} km · D+ {activeRoute.metrics.elevationGain}m
              </div>
            )}
          </div>

          {/* Carte + Résultats */}
          <div className="flex-1 flex overflow-hidden">

            {/* Carte */}
            <div className="flex-1 relative overflow-hidden">
              {/* Placeholder décoratif si pas encore de routes */}
              {!routes.length && !isLoading && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4"
                  style={{ background: 'var(--color-bg)' }}
                >
                  <div style={{ fontSize: '72px', filter: 'grayscale(0.3)' }}>🏃</div>
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                      Prêt à courir ?
                    </p>
                    <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Renseignez votre point de départ, la distance souhaitée, et laissez l'IA trouver les meilleurs itinéraires pour vous.
                    </p>
                  </div>
                  <div className="flex gap-3 mt-2">
                    {['🌿 Espaces verts', '🚦 Moins de feux', '⛰️ D+ calculé'].map((item) => (
                      <div
                        key={item}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {isLoading && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-5"
                  style={{ background: 'var(--color-bg)' }}
                >
                  <div className="relative">
                    <div
                      className="w-16 h-16 rounded-full border-2 border-transparent animate-spin"
                      style={{ borderTopColor: 'var(--color-accent)', borderRightColor: 'var(--color-accent-light)' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">
                      🗺️
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold mb-1">Calcul des itinéraires...</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Analyse OSM · Scoring · Résumés IA
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-48">
                    {[
                      { label: 'Géocodage', done: true },
                      { label: 'Contexte OSM', done: true },
                      { label: 'Génération routes', done: false },
                      { label: 'Scoring IA', done: false },
                    ].map((step, i) => (
                      <div key={step.label} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0"
                          style={{
                            background: step.done ? 'var(--color-accent)' : 'var(--color-surface-2)',
                            border: step.done ? 'none' : '1px solid var(--color-border)',
                          }}
                        >
                          {step.done ? '✓' : ''}
                        </div>
                        <span
                          className="text-xs"
                          style={{ color: step.done ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <MapView
                routes={routes}
                activeRouteId={activeRouteId}
                onRouteClick={handleRouteClick}
                startLocation={startLocation}
              />
            </div>

            {/* === LISTE DES RÉSULTATS === */}
            {(routes.length > 0 || error) && (
              <div
                className="flex flex-col overflow-hidden"
                style={{
                  width: '320px',
                  minWidth: '280px',
                  borderLeft: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                }}
              >
                {/* Header résultats */}
                <div
                  className="px-4 py-3 shrink-0"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <p
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Itinéraires proposés
                  </p>
                </div>

                {/* Error state */}
                {error && (
                  <div
                    className="m-4 p-3 rounded-lg text-sm"
                    style={{
                      background: 'rgba(248,113,113,0.1)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      color: '#f87171',
                    }}
                  >
                    ⚠️ {error}
                  </div>
                )}

                {/* Liste des routes */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                  {routes.map((route, idx) => (
                    <div
                      key={route.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${idx * 0.08}s`, opacity: 0, animationFillMode: 'forwards' }}
                    >
                      <RouteCard
                        route={route}
                        isActive={route.id === activeRouteId}
                        onClick={() => handleRouteClick(route.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile — avertissement */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 text-center"
        style={{
          background: 'var(--color-bg)',
          display: 'none',
        }}
      >
        <div>
          <div className="text-5xl mb-4">📱</div>
          <h2 className="text-xl font-bold mb-2">Version mobile</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pour une meilleure expérience, utilisez un écran plus large.
          </p>
        </div>
      </div>
    </>
  );
}
