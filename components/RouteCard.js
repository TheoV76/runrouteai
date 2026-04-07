import { useState } from 'react';

export default function RouteCard({ route, isActive, onClick }) {
  const [exportLoading, setExportLoading] = useState(false);
  const { rank, name, tags, metrics, score, aiSummary, color, isDemoData } = route;

  async function handleGPXExport(e) {
    e.stopPropagation();
    setExportLoading(true);
    try {
      const res = await fetch('/api/export-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `runrouteai-${name.toLowerCase().replace(/\s+/g, '-')}.gpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Export GPX échoué. Réessayez.');
    } finally {
      setExportLoading(false);
    }
  }

  function handleGoogleMaps(e) {
    e.stopPropagation();
    if (route.googleMapsUrl) {
      window.open(route.googleMapsUrl, '_blank', 'noopener noreferrer');
    }
  }

  const scoreColor = score.overall >= 80 ? '#22c55e' : score.overall >= 65 ? '#84cc16' : score.overall >= 50 ? '#fbbf24' : '#f87171';
  const scoreLabel = score.overall >= 80 ? 'Excellent' : score.overall >= 65 ? 'Bon' : score.overall >= 50 ? 'Moyen' : 'Basique';

  return (
    <div
      className={`route-card rounded-xl p-4 cursor-pointer ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${isActive ? color : 'var(--color-border)'}`,
        boxShadow: isActive ? `0 0 0 1px ${color}30, 0 0 24px ${color}18` : 'none',
        animationDelay: `${(rank - 1) * 0.1}s`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {/* Rank badge */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: color + '22', color }}
          >
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{name}</h3>
              {isDemoData && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  démo
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {tags?.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: color + '18', color }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Score global */}
        <div className="text-right shrink-0">
          <div className="text-xl font-bold" style={{ color: scoreColor, fontFamily: 'var(--font-mono)' }}>
            {score.overall}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{scoreLabel}</div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric icon="📏" label="Distance" value={`${metrics.distance} km`} color={color} />
        <Metric icon="⛰️" label="D+" value={`${metrics.elevationGain} m`} color={color} />
        <Metric
          icon="⏱️"
          label="Durée"
          value={
            metrics.durationMin >= 60
              ? `${Math.floor(metrics.durationMin / 60)}h${metrics.durationMin % 60 > 0 ? (metrics.durationMin % 60) + 'm' : ''}`
              : `${metrics.durationMin} min`
          }
          color={color}
        />
      </div>

      {/* Métriques trafic */}
      <div
        className="grid grid-cols-3 gap-2 p-2.5 rounded-lg mb-3"
        style={{ background: 'var(--color-surface-2)' }}
      >
        <TrafficMetric
          icon="🚦"
          label="Feux"
          value={metrics.trafficLights}
          sub={metrics.lightWaitSec > 0 ? `~${metrics.lightWaitSec}s` : null}
        />
        <TrafficMetric
          icon="🚗"
          label="Croisements"
          value={metrics.crossings}
        />
        <TrafficMetric
          icon="🌿"
          label="Vert"
          value={`${score.green}%`}
        />
      </div>

      {/* Score tranquillité */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Score tranquillité</span>
          <span className="text-xs font-medium" style={{ color: scoreColor }}>{score.tranquility}/100</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score.tranquility}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
          />
        </div>
      </div>

      {/* Résumé IA */}
      {aiSummary && (
        <div
          className="p-2.5 rounded-lg mb-3 text-xs leading-relaxed italic"
          style={{
            background: 'var(--color-accent-glow)',
            borderLeft: `2px solid var(--color-accent)`,
            color: 'var(--color-text-muted)',
          }}
        >
          ✨ {aiSummary}
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex gap-2">
        <button
          onClick={handleGoogleMaps}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all hover:opacity-80 flex items-center justify-center gap-1"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          🗺️ Google Maps
        </button>
        <button
          onClick={handleGPXExport}
          disabled={exportLoading}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all hover:opacity-80 flex items-center justify-center gap-1"
          style={{
            background: color + '22',
            border: `1px solid ${color}44`,
            color,
          }}
        >
          {exportLoading ? '⏳' : '⬇️'} GPX
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, color }) {
  return (
    <div className="text-center">
      <div className="text-base mb-0.5">{icon}</div>
      <div className="text-sm font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

function TrafficMetric({ icon, label, value, sub }) {
  return (
    <div className="text-center">
      <div className="text-xs mb-0.5">{icon}</div>
      <div className="text-xs font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>}
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}
