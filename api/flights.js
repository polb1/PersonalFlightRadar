/**
 * Vercel Edge Function: OAuth2 + proxy a /states/all.
 * Versión instrumentada — cada paso deja rastro para diagnosticar crashes.
 */

export const config = { runtime: 'edge' }

const AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'
const UA = 'SkyStreamTracker/1.0 (+https://myfr24.polb.dev)'

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default async function handler(req) {
  const debug = []
  const step = (s) => { debug.push(s); return s }

  try {
    step('start')

    const clientId = process.env.OPENSKY_CLIENT_ID
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET
    step(`env id=${!!clientId} secret=${!!clientSecret}`)

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'missing OPENSKY_CLIENT_ID/SECRET', debug }, 500)
    }

    step('oauth POST')
    let authRes
    try {
      authRes = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      })
    } catch (e) {
      return jsonResponse({
        error: `auth fetch threw: ${e?.message || String(e)}`,
        name: e?.name,
        debug,
      }, 502)
    }
    step(`oauth status=${authRes.status}`)

    if (!authRes.ok) {
      const text = await authRes.text().catch(() => '')
      return jsonResponse({
        error: `oauth http ${authRes.status}`,
        body: text.slice(0, 500),
        debug,
      }, 502)
    }

    let token
    try {
      const data = await authRes.json()
      token = data.access_token
      step(`token len=${token?.length}`)
    } catch (e) {
      return jsonResponse({ error: `auth json parse: ${e?.message}`, debug }, 500)
    }

    if (!token) {
      return jsonResponse({ error: 'no access_token in response', debug }, 500)
    }

    step('states GET')
    const inUrl = new URL(req.url)
    const upstream = new URL(STATES_URL)
    for (const [k, v] of inUrl.searchParams) {
      upstream.searchParams.set(k, v)
    }

    let statesRes
    try {
      statesRes = await fetch(upstream.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': UA,
        },
      })
    } catch (e) {
      return jsonResponse({
        error: `states fetch threw: ${e?.message || String(e)}`,
        name: e?.name,
        debug,
      }, 502)
    }
    step(`states status=${statesRes.status}`)

    const body = await statesRes.text()
    return new Response(body, {
      status: statesRes.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return jsonResponse({
      error: err?.message || String(err) || 'unknown',
      name: err?.name,
      stack: err?.stack?.slice(0, 500),
      debug,
    }, 500)
  }
}
