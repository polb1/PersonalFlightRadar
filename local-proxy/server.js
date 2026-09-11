/**
 * Proxy OpenSky en local — se expone al mundo vía Cloudflare Tunnel.
 *
 * Uso:  node local-proxy/server.js
 * Env vars:
 *   OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET
 *   (fallback: VITE_OPENSKY_CLIENT_ID / VITE_OPENSKY_CLIENT_SECRET del .env.local)
 *   PORT (default 3001)
 *
 * Existe porque OpenSky bloquea IPs de plataformas serverless
 * (Vercel + Cloudflare Workers). Sirviéndolo desde una IP residencial
 * funciona sin problemas.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cargar .env.local del proyecto padre sin dependencias externas
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvFile(path.join(__dirname, '..', '.env.local'))
loadEnvFile(path.join(__dirname, '..', '.env'))

const CLIENT_ID =
  process.env.OPENSKY_CLIENT_ID || process.env.VITE_OPENSKY_CLIENT_ID
const CLIENT_SECRET =
  process.env.OPENSKY_CLIENT_SECRET || process.env.VITE_OPENSKY_CLIENT_SECRET

const AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'

const CORS = {
  'Access-Control-Allow-Origin': 'https://myfr24.polb.dev',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

let cachedToken = null

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Faltan OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET (o VITE_*)')
  }
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OAuth ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 1800) * 1000,
  }
  console.log(`[proxy] token renovado — expira en ${data.expires_in}s`)
  return cachedToken.token
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  if (req.method !== 'GET') {
    res.writeHead(405, CORS)
    return res.end('Method Not Allowed')
  }

  try {
    const token = await getAccessToken()
    const inUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const upstream = new URL(STATES_URL)
    for (const [k, v] of inUrl.searchParams) upstream.searchParams.set(k, v)

    const upRes = await fetch(upstream.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await upRes.text()

    console.log(`[proxy] ${req.method} ${req.url} → ${upRes.status} (${body.length}B)`)

    res.writeHead(upRes.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
    })
    res.end(body)
  } catch (err) {
    console.error('[proxy] error:', err.message)
    res.writeHead(502, { 'Content-Type': 'application/json', ...CORS })
    res.end(JSON.stringify({ error: err.message }))
  }
})

const PORT = Number(process.env.PORT) || 3001
server.listen(PORT, () => {
  console.log(`[proxy] escuchando en http://localhost:${PORT}`)
  console.log(`[proxy] credenciales: ${CLIENT_ID ? 'OK' : 'FALTAN'}`)
})
