import { useState, useEffect, useRef } from 'react';

export default function SearchPanel({ onGenerate, isLoading }) {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(10);
  const [routeType, setRouteType] = useState('loop');
  const [preferGreen, setPreferGreen] = useState(true);
  const [pace, setPace] = useState(6);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const debounceRef = useRef(null);

  // Autocomplétion adresse
  useEffect(() => {
    if (address.length < 3) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 350);
  }, [address]);

  function selectSuggestion(s) {
    setAddress(s.display.split(',').slice(0, 2).join(','));
    setSelectedLocation({ lat: s.lat, lng: s.lng, display: s.display });
    setSuggestions([]);
  }

  function useGPS() {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Géolocalisation non supportée');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setSelectedLocation({ lat, lng, display: 'Ma position' });
        setAddress('📍 Ma position GPS');
        setSuggestions([]);
        setGpsLoading(false);
      },
      () => {
        setGpsError('Position refusée. Vérifiez les permissions.');
        setGpsLoading(false);
      },
      { timeout: 8000 }
    );
  }

  function handleSubmit() {
    if (!selectedLocation) {
      setGpsError('Sélectionnez une adresse de départ');
      return;
    }
    onGenerate({
      ...selectedLocation,
      distanceKm,
      type: routeType,
      preferGreen,
      pace,
    });
  }

  const paceLabel = pace < 5 ? 'Rapide' : pace < 6.5 ? 'Modéré' : 'Lent';
  const durationMin = Math.round(distanceKm * pace);

  return (
    <div className="h-full flex flex-col gap-5 p-6 overflow-y-auto">
      {/* Logo */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          <span style={{ color: 'var(--color-accent-light)' }}>Run</span>
          <span style={{ color: 'var(--color-text)' }}>Route</span>
          <span style={{ color: 'var(--color-accent)' }}>AI</span>
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Itinéraires de course optimisés par IA
        </p>
      </div>

      {/* Adresse de départ */}
      <div className="relative">
        <label className="field-label">📍 Point de départ</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setSelectedLocation(null);
              }}
              placeholder="Adresse, ville..."
              className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-accent)';
                e.target.style.boxShadow = '0 0 0 2px var(--color-accent-glow)';
              }}
              onBlur={(e) => {
                setTimeout(() => setSuggestions([]), 200);
                e.target.style.borderColor = 'var(--color-border)';
                e.target.style.boxShadow = 'none';
              }}
            />
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 shadow-xl"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2.5 text-xs hover:opacity-80 transition-colors border-b last:border-b-0"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    onMouseDown={() => selectSuggestion(s)}
                  >
                    <span className="block font-medium">{s.display.split(',')[0]}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {s.display.split(',').slice(1, 3).join(',')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={useGPS}
            disabled={gpsLoading}
            title="Utiliser ma position"
            className="px-3 py-2.5 rounded-lg text-sm transition-all hover:opacity-80 shrink-0"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            {gpsLoading ? '⏳' : '🎯'}
          </button>
        </div>
        {gpsError && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{gpsError}</p>}
        {selectedLocation && !gpsError && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-accent-light)' }}>
            ✓ Position sélectionnée
          </p>
        )}
      </div>

      {/* Distance */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="field-label">🏃 Distance</label>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold" style={{ color: 'var(--color-accent-light)', fontFamily: 'var(--font-mono)' }}>
              {distanceKm}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>km</span>
          </div>
        </div>
        <input
          type="range"
          min={2}
          max={42}
          step={0.5}
          value={distanceKm}
          onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>2 km</span>
          <span>10 km</span>
          <span>21 km</span>
          <span>42 km</span>
        </div>
      </div>

      {/* Type de parcours */}
      <div>
        <label className="field-label mb-2 block">🔄 Type de parcours</label>
        <div className="flex gap-2">
          {[
            { value: 'loop', icon: '🔁', label: 'Boucle' },
            { value: 'outAndBack', icon: '↔️', label: 'Aller-retour' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRouteType(opt.value)}
              className="flex-1 py-2.5 px-3 rounded-lg text-sm transition-all"
              style={{
                background: routeType === opt.value ? 'var(--color-accent)' : 'var(--color-surface-2)',
                border: `1px solid ${routeType === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: routeType === opt.value ? '#fff' : 'var(--color-text)',
                fontWeight: routeType === opt.value ? '600' : '400',
              }}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Espaces verts */}
      <div
        className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all"
        style={{
          background: preferGreen ? 'var(--color-accent-glow)' : 'var(--color-surface-2)',
          border: `1px solid ${preferGreen ? 'var(--color-accent)' : 'var(--color-border)'}`,
        }}
        onClick={() => setPreferGreen(!preferGreen)}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            🌿 Favoriser espaces verts
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Parcs, sentiers, quais, pistes
          </p>
        </div>
        <div
          className="w-11 h-6 rounded-full relative transition-all duration-300"
          style={{ background: preferGreen ? 'var(--color-accent)' : 'var(--color-surface)' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300"
            style={{ left: preferGreen ? '24px' : '4px' }}
          />
        </div>
      </div>

      {/* Allure */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="field-label">⚡ Allure</label>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
            {paceLabel}
          </span>
        </div>
        <input
          type="range"
          min={3.5}
          max={9}
          step={0.5}
          value={pace}
          onChange={(e) => setPace(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <span>3:30 /km</span>
          <span style={{ color: 'var(--color-accent-light)', fontFamily: 'var(--font-mono)' }}>
            {pace}:00 /km
          </span>
          <span>9:00 /km</span>
        </div>
      </div>

      {/* Estimation durée */}
      <div
        className="p-3 rounded-lg text-center"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Durée estimée</p>
        <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
          {Math.floor(durationMin / 60) > 0 && `${Math.floor(durationMin / 60)}h `}
          {durationMin % 60 > 0 && `${durationMin % 60}min`}
        </p>
      </div>

      {/* Bouton principal */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !selectedLocation}
        className="w-full py-3.5 rounded-xl text-base font-bold transition-all duration-300 relative overflow-hidden"
        style={{
          background: (!selectedLocation || isLoading) ? 'var(--color-surface-2)' : 'var(--color-accent)',
          color: (!selectedLocation || isLoading) ? 'var(--color-text-muted)' : '#fff',
          cursor: (!selectedLocation || isLoading) ? 'not-allowed' : 'pointer',
          boxShadow: selectedLocation && !isLoading ? '0 0 24px var(--color-accent-glow)' : 'none',
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeDashoffset="10" />
            </svg>
            Calcul en cours...
          </span>
        ) : (
          '🗺️ Générer mes itinéraires'
        )}
      </button>

      {/* Footer */}
      <p className="text-center text-xs mt-auto pt-2" style={{ color: 'var(--color-text-muted)' }}>
        Données OSM · IA intégrée · Export GPX
      </p>

      <style jsx>{`
        .field-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  );
}
