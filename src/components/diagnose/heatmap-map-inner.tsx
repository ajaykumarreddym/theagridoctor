'use client'

import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'

export type HeatPoint = {
  id: string
  lat: number
  lng: number
  crop_type: string
  disease_name: string | null
  severity: string
  status: string
  created_at: string
  is_mine: boolean
}

const SEV_COLOR: Record<string, string> = {
  critical: '#e11d48',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
  unknown: '#64748b',
}
const SEV_RADIUS: Record<string, number> = {
  critical: 14,
  high: 11,
  medium: 9,
  low: 7,
  unknown: 6,
}

function centroid(points: HeatPoint[]): [number, number] {
  if (points.length === 0) return [22.0, 79.0] // India centre
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length
  return [lat, lng]
}

export default function HeatmapMapInner({
  points,
  height = 520,
}: {
  points: HeatPoint[]
  height?: number
}) {
  const [lat, lng] = centroid(points)
  const zoom = points.length <= 1 ? 5 : points.length > 30 ? 5 : 6

  return (
    <div style={{ height }} className="w-full rounded-lg overflow-hidden border border-slate-200">
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        minZoom={3}
        maxZoom={18}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Streets">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxNativeZoom={19}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxNativeZoom={18}
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {points.length > 0 && (
          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={(cluster: { getChildCount: () => number }) => {
              const count = cluster.getChildCount()
              const color = count < 5 ? '#10b981' : count < 20 ? '#f59e0b' : count < 50 ? '#f97316' : '#e11d48'
              const size = count < 10 ? 36 : count < 50 ? 44 : 54
              return L.divIcon({
                html: `<div style="background:${color};color:#fff;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:3px solid #ffffffcc;box-shadow:0 2px 6px rgba(0,0,0,.25);">${count}</div>`,
                className: 'heatmap-cluster',
                iconSize: L.point(size, size, true),
              })
            }}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            maxClusterRadius={50}
          >
            {points.map((p) => {
              const color = SEV_COLOR[p.severity] ?? SEV_COLOR.unknown
              const radius = SEV_RADIUS[p.severity] ?? SEV_RADIUS.unknown
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={radius}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: p.status === 'resolved' ? 0.25 : 0.55,
                    weight: p.is_mine ? 2.5 : 1.2,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 mb-0.5">
                        {p.disease_name ?? 'Unknown issue'}
                      </p>
                      <p className="text-slate-600">
                        Crop: <span className="font-medium">{p.crop_type}</span>
                      </p>
                      <p className="text-slate-600 capitalize">
                        Severity: <span className="font-medium" style={{ color }}>{p.severity}</span> · {p.status}
                      </p>
                      <p className="text-slate-400 mt-1">
                        {new Date(p.created_at).toLocaleDateString()}
                        {p.is_mine && <span className="ml-1 text-emerald-600 font-medium">· you</span>}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MarkerClusterGroup>
        )}
      </MapContainer>
    </div>
  )
}
