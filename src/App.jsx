import { useMemo, useState } from 'react'
import MapTracker from './components/MapTracker.jsx'
import FlightDetails from './components/FlightDetails.jsx'
import StatsOverlay from './components/StatsOverlay.jsx'
import useFlightData from './hooks/useFlightData.js'

const REFRESH_MS = 12000

export default function App() {
  const { flights, status, error, lastUpdated, usage, authed, creditCost } = useFlightData({
    refreshMs: REFRESH_MS,
  })
  const [selectedId, setSelectedId] = useState(null)
  const [initialFitDone, setInitialFitDone] = useState(false)

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
      />

      <StatsOverlay
        flights={flights}
        status={status}
        error={error}
        lastUpdated={lastUpdated}
        refreshMs={REFRESH_MS}
        usage={usage}
        authed={authed}
        creditCost={creditCost}
      />

      {selectedFlight && (
        <FlightDetails flight={selectedFlight} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
