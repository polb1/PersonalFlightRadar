/**
 * Cloudflare Worker: proxy OAuth2 + /states/all para OpenSky.
 *
 * Bypaseá el bloqueo IP que OpenSky aplica a Vercel — Cloudflare edge sale
 * por otra red y OpenSky no la bloquea.
 *
 * Configuración en Cloudflare Workers:
 *  - Secrets:      OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET
 *  - Custom domain (opcional): sky-api.polb.dev
 *  - CORS: permite el origin del frontend (ver ALLOWED_ORIGIN)
 */

const AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'
const UA = 'SkyStreamTracker/1.0 (+cloudflare-worker)'

const ALLOWED_ORIGIN = 'https://myfr24.polb.dev'

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

let cachedToken = null

async function getAccessToken(env) {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) {
    throw new Error('Faltan OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET (Secrets del Worker)')
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.OPENSKY_CLIENT_ID,
      client_secret: env.OPENSKY_CLIENT_SECRET,
    }).toString(),
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: cors })
    }

    try {
      const token = await getAccessToken(env)

      const inUrl = new URL(request.url)
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
          ...cors,
        },
      })
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err?.message || 'upstream error' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }
  },
}
