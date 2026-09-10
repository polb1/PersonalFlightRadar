import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

function Metric({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'accent' ? 'text-accent'
    : tone === 'muted' ? 'text-slate-400'
    : 'text-slate-100'
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[9px] sm:text-[10px] font-medium tracking-[0.14em] uppercase text-slate-500 truncate">
        {label}
      </span>
      <span className={`num font-mono text-lg sm:text-2xl font-semibold leading-none mt-1 ${toneClass}`}>
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
      : status === 'loading'
      ? 'bg-slate-400'
      : 'bg-emerald-400'
  return (
    <span className="relative flex items-center justify-center w-2 h-2">
      <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping-slow ${color}`} />
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

function TimeAgo({ date }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!date) return <span>—</span>
  const s = Math.max(0, Math.floor((now - date.getTime()) / 1000))
  if (s < 5) return <span>ahora</span>
  if (s < 60) return <span>hace {s}s</span>
  const m = Math.floor(s / 60)
  return <span>hace {m} min</span>
}

function statusLabel(status) {
  switch (status) {
    case 'loading': return 'Sincronizando'
    case 'ok': return 'En vivo'
    case 'demo': return 'Modo demo'
    case 'rate-limited': return 'Servicio ocupado'
    case 'unauthorized': return 'Sin acceso'
    case 'error': return 'Sin conexión'
    default: return 'Iniciando'
  }
}

export default function StatsOverlay({
  flights, status, error, lastUpdated, refreshMs,
}) {
  const total = flights.length
  const airborne = flights.filter((f) => !f.on_ground).length
  const grounded = total - airborne
  const countries = new Set(flights.map((f) => f.origin_country).filter(Boolean)).size

  return (
    <div
      className="absolute z-[999] animate-fadeIn safe-t
                 top-2 left-2 right-2
                 sm:top-5 sm:left-5 sm:right-auto sm:w-[380px] sm:max-w-[calc(100vw-2.5rem)]"
    >
      <div className="panel rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <svg width="18" height="18" viewBox="0 0 32 32" className="text-accent shrink-0">
              <path
                d="M16 2 C 15 2, 14.5 3, 14.5 5 L 14.5 12 L 2 17 L 2 19 L 14.5 16.5 L 14.5 24 L 11.5 26.5 L 11.5 28 L 16 27 L 20.5 28 L 20.5 26.5 L 17.5 24 L 17.5 16.5 L 30 19 L 30 17 L 17.5 12 L 17.5 5 C 17.5 3, 17 2, 16 2 Z"
                fill="currentColor"
              />
            </svg>
            <div className="min-w-0">
              <h1 className="text-[14px] sm:text-[15px] font-semibold text-slate-100 leading-none truncate">
                SkyStream <span className="text-slate-500 font-normal">Tracker</span>
              </h1>
              <p className="hidden sm:block text-[10px] text-slate-500 mt-1 tracking-wide">
                Vuelos en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LiveDot status={status} />
            <span className="text-[11px] font-medium text-slate-300">
              {statusLabel(status)}
            </span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 px-3 sm:px-5 pb-3 sm:pb-4">
          <Metric label="Aviones" value={total.toLocaleString()} />
          <Metric label="Volando" value={airborne.toLocaleString()} tone="accent" />
          <Metric label="Tierra" value={grounded.toLocaleString()} tone="muted" />
          <Metric label="Países" value={countries} tone="muted" />
        </div>

        {/* Barra de sync */}
        <div className="px-3 sm:px-5 pb-2 sm:pb-3">
          <SyncProgress status={status} refreshMs={refreshMs} lastUpdated={lastUpdated} />
        </div>

        {/* Footer amable */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-t border-white/[0.05] bg-black/20 text-[10px] sm:text-[11px] text-slate-400">
          <span>Actualizado <TimeAgo date={lastUpdated} /></span>
          <span className="text-slate-500 hidden xs:inline sm:inline">Área visible</span>
        </div>
      </div>

      {error && status !== 'ok' && (
        <div className="mt-2 flex items-start gap-2 panel rounded-xl px-3 py-2.5 text-[11px] text-slate-200 animate-fadeIn border-l-2 border-l-accent">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-accent shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-slate-100">Problema recibiendo datos</span>
            <span className="text-slate-400 break-words">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}
