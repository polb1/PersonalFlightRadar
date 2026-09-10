import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import L from 'leaflet'

/**
 * Silueta detallada de airliner top-down: fuselaje + cabina + alas barridas +
 * winglets + 2 motores + estabilizadores de cola.
 * viewBox 32x32; se renderiza a 22-26px según estado.
 */
function planeSvg({ body, detail, size }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <!-- Alas principales (barrido leve; dibujadas primero, la fuselaje las cubre en el root) -->
  <path d="M 15 11.5 L 1 16.5 L 0.8 18.4 L 15 16.8 Z"
        fill="${body}" stroke="rgba(0,0,0,0.55)" stroke-width="0.4" stroke-linejoin="round"/>
  <path d="M 17 11.5 L 31 16.5 L 31.2 18.4 L 17 16.8 Z"
        fill="${body}" stroke="rgba(0,0,0,0.55)" stroke-width="0.4" stroke-linejoin="round"/>

  <!-- Winglets: pequeñas extensiones verticales en las puntas -->
  <path d="M 0.8 16.4 L 0.3 15.5 L 0.3 18.6 L 0.9 18.5 Z"
        fill="${body}" stroke="rgba(0,0,0,0.55)" stroke-width="0.35" stroke-linejoin="round"/>
  <path d="M 31.2 16.4 L 31.7 15.5 L 31.7 18.6 L 31.1 18.5 Z"
        fill="${body}" stroke="rgba(0,0,0,0.55)" stroke-width="0.35" stroke-linejoin="round"/>

  <!-- Motores bajo el ala -->
  <ellipse cx="7" cy="17.6" rx="1.1" ry="2.3"
           fill="${detail}" stroke="rgba(0,0,0,0.5)" stroke-width="0.35"/>
  <ellipse cx="25" cy="17.6" rx="1.1" ry="2.3"
           fill="${detail}" stroke="rgba(0,0,0,0.5)" stroke-width="0.35"/>

  <!-- Fuselaje + estabilizadores de cola (dibujado encima para cubrir raíz de ala) -->
  <path d="M 16 1.6
           C 14.6 1.6, 13.9 3.2, 14 5.4
           L 14 23.6
           L 10.9 26
           L 10.7 27.4
           L 12 27.5
           L 16 27
           L 20 27.5
           L 21.3 27.4
           L 21.1 26
           L 18 23.6
           L 18 5.4
           C 18.1 3.2, 17.4 1.6, 16 1.6 Z"
        fill="${body}" stroke="rgba(0,0,0,0.6)" stroke-width="0.55" stroke-linejoin="round"/>

  <!-- Cabina/cockpit: pequeño trapecio oscuro en el morro -->
  <path d="M 16 3.2 L 14.85 5.4 L 17.15 5.4 Z"
        fill="${detail}" opacity="0.8"/>
</svg>`
}

function planeColors({ selected, onGround }) {
  if (selected) return { body: '#f5b843', detail: '#5c3a0e' }
  if (onGround) return { body: '#94a3b8', detail: '#334155' }
  return { body: '#f8fafc', detail: '#475569' }
}

function createPlaneIcon({ heading = 0, selected = false, onGround = false }) {
  const { body, detail } = planeColors({ selected, onGround })
  const size = selected ? 26 : 22
  return L.divIcon({
    className: `plane-marker ${selected ? 'selected' : ''}`,
    html: `<div class="plane-rotator" style="transform: rotate(${heading}deg);">${planeSvg({ body, detail, size })}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function InitialView({ done, onDone }) {
  const map = useMap()
  useEffect(() => {
    if (done) return
    map.setView([48, 10], 4)
    onDone()
  }, [done, map, onDone])
  return null
}

/**
 * Observa moveend/zoomend y notifica los nuevos bounds. Se usa para que el
 * bbox de OpenSky siga la vista del mapa.
 */
function BoundsWatcher({ onBoundsChange }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  })
  useEffect(() => {
    onBoundsChange(map.getBounds())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function MapTracker({
  flights,
  selectedId,
  onSelect,
  initialFitDone,
  setInitialFitDone,
  onBoundsChange,
}) {
  const markers = useMemo(() => {
    return flights.map((f) => (
      <Marker
        key={f.icao24}
        position={[f.latitude, f.longitude]}
        icon={createPlaneIcon({
          heading: f.true_track || 0,
          selected: f.icao24 === selectedId,
          onGround: f.on_ground,
        })}
        eventHandlers={{ click: () => onSelect(f.icao24) }}
        keyboard={false}
      />
    ))
  }, [flights, selectedId, onSelect])

  return (
    <MapContainer
      center={[48, 10]}
      zoom={4}
      minZoom={3}
      maxZoom={12}
      zoomControl={false}
      worldCopyJump
      preferCanvas
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="osm-dark"
      />
      <InitialView done={initialFitDone} onDone={() => setInitialFitDone(true)} />
      {onBoundsChange && <BoundsWatcher onBoundsChange={onBoundsChange} />}
      {markers}
    </MapContainer>
  )
}
