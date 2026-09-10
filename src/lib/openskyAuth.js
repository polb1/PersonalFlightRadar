/**
 * OAuth2 client_credentials para OpenSky Network.
 * Cachea el token en memoria y lo refresca proactivamente cuando queda <60s.
 *
 * ⚠️ VITE_* se bundlea en el cliente. Para producción pública, proxifica el
 * token exchange desde un backend en vez de exponer el CLIENT_SECRET.
 */
// Vía proxy Vite (evita CORS). En build/preview, cambia a la URL absoluta
// o proxifica desde un backend real.
const TOKEN_URL = '/opensky-auth/auth/realms/opensky-network/protocol/openid-connect/token'

const CLIENT_ID = import.meta.env.VITE_OPENSKY_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_OPENSKY_CLIENT_SECRET

let tokenCache = null // { token: string, expiresAt: number(ms) }
let pending = null // Promise en curso, para deduplicar refreshes concurrentes

export function hasCredentials() {
  return Boolean(CLIENT_ID && CLIENT_SECRET)
}

async function requestNewToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth2 token endpoint respondió ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('Respuesta OAuth2 sin access_token')

  const expiresInMs = (Number(data.expires_in) || 1800) * 1000
  tokenCache = {
    token: data.access_token,
    // refrescamos 60s antes de la expiración real
    expiresAt: Date.now() + expiresInMs - 60_000,
  }
  console.log(
    `[SkyStream] token OAuth2 renovado — expira en ${Math.round(expiresInMs / 1000)}s`,
  )
  return tokenCache.token
}

export async function getAccessToken({ force = false } = {}) {
  if (!hasCredentials()) throw new Error('Faltan VITE_OPENSKY_CLIENT_ID/SECRET en .env')

  if (!force && tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }
  if (pending) return pending

  pending = requestNewToken().finally(() => {
    pending = null
  })
  return pending
}

export function invalidateToken() {
  tokenCache = null
}
