/**
 * Vercel Edge Function: OAuth2 + proxy a /states/all.
 *
 * Ejecuta en la red edge de Vercel (no en serverless regional), con un stack
 * de red distinto y rangos IP diferentes. OpenSky bloqueaba las IPs de
 * serverless-node desde fra1 (probado con /api/diagnose). Edge suele estar
 * fuera de esos rangos.
 *
 * Env vars: OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET (sin VITE_).
 */

export const config = { runtime: 'edge' }

const AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'
const UA = 'SkyStreamTracker/1.0 (+https://myfr24.polb.dev)'

// Cache best-effort: en Edge no está garantizado que sobreviva entre
// invocaciones, pero cuando una instancia se mantiene caliente ahorra
// llamadas al endpoint de OAuth.
let cachedToken = null

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Faltan OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET')
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 1800) * 1000,
  }
  return cachedToken.token
}

export default async function handler(req) {
  try {
    const token = await getAccessToken()

    const inUrl = new URL(req.url)
    const upstream = new URL(STATES_URL)
    for (const [k, v] of inUrl.searchParams) {
      upstream.searchParams.set(k, v)
    }

    const opensky = await fetch(upstream.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': UA,
      },
    })
    const body = await opensky.text()

    return new Response(body, {
      status: opensky.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || 'upstream error' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    )
  }
}
