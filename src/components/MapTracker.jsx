import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import L from 'leaflet'

/**
 * Silueta top-down de un airliner comercial. Nose apuntando arriba (0° = norte),
 * la rotación por `true_track` se aplica al wrapper con CSS transform.
 * viewBox 32x32 mantiene los detalles nítidos incluso a 18px.
 */
const PLANE_PATH =
  'M16 2 C 15 2, 14.5 3, 14.5 5 L 14.5 12 L 2 17 L 2 19 L 14.5 16.5 ' +
  'L 14.5 24 L 11.5 26.5 L 11.5 28 L 16 27 L 20.5 28 L 20.5 26.5 ' +
  'L 17.5 24 L 17.5 16.5 L 30 19 L 30 17 L 17.5 12 L 17.5 5 ' +
  'C 17.5 3, 17 2, 16 2 Z'

function planeSvg({ color, size = 20 }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
         viewBox="0 0 32 32">
      <path d="${PLANE_PATH}"
            fill="${color}"
            stroke="rgba(0,0,0,0.55)"
            stroke-width="0.7"
            stroke-linejoin="round"/>
    </svg>`
}

function planeColor({ selected, onGround }) {
  if (selected) return '#f5b843' // acento cálido
  if (onGround) return '#94a3b8' // slate-400 apagado
  return '#f8fafc' // slate-50, blanco cálido
}

function createPlaneIcon({ heading = 0, selected = false, onGround = false }) {
  const color = planeColor({ selected, onGround })
  const size = selected ? 24 : 20
  return L.divIcon({
    className: `plane-marker ${selected ? 'selected' : ''}`,
    html: `<div class="plane-rotator" style="transform: rotate(${heading}deg);">${planeSvg({ color, size })}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function InitialView({ done, onDone }) {
  const map = useMap()
  useEffect(() => {
    if (done) return
    map.setView([40, -3], 5)
    onDone()
  }, [done, map, onDone])
  return null
}

export default function MapTracker({
  flights,
  selectedId,
  onSelect,
  initialFitDone,
  setInitialFitDone,
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
      center={[40, -3]}
      zoom={5}
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
      {markers}
    </MapContainer>
  )
}
