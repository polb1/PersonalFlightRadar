/**
 * Endpoint de diagnóstico: prueba conectividad a hosts clave desde el runtime
 * de Vercel para aislar bloqueos de red. NO expone secretos.
 *
 * Uso: GET https://<dominio>/api/diagnose
 */
import dns from 'node:dns/promises'

const TARGETS = [
  { name: 'opensky-auth', host: 'auth.opensky-network.org', url: 'https://auth.opensky-network.org/' },
  { name: 'opensky-api', host: 'opensky-network.org', url: 'https://opensky-network.org/api/' },
  { name: 'google-control', host: 'www.google.com', url: 'https://www.google.com/generate_204' },
  { name: 'cloudflare-control', host: '1.1.1.1', url: 'https://1.1.1.1/' },
]

async function probe(target) {
  const result = { name: target.name, host: target.host }

  // 1. Resolución DNS
  try {
    const t0 = Date.now()
    const [v4, v6] = await Promise.allSettled([
      dns.resolve4(target.host).catch(() => []),
      dns.resolve6(target.host).catch(() => []),
    ])
    result.dns = {
      ms: Date.now() - t0,
      v4: v4.status === 'fulfilled' ? v4.value : [],
      v6: v6.status === 'fulfilled' ? v6.value : [],
    }
  } catch (e) {
    result.dns = { error: e.message }
  }

  // 2. Fetch HEAD con timeout 8s
  try {
    const t0 = Date.now()
    const res = await fetch(target.url, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'SkyStream-Diagnose/1.0' },
    })
    result.fetch = { ms: Date.now() - t0, status: res.status }
  } catch (e) {
    const cause = e.cause
    result.fetch = {
      error: e.message,
      cause: cause ? { code: cause.code, message: cause.message } : null,
    }
  }
  return result
}

export default async function handler(req, res) {
  const started = Date.now()
  const region = process.env.VERCEL_REGION || 'unknown'
  const nodeVersion = process.version

  const results = await Promise.all(TARGETS.map(probe))

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    region,
    node: nodeVersion,
    totalMs: Date.now() - started,
    hasOpenSkyEnv: {
      OPENSKY_CLIENT_ID: Boolean(process.env.OPENSKY_CLIENT_ID),
      OPENSKY_CLIENT_SECRET: Boolean(process.env.OPENSKY_CLIENT_SECRET),
    },
    probes: results,
  })
}
