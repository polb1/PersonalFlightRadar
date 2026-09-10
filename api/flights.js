/**
 * Serverless function de Vercel que:
 *  1. Hace el OAuth2 client_credentials contra OpenSky server-side
 *  2. Cachea el token en memoria (dura mientras la instancia esté caliente)
 *  3. Proxifica GET /api/flights?lamin=...&lomin=... a /states/all
 *
 * Env vars requeridas en Vercel (Settings → Environment Variables):
 *   OPENSKY_CLIENT_ID
 *   OPENSKY_CLIENT_SECRET
 *
 * Ojo: SIN prefijo VITE_ — así se quedan en el server y no salen al bundle.
 */

let cachedToken = null // { token, expiresAt(ms) }

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Faltan OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET en el server (Vercel env vars)',
    )
  }

  const res = await fetch(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
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
  return cachedToken.token
}

export default async function handler(req, res) {
  try {
    const token = await getAccessToken()

    const upstream = new URL('https://opensky-network.org/api/states/all')
    for (const [k, v] of Object.entries(req.query || {})) {
      if (v != null && v !== '') upstream.searchParams.set(k, String(v))
    }

    const opensky = await fetch(upstream.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await opensky.text()

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.status(opensky.status).send(body)
  } catch (err) {
    console.error('[api/flights]', err)
    res.status(502).json({ error: err.message || 'upstream error' })
  }
}
