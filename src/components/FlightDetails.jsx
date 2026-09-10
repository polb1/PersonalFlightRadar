import { X, Globe2, Gauge, Mountain, Navigation, ArrowUp, ArrowDown, Minus } from 'lucide-react'

const mps2kmh = (v) => (v == null ? null : Math.round(v * 3.6))
const m2ft = (v) => (v == null ? null : Math.round(v * 3.28084))

const CARDINAL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const bearingToCardinal = (deg) => {
  if (deg == null) return null
  return CARDINAL[Math.round(((deg % 360) / 45)) % 8]
}

function Field({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-white/[0.05] last:border-b-0">
      <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-slate-500">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="num font-mono text-lg text-slate-100 font-medium tabular-nums">
          {value ?? '—'}
        </span>
        {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
      </div>
    </div>
  )
}

function VerticalRateBadge({ mps }) {
  if (mps == null) return null
  const fpm = Math.round(mps * 196.85) // m/s → ft/min
  const climbing = fpm > 100
  const descending = fpm < -100
  const Icon = climbing ? ArrowUp : descending ? ArrowDown : Minus
  const color = climbing ? 'text-emerald-400' : descending ? 'text-rose-400' : 'text-slate-500'
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      <span className="num font-mono text-[11px] tabular-nums">
        {Math.abs(fpm).toLocaleString()} ft/min
      </span>
    </div>
  )
}

export default function FlightDetails({ flight, onClose }) {
  if (!flight) return null

  const callsign = flight.callsign || '—'
  const speedKmh = mps2kmh(flight.velocity)
  const altFt = m2ft(flight.baro_altitude)
  const heading = flight.true_track != null ? Math.round(flight.true_track) : null
  const cardinal = bearingToCardinal(flight.true_track)

  return (
    <aside
      className="absolute top-5 right-5 bottom-5 w-[360px] max-w-[calc(100vw-2.5rem)]
                 z-[1000] animate-slideIn flex flex-col"
    >
      <div className="panel rounded-2xl flex-1 flex flex-col overflow-hidden">
        {/* Header con callsign prominente */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] uppercase text-slate-500 mb-1">
                Callsign
              </p>
              <h2 className="font-mono text-[22px] font-semibold text-slate-100 leading-none tracking-tight truncate">
                {callsign}
              </h2>
              <p className="text-[11px] text-slate-500 mt-2 font-mono">
                ICAO24 <span className="text-slate-400 uppercase">{flight.icao24}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200
                         hover:bg-white/[0.06] transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chips de estado */}
          <div className="flex items-center gap-1.5 mt-4">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${
                flight.on_ground
                  ? 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                  : 'bg-accent/10 text-accent border border-accent/25'
              }`}
            >
              {flight.on_ground ? 'En tierra' : 'En vuelo'}
            </span>
            {flight.category != null && flight.category > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-white/[0.04] text-slate-400 border border-white/[0.05]">
                Cat {flight.category}
              </span>
            )}
          </div>
        </div>

        {/* Datos */}
        <div className="flex-1 px-5 scroll-clean overflow-y-auto">
          <Field
            label="Origen"
            value={flight.origin_country}
          />
          <Field
            label="Altitud barométrica"
            value={altFt != null ? altFt.toLocaleString() : null}
            sub={altFt != null ? 'ft' : null}
          />
          <Field
            label="Velocidad"
            value={speedKmh != null ? speedKmh.toLocaleString() : null}
            sub={speedKmh != null ? 'km/h' : null}
          />
          <Field
            label="Rumbo"
            value={heading != null ? `${heading}°` : null}
            sub={cardinal}
          />
          <div className="py-3 border-b border-white/[0.05]">
            <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-slate-500">
              Tasa vertical
            </span>
            <div className="mt-1.5">
              <VerticalRateBadge mps={flight.vertical_rate} />
            </div>
          </div>
          <Field
            label="Posición"
            value={`${flight.latitude.toFixed(3)}, ${flight.longitude.toFixed(3)}`}
          />
          {flight.squawk && (
            <Field
              label="Squawk"
              value={flight.squawk}
              sub={
                ['7500', '7600', '7700'].includes(flight.squawk)
                  ? 'EMERGENCIA'
                  : null
              }
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.05] bg-black/20">
          <p className="text-[10px] text-slate-500 tracking-wide">
            Fuente: OpenSky Network · datos en tiempo real
          </p>
        </div>
      </div>
    </aside>
  )
}
