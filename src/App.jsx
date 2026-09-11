import { useCallback, useMemo, useRef, useState } from 'react'
import MapTracker from './components/MapTracker.jsx'
import FlightDetails from './components/FlightDetails.jsx'
import StatsOverlay from './components/StatsOverlay.jsx'
import useFlightData from './hooks/useFlightData.js'

const REFRESH_MS = 15000

// Vista inicial mientras Leaflet monta y emite el primer moveend.
const INITIAL_BBOX = { lamin: 30, lomin: -20, lamax: 65, lomax: 40 }

export default function App() {
  const [bbox, setBbox] = useState(INITIAL_BBOX)
  const [selectedId, setSelectedId] = useState(null)
  const [initialFitDone, setInitialFitDone] = useState(false)

  // Debounce simple para evitar refetch por cada pixel de pan/zoom
  const debounceRef = useRef(null)
  const handleBoundsChange = useCallback((bounds) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setBbox({
        lamin: Math.max(-90, bounds.getSouth()),
        lomin: Math.max(-180, bounds.getWest()),
        lamax: Math.min(90, bounds.getNorth()),
        lomax: Math.min(180, bounds.getEast()),
      })
    }, 700)
  }, [])

  const { flights, status, error, lastUpdated, usage, creditCost } = useFlightData({
    refreshMs: REFRESH_MS,
    bbox,
  })

  const selectedFlight = useMemo(
    () => flights.find((f) => f.icao24 === selectedId) || null,
    [flights, selectedId],
  )

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <MapTracker
        flights={flights}
        selectedId={selectedId}
        onSelect={setSelectedId}
        initialFitDone={initialFitDone}
        setInitialFitDone={setInitialFitDone}
        onBoundsChange={handleBoundsChange}
      />

      <StatsOverlay
        flights={flights}
        status={status}
        error={error}
        lastUpdated={lastUpdated}
        refreshMs={REFRESH_MS}
        usage={usage}
        creditCost={creditCost}
      />

      {selectedFlight && (
        <FlightDetails flight={selectedFlight} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
