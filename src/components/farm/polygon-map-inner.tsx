'use client'

import 'leaflet/dist/leaflet.css'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, CircleMarker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Button } from '@/components/ui/button'
import { Check, Trash2, Undo2 } from 'lucide-react'

// Fix default marker icons in Next.js (leaflet expects them on disk)
// We inline a simple divIcon instead to avoid bundling asset paths.
const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;border-radius:999px;background:#10b981;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

type LatLng = [number, number] // [lat, lng]

function ClickCatcher({ onAdd }: { onAdd: (pt: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function ringClosed(pts: LatLng[]): LatLng[] {
  if (pts.length === 0) return pts
  const [la0, ln0] = pts[0]
  const [laN, lnN] = pts[pts.length - 1]
  if (la0 === laN && ln0 === lnN) return pts
  return [...pts, pts[0]]
}

function ringToGeoJsonCoords(pts: LatLng[]) {
  // GeoJSON uses [lng, lat]
  return ringClosed(pts).map(([la, ln]) => [ln, la])
}

export default function PolygonMapInner({
  centerLat,
  centerLng,
  onSave,
  onCancel,
  saving,
}: {
  centerLat: number
  centerLng: number
  onSave: (geoJsonFeature: {
    type: 'Feature'
    properties: Record<string, unknown>
    geometry: { type: 'Polygon'; coordinates: number[][][] }
  }) => void
  onCancel: () => void
  saving?: boolean
}) {
  const [points, setPoints] = useState<LatLng[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const canSave = points.length >= 3

  function save() {
    const coords = ringToGeoJsonCoords(points)
    onSave({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] },
    })
  }

  if (!mounted) return <div className="h-[460px] bg-slate-100 rounded-lg animate-pulse" />

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
        <strong>Tap on the map</strong> to add polygon vertices (minimum 3). Use <em>Undo</em> to remove the last point.
        When finished, click <em>Save polygon</em> — monitoring will begin on the next scan.
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-200" style={{ height: 460 }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={16}
          minZoom={5}
          maxZoom={18}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={18}
          />
          <TileLayer
            attribution='Esri Satellite'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            opacity={0.85}
            maxNativeZoom={18}
            maxZoom={18}
          />
          <ClickCatcher onAdd={(p) => setPoints((arr) => [...arr, p])} />
          {points.length > 0 && (
            <Polygon
              positions={points}
              pathOptions={{ color: '#10b981', weight: 2, fillOpacity: 0.25 }}
            />
          )}
          {points.map((p, i) => (
            <CircleMarker
              key={i}
              center={p}
              radius={5}
              pathOptions={{ color: 'white', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
            />
          ))}
          <Marker position={[centerLat, centerLng]} icon={pinIcon} />
        </MapContainer>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          {points.length} point{points.length === 1 ? '' : 's'} {points.length < 3 && <span>— need at least 3 to save</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPoints((arr) => arr.slice(0, -1))}
            disabled={points.length === 0 || saving}
          >
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPoints([])}
            disabled={points.length === 0 || saving}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!canSave || saving}>
            {saving ? 'Saving…' : (<><Check className="w-4 h-4 mr-1" /> Save polygon</>)}
          </Button>
        </div>
      </div>
    </div>
  )
}
