import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

function Metric({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'muted'
      ? 'text-slate-400'
      : 'text-slate-100'
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-slate-500">
        {label}
      </span>
      <span className={`num font-mono text-2xl font-semibold leading-none mt-1 ${toneClass}`}>
        {value}
      </span>
    </div>
  )
}

function LiveDot({ status }) {
  const color =
    status === 'error' || status === 'rate-limited' || status === 'unauthorized'
      ? 'bg-rose-400'
      : status === 'demo'
      ? 'bg-accent'
      : 'bg-emerald-400'
  return (
    <span className="relative flex items-center justify-center w-2 h-2">
      <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping-slow ${color}`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  )
}

function SyncProgress({ status, refreshMs, lastUpdated }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (!lastUpdated) return
    const start = lastUpdated.getTime()
    let raf
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / refreshMs) * 100)
      setPct(p)
      if (p < 100) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lastUpdated, refreshMs])

  const err = status === 'error' || status === 'rate-limited' || status === 'unauthorized'
  const demo = status === 'demo'

  return (
    <div className="h-[2px] w-full bg-white/[0.06] overflow-hidden rounded-full">
      <div
        className={`h-full transition-[width] duration-100 ease-linear ${
          err ? 'bg-rose-400/70' : demo ? 'bg-accent/70' : 'bg-slate-300/60'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function statusLabel(status) {
  switch (status) {
    case 'loading': return 'Sincronizando'
    case 'ok': return 'En vivo'
    case 'demo': return 'Modo demo'
    case 'rate-limited': return 'API limitada'
    case 'unauthorized': return 'Credenciales inválidas'
    case 'error': return 'Sin conexión'
    default: return 'Inicializando'
  }
}

export default function StatsOverlay({
  flights,
  status,
  error,
  lastUpdated,
  refreshMs,
  usage,
  authed,
  creditCost,
}) {
  const total = flights.length
  const airborne = flights.filter((f) => !f.on_ground).length
  const grounded = total - airborne
  const countries = new Set(flights.map((f) => f.origin_country).filter(Boolean)).size

  const budget = authed ? 4000 : 400
  const creditPct = usage ? Math.min(100, (usage.used / budget) * 100) : 0

  return (
    <div className="absolute top-5 left-5 z-[999] w-[380px] max-w-[calc(100vw-2.5rem)] animate-fadeIn">
      <div className="panel rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 32 32" className="text-accent">
              <path
                d="M16 2 C 15 2, 14.5 3, 14.5 5 L 14.5 12 L 2 17 L 2 19 L 14.5 16.5 L 14.5 24 L 11.5 26.5 L 11.5 28 L 16 27 L 20.5 28 L 20.5 26.5 L 17.5 24 L 17.5 16.5 L 30 19 L 30 17 L 17.5 12 L 17.5 5 C 17.5 3, 17 2, 16 2 Z"
                fill="currentColor"
              />
            </svg>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-100 leading-none">
                SkyStream <span className="text-slate-500 font-normal">Tracker</span>
              </h1>
              <p className="text-[10px] text-slate-500 mt-1 tracking-wide">
                Live flight radar · OpenSky Network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LiveDot status={status} />
            <span className="text-[11px] font-medium text-slate-300">
              {statusLabel(status)}
            </span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-4 px-5 pb-4">
          <Metric label="Total" value={total.toLocaleString()} />
          <Metric label="En vuelo" value={airborne.toLocaleString()} tone="accent" />
          <Metric label="En tierra" value={grounded.toLocaleString()} tone="muted" />
          <Metric label="Países" value={countries} tone="muted" />
        </div>

        {/* Barra de sync */}
        <div className="px-5 pb-4">
          <SyncProgress status={status} refreshMs={refreshMs} lastUpdated={lastUpdated} />
        </div>

        {/* Footer: créditos + auth */}
        {usage && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.05] bg-black/20">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${authed ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span>{authed ? 'OAuth2' : 'Anónimo'}</span>
              <span className="text-slate-600">·</span>
              <span>{creditCost} cr/req</span>
            </div>

            <div className="flex items-center gap-2.5 min-w-[140px]">
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    creditPct > 85 ? 'bg-rose-400' : creditPct > 60 ? 'bg-accent' : 'bg-emerald-400/70'
                  }`}
                  style={{ width: `${creditPct}%` }}
                />
              </div>
              <span className="num font-mono text-[11px] text-slate-400 tabular-nums">
                {usage.used}<span className="text-slate-600">/{budget}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 panel rounded-xl px-3 py-2 text-[11px] text-slate-300 animate-fadeIn">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
