import { useEffect, useRef, useState, useCallback } from 'react'
import { getAccessToken, invalidateToken, hasCredentials } from '../lib/openskyAuth.js'
import { bboxCost, chargeCredits, getUsage } from '../lib/creditTracker.js'

const STATE_KEYS = [
  'icao24',
  'callsign',
  'origin_country',
  'time_position',
  'last_contact',
  'longitude',
  'latitude',
  'baro_altitude',
  'on_ground',
  'velocity',
  'true_track',
  'vertical_rate',
  'sensors',
  'geo_altitude',
  'squawk',
  'spi',
  'position_source',
  'category', // solo presente si pedimos extended=1
]

function normalize(stateArray) {
  const obj = {}
  STATE_KEYS.forEach((key, i) => {
    obj[key] = stateArray[i]
  })
  if (typeof obj.callsign === 'string') obj.callsign = obj.callsign.trim()
  return obj
}

/**
 * BBOX por defecto: Península Ibérica + Baleares.
 * Área ≈ (44-35) * (5-(-10)) = 135 sq° → 3 créditos.
 * Bájalo si quieres 1 crédito por petición (área ≤ 25 sq°).
 */
const DEFAULT_BBOX = { lamin: 35, lomin: -10, lamax: 44, lomax: 5 }

function generateDemoFlights(n = 40) {
  const countries = ['Spain', 'France', 'Germany', 'Italy', 'United Kingdom', 'Portugal']
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({
      icao24: `demo${i.toString(16).padStart(4, '0')}`,
      callsign: `SIM${1000 + i}`,
      origin_country: countries[i % countries.length],
      longitude: -10 + Math.random() * 15,
      latitude: 35 + Math.random() * 9,
      baro_altitude: 8000 + Math.random() * 4000,
      on_ground: false,
      velocity: 200 + Math.random() * 60,
      true_track: Math.random() * 360,
      demo: true,
    })
  }
  return out
}

export default function useFlightData({
  refreshMs = 15000,
  bbox = DEFAULT_BBOX,
  extended = true,
  demoFallback = true,
} = {}) {
  const [flights, setFlights] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | ok | error | rate-limited | demo | unauthorized
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [usage, setUsage] = useState(() => getUsage())
  const [authed, setAuthed] = useState(hasCredentials())
  const abortRef = useRef(null)
  const failCountRef = useRef(0)

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
    // Ruta proxificada por Vite → https://opensky-network.org/api/states/all
    return `/opensky-api/states/all${qs ? `?${qs}` : ''}`
  }, [bbox, extended])

  const doFetch = useCallback(
    async (retryOn401 = true) => {
      const url = buildUrl()
      const headers = {}

      if (hasCredentials()) {
        try {
          const token = await getAccessToken()
          headers.Authorization = `Bearer ${token}`
          setAuthed(true)
        } catch (err) {
          console.warn('[SkyStream] no se pudo obtener token OAuth2 — modo anónimo', err)
          setAuthed(false)
        }
      }

      const ctrl = new AbortController()
      abortRef.current = ctrl

      const res = await fetch(url, { headers, signal: ctrl.signal })

      // Token caducado / rechazado → refrescar y reintentar una vez
      if (res.status === 401 && retryOn401 && hasCredentials()) {
        console.warn('[SkyStream] 401 recibido, forzando refresh de token')
        invalidateToken()
        return doFetch(false)
      }
      return res
    },
    [buildUrl],
  )

  const fetchFlights = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    setStatus((s) => (s === 'ok' || s === 'idle' ? 'loading' : s))

    try {
      const res = await doFetch()

      if (res.status === 401) {
        setStatus('unauthorized')
        setError('OAuth2 rechazado. Revisa CLIENT_ID/SECRET en .env.local.')
        return
      }
      if (res.status === 429) {
        failCountRef.current++
        setStatus('rate-limited')
        setError('OpenSky limitó las peticiones (429). Sin créditos o demasiado rápido.')
        if (demoFallback && failCountRef.current >= 2) activateDemo('rate-limit')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const list = (data.states || [])
        .filter((s) => s[5] != null && s[6] != null)
        .map(normalize)

      const cost = bboxCost(bbox)
      const newUsage = chargeCredits(cost)
      setUsage(newUsage)

      console.log(
        `[SkyStream] ok — ${list.length} aviones · coste ${cost} créditos · total hoy ${newUsage.used}`,
      )

      if (list.length === 0 && !hasCredentials()) {
        failCountRef.current++
        setError('OpenSky respondió vacío (posible bloqueo anónimo).')
        if (demoFallback && failCountRef.current >= 2) {
          activateDemo('empty')
          return
        }
      }

      failCountRef.current = 0
      setFlights(list)
      setLastUpdated(new Date())
      setStatus('ok')
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[SkyStream] fetch error', err)
      failCountRef.current++
      setStatus('error')
      setError(err.message || 'Error de red contactando OpenSky.')
      if (demoFallback && failCountRef.current >= 2) activateDemo('error')
    }
  }, [doFetch, bbox, demoFallback])

  const activateDemo = (reason) => {
    console.warn(`[SkyStream] activando modo DEMO (${reason})`)
    setFlights(generateDemoFlights())
    setStatus('demo')
    setLastUpdated(new Date())
  }

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
    authed,
    creditCost: bboxCost(bbox),
    refetch: fetchFlights,
  }
}
