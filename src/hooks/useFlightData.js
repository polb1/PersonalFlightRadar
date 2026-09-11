import { useEffect, useRef, useState, useCallback } from 'react'
import { bboxCost, chargeCredits, getUsage } from '../lib/creditTracker.js'

const STATE_KEYS = [
  'icao24', 'callsign', 'origin_country',
  'time_position', 'last_contact',
  'longitude', 'latitude', 'baro_altitude',
  'on_ground', 'velocity', 'true_track', 'vertical_rate',
  'sensors', 'geo_altitude', 'squawk', 'spi', 'position_source',
  'category',
]

function normalize(stateArray) {
  const obj = {}
  STATE_KEYS.forEach((key, i) => {
    obj[key] = stateArray[i]
  })
  if (typeof obj.callsign === 'string') obj.callsign = obj.callsign.trim()
  return obj
}

const DEFAULT_BBOX = { lamin: 35, lomin: -10, lamax: 44, lomax: 5 }

/**
 * Todo el tráfico pasa por el proxy en sky-api.polb.dev (Cloudflare Tunnel
 * → Node local, que hace el OAuth2 contra OpenSky). El frontend nunca ve
 * las credenciales ni habla directamente con OpenSky.
 * VITE_API_BASE permite sobrescribir la URL desde build.
 */
const API_BASE = (import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ||
                  'https://sky-api.polb.dev')

export default function useFlightData({
  refreshMs = 15000,
  bbox = DEFAULT_BBOX,
  extended = true,
} = {}) {
  const [flights, setFlights] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [usage, setUsage] = useState(() => getUsage())
  const abortRef = useRef(null)

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (bbox) {
      params.set('lamin', bbox.lamin)
      params.set('lomin', bbox.lomin)
      params.set('lamax', bbox.lamax)
      params.set('lomax', bbox.lomax)
    }
    if (extended) params.set('extended', '1')
    const qs = params.toString()
    return `${API_BASE}${qs ? `?${qs}` : ''}`
  }, [bbox, extended])

  const fetchFlights = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setStatus((s) => (s === 'ok' || s === 'idle' ? 'loading' : s))

    try {
      const res = await fetch(buildUrl(), { signal: ctrl.signal })

      if (res.status === 429) {
        setStatus('rate-limited')
        setError('Servicio limitado. Sin créditos o demasiado rápido.')
        return
      }
      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.clone().json()
          if (body?.error) detail = `${res.status}: ${body.error}`
        } catch {
          try {
            const txt = await res.clone().text()
            if (txt) detail = `${res.status}: ${txt.slice(0, 200)}`
          } catch {}
        }
        throw new Error(detail)
      }

      const data = await res.json()
      const list = (data.states || [])
        .filter((s) => s[5] != null && s[6] != null)
        .map(normalize)

      const cost = bboxCost(bbox)
      const newUsage = chargeCredits(cost)
      setUsage(newUsage)

      console.log(
        `[myfr24] ok — ${list.length} aviones · coste ${cost} créditos · total hoy ${newUsage.used}`,
      )

      setFlights(list)
      setLastUpdated(new Date())
      setStatus('ok')
      setError(list.length === 0 ? 'Sin aviones en la zona visible.' : null)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[myfr24] fetch error', err)
      setStatus('error')
      setError(err.message || 'Error de red.')
    }
  }, [buildUrl, bbox])

  useEffect(() => {
    fetchFlights()
    const id = setInterval(fetchFlights, refreshMs)
    return () => {
      clearInterval(id)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchFlights, refreshMs])

  return {
    flights,
    status,
    error,
    lastUpdated,
    usage,
    creditCost: bboxCost(bbox),
    refetch: fetchFlights,
  }
}
