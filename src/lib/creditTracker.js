/**
 * Contador de créditos OpenSky persistido en localStorage.
 * Se resetea automáticamente al cruzar medianoche UTC (día natural de la API).
 */
const KEY = 'myfr24:credits'

function todayUTC() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { day: todayUTC(), used: 0 }
    const parsed = JSON.parse(raw)
    if (parsed.day !== todayUTC()) return { day: todayUTC(), used: 0 }
    return parsed
  } catch {
    return { day: todayUTC(), used: 0 }
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* modo privado, etc. */
  }
}

/**
 * Coste según tamaño del bbox (grados² = (lamax-lamin) * (lomax-lomin)).
 * https://openskynetwork.github.io/opensky-api/rest.html
 */
export function bboxCost(bbox) {
  if (!bbox) return 4 // /states/all global
  const area = (bbox.lamax - bbox.lamin) * (bbox.lomax - bbox.lomin)
  if (area <= 25) return 1
  if (area <= 100) return 2
  if (area <= 400) return 3
  return 4
}

export function getUsage() {
  return load()
}

export function chargeCredits(n) {
  const state = load()
  state.used += n
  save(state)
  return state
}
