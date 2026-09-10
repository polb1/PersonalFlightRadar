/**
 * Serverless function de Vercel: OAuth2 + proxy a /states/all.
 * Env vars requeridas: OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET (sin VITE_).
 */
import { Agent } from 'undici'

const AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'

const UA = 'SkyStreamTracker/1.0 (+https://myfr24.polb.dev)'

/**
 * Dispatcher que fuerza IPv4 y sube el timeout de conexión. Sin esto, undici
 * intenta IPv6 primero contra auth.opensky-network.org y en algunas regiones
 * de Vercel esa ruta está caída → CONNECT_TIMEOUT tras 10s.
 */
const dispatcher = new Agent({
  connect: {
    family: 4, // IPv4 only
    timeout: 15_000,
  },
  headersTimeout: 15_000,
  bodyTimeout: 15_000,
})

let cachedToken = null

async function safeFetch(url, opts, label) {
  try {
    return await fetch(url, {
      ...opts,
      dispatcher,
      headers: { 'User-Agent': UA, ...(opts?.headers || {}) },
    })
  } catch (err) {
    const cause = err.cause
    const detail = cause
      ? `${cause.code || cause.name || 'unknown'}: ${cause.message || cause}`
      : err.message || 'unknown'
    console.error(`[api/flights] ${label} network error →`, err, cause)
    throw new Error(`${label} network fail — ${detail}`)
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Faltan OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET en el server')
  }

  const res = await safeFetch(
    AUTH_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
    'auth',
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 1800) * 1000,
  }
  console.log(`[api/flights] token renovado — expira en ${data.expires_in}s`)
  return cachedToken.token
}

export default async function handler(req, res) {
  try {
    const token = await getAccessToken()

    const upstream = new URL(STATES_URL)
    for (const [k, v] of Object.entries(req.query || {})) {
      if (v != null && v !== '') upstream.searchParams.set(k, String(v))
    }

    const opensky = await safeFetch(
      upstream.toString(),
      { headers: { Authorization: `Bearer ${token}` } },
      'states',
    )
    const body = await opensky.text()

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.status(opensky.status).send(body)
  } catch (err) {
    console.error('[api/flights]', err)
    res.status(502).json({ error: err.message || 'upstream error' })
  }
}
