'use client'

import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Play, Pause, SkipBack, SkipForward, RotateCw, Activity,
  Droplets, Cloud, Thermometer, Wind, Gauge,
} from 'lucide-react'

type LayerKey = 'precipitation' | 'clouds_new' | 'temp_new' | 'wind_new' | 'pressure_new'

type LayerMeta = {
  key: LayerKey
  label: string
  Icon: typeof Droplets
  legend: { label: string; from: string; mid: string; to: string }
  unit: string
}

const LAYERS: LayerMeta[] = [
  {
    key: 'precipitation',
    label: 'Rain',
    Icon: Droplets,
    legend: { label: 'Precipitation (mm/h)', from: '#bfdbfe', mid: '#2563eb', to: '#1e3a8a' },
    unit: 'mm/h',
  },
  {
    key: 'clouds_new',
    label: 'Clouds',
    Icon: Cloud,
    legend: { label: 'Cloud cover (%)', from: '#e2e8f0', mid: '#64748b', to: '#334155' },
    unit: '%',
  },
  {
    key: 'temp_new',
    label: 'Temp',
    Icon: Thermometer,
    legend: { label: 'Temperature (°C)', from: '#bfdbfe', mid: '#f97316', to: '#b91c1c' },
    unit: '°C',
  },
  {
    key: 'wind_new',
    label: 'Wind',
    Icon: Wind,
    legend: { label: 'Wind speed (m/s)', from: '#cffafe', mid: '#06b6d4', to: '#0e7490' },
    unit: 'm/s',
  },
  {
    key: 'pressure_new',
    label: 'Pressure',
    Icon: Gauge,
    legend: { label: 'Sea-level pressure (hPa)', from: '#ddd6fe', mid: '#a855f7', to: '#6b21a8' },
    unit: 'hPa',
  },
]

const farmIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:18px;height:18px">
    <span style="position:absolute;inset:0;border-radius:999px;background:#10b981;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>
    <span style="position:absolute;inset:-8px;border-radius:999px;border:1.5px solid rgba(16,185,129,.4);animation:radarPulse 2.4s ease-out infinite"></span>
    <span style="position:absolute;inset:-14px;border-radius:999px;border:1.5px solid rgba(16,185,129,.2);animation:radarPulse 2.4s ease-out 0.6s infinite"></span>
  </div>
  <style>@keyframes radarPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.6);opacity:0}}</style>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

type RvFrame = { time: number; path: string }
type RvIndex = {
  host: string
  radar: { past: RvFrame[]; nowcast: RvFrame[] }
}

type CurrentWeather = {
  temp: number
  humidity: number
  pressure: number
  wind: number
  clouds: number
  rain1h: number
  condition: string
  icon: string
}

function MapAutoInvalidate() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// Component to render radar sweep at the farm marker position (not screen center)
function RadarSweepAtPosition({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const [sweepPosition, setSweepPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const updatePosition = () => {
      const point = map.latLngToContainerPoint([lat, lng])
      setSweepPosition({ x: point.x, y: point.y })
    }

    // Update on mount, zoom, and move
    updatePosition()
    map.on('zoom', updatePosition)
    map.on('move', updatePosition)
    map.on('zoomend', updatePosition)
    map.on('moveend', updatePosition)

    return () => {
      map.off('zoom', updatePosition)
      map.off('move', updatePosition)
      map.off('zoomend', updatePosition)
      map.off('moveend', updatePosition)
    }
  }, [map, lat, lng])

  return (
    <div
      className="pointer-events-none absolute z-[400]"
      style={{
        left: sweepPosition.x,
        top: sweepPosition.y,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      <div
        className="rounded-full"
        style={{
          width: 280,
          height: 280,
          background:
            'conic-gradient(from 0deg, rgba(16,185,129,0) 0deg, rgba(16,185,129,.18) 45deg, rgba(16,185,129,.38) 60deg, rgba(16,185,129,0) 80deg)',
          animation: 'radarSpin 4s linear infinite',
          mixBlendMode: 'screen',
          filter: 'blur(.4px)',
        }}
      />
      <style>{`@keyframes radarSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function WeatherRadarInner({
  lat,
  lng,
  height = 380,
  defaultLayer = 'precipitation',
  compact = false,
}: {
  lat: number
  lng: number
  height?: number
  defaultLayer?: LayerKey
  compact?: boolean
}) {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? ''
  const [layer, setLayer] = useState<LayerKey>(defaultLayer)
  const [mounted, setMounted] = useState(false)
  const [showSweep, setShowSweep] = useState(true)

  const [rv, setRv] = useState<RvIndex | null>(null)
  const [rvError, setRvError] = useState<string | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [current, setCurrent] = useState<CurrentWeather | null>(null)
  const [currentLoading, setCurrentLoading] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((r) => {
        if (!r.ok) throw new Error(`rv ${r.status}`)
        return r.json()
      })
      .then((d: RvIndex) => {
        if (cancelled) return
        setRv(d)
        const past = d.radar?.past ?? []
        setFrameIdx(Math.max(0, past.length - 1))
      })
      .catch((e) => { if (!cancelled) setRvError(e.message) })
    return () => { cancelled = true }
  }, [])

  const loadCurrent = useCallback(async () => {
    if (!apiKey) return
    setCurrentLoading(true)
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`,
      )
      if (!r.ok) throw new Error(`owm ${r.status}`)
      const j = await r.json()
      setCurrent({
        temp: Math.round((j.main?.temp ?? 0) * 10) / 10,
        humidity: j.main?.humidity ?? 0,
        pressure: j.main?.pressure ?? 0,
        wind: Math.round((j.wind?.speed ?? 0) * 10) / 10,
        clouds: j.clouds?.all ?? 0,
        rain1h: j.rain?.['1h'] ?? 0,
        condition: j.weather?.[0]?.description ?? '—',
        icon: j.weather?.[0]?.icon ?? '',
      })
    } catch {
      // noop
    } finally {
      setCurrentLoading(false)
    }
  }, [apiKey, lat, lng])

  useEffect(() => {
    loadCurrent()
    const id = setInterval(loadCurrent, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [loadCurrent])

  const allFrames: RvFrame[] = useMemo(
    () => (rv ? [...rv.radar.past, ...rv.radar.nowcast] : []),
    [rv],
  )

  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current)
    if (!playing || layer !== 'precipitation' || allFrames.length === 0) return
    playRef.current = setInterval(() => {
      setFrameIdx((i) => (i + 1) % allFrames.length)
    }, 650)
    return () => {
      if (playRef.current) clearInterval(playRef.current)
    }
  }, [playing, layer, allFrames.length])

  const activeFrame = allFrames[frameIdx]
  const pastCount = rv?.radar.past.length ?? 0
  const isForecastFrame = frameIdx >= pastCount
  const frameTimeLabel = useMemo(() => {
    if (!activeFrame) return ''
    const d = new Date(activeFrame.time * 1000)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [activeFrame])

  const owmTileUrl = useMemo(
    () => (layer !== 'precipitation'
      ? `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${apiKey}`
      : null),
    [layer, apiKey],
  )
  const rvTileUrl = useMemo(() => {
    if (!rv || !activeFrame || layer !== 'precipitation') return null
    return `${rv.host}${activeFrame.path}/512/{z}/{x}/{y}/2/1_1.png`
  }, [rv, activeFrame, layer])

  const meta = LAYERS.find((l) => l.key === layer)!

  if (!apiKey) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
        Weather radar requires <code>NEXT_PUBLIC_OPENWEATHER_API_KEY</code> to be set.
      </div>
    )
  }
  if (!mounted) return <div className="bg-slate-100 rounded-lg animate-pulse" style={{ height }} />

  const readoutValue = (() => {
    if (!current) return null
    switch (layer) {
      case 'precipitation': return `${current.rain1h.toFixed(1)} ${meta.unit}`
      case 'clouds_new': return `${current.clouds}${meta.unit}`
      case 'temp_new': return `${current.temp}${meta.unit}`
      case 'wind_new': return `${current.wind} ${meta.unit}`
      case 'pressure_new': return `${current.pressure} ${meta.unit}`
    }
  })()

  const ReadoutIcon = meta.Icon

  return (
    <div className="space-y-2">
      {/* Layer picker */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {LAYERS.map((l) => {
            const active = layer === l.key
            const Ic = l.Icon
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLayer(l.key)}
                className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${
                  active
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                }`}
              >
                <Ic className="w-3 h-3" />
                {l.label}
              </button>
            )
          })}
        </div>
        {!compact && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showSweep}
                onChange={(e) => setShowSweep(e.target.checked)}
                className="w-3 h-3 accent-emerald-600"
              />
              Sweep
            </label>
            <button
              type="button"
              onClick={loadCurrent}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium"
              disabled={currentLoading}
            >
              <RotateCw className={`w-3 h-3 ${currentLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Map container */}
      <div className="relative rounded-lg overflow-hidden border border-slate-200" style={{ height }}>
        <MapContainer
          center={[lat, lng]}
          zoom={compact ? 8 : 10}
          minZoom={5}
          maxZoom={15}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          attributionControl={!compact}
        >
          <MapAutoInvalidate />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
            maxNativeZoom={19}
            maxZoom={15}
          />
          {owmTileUrl && (
            <TileLayer
              key={`owm-${layer}`}
              url={owmTileUrl}
              opacity={0.7}
              maxNativeZoom={9}
              maxZoom={15}
              attribution='&copy; OpenWeatherMap'
            />
          )}
          {rvTileUrl && (
            <TileLayer
              key={`rv-${activeFrame?.time}`}
              url={rvTileUrl}
              opacity={0.8}
              maxNativeZoom={10}
              maxZoom={15}
              attribution='&copy; RainViewer'
            />
          )}
          <Circle
            center={[lat, lng]}
            radius={compact ? 3000 : 5000}
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.06, weight: 1.5, dashArray: '4 4' }}
          />
          <Circle
            center={[lat, lng]}
            radius={compact ? 7000 : 12000}
            pathOptions={{ color: '#10b981', fillOpacity: 0, weight: 1, dashArray: '2 6', opacity: 0.5 }}
          />
          <Marker position={[lat, lng]} icon={farmIcon} />
          {showSweep && <RadarSweepAtPosition lat={lat} lng={lng} />}
        </MapContainer>

        {current && (
          <div className="absolute top-2 right-2 z-[500] bg-slate-900/75 backdrop-blur px-2.5 py-1.5 rounded-md text-white text-[11px] shadow-lg">
            <div className="flex items-center gap-1.5">
              <ReadoutIcon className="w-3 h-3 opacity-80" />
              <span className="font-mono font-semibold">{readoutValue ?? '—'}</span>
            </div>
            <div className="text-[9px] text-slate-300 capitalize">{current.condition}</div>
          </div>
        )}

        <div className="absolute bottom-2 left-2 z-[500] bg-white/90 backdrop-blur px-2 py-1 rounded shadow text-[10px] text-slate-600">
          <div className="font-medium text-slate-700 mb-0.5 text-[10px]">{meta.legend.label}</div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-500">low</span>
            <div
              className="h-1.5 w-24 rounded-full"
              style={{ background: `linear-gradient(to right, ${meta.legend.from}, ${meta.legend.mid}, ${meta.legend.to})` }}
            />
            <span className="text-[9px] text-slate-500">high</span>
          </div>
        </div>
      </div>

      {/* Time-lapse controls — only for precipitation */}
      {layer === 'precipitation' && !compact && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          {rvError ? (
            <div className="text-[11px] text-rose-600">Radar time-lapse unavailable: {rvError}</div>
          ) : !rv ? (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3 h-3 animate-pulse" /> Loading radar frames…
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setPlaying(false); setFrameIdx((i) => Math.max(0, i - 1)) }}
                className="p-1 rounded hover:bg-slate-200 text-slate-600"
                title="Previous frame"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="p-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => { setPlaying(false); setFrameIdx((i) => Math.min(allFrames.length - 1, i + 1)) }}
                className="p-1 rounded hover:bg-slate-200 text-slate-600"
                title="Next frame"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, allFrames.length - 1)}
                value={frameIdx}
                onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)) }}
                className="flex-1 accent-emerald-600"
              />
              <div className="text-[11px] font-mono text-slate-700 min-w-[100px] text-right">
                {frameTimeLabel}
                <span className={`ml-1 text-[9px] uppercase px-1 rounded ${isForecastFrame ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                  {isForecastFrame ? 'forecast' : 'past'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data readout grid */}
      {!compact && current && (
        <div className="grid grid-cols-5 gap-1.5 text-[10px]">
          {[
            { Ic: Thermometer, label: 'Temp', v: `${current.temp}°C` },
            { Ic: Droplets, label: 'Rain', v: `${current.rain1h.toFixed(1)}mm` },
            { Ic: Wind, label: 'Wind', v: `${current.wind}m/s` },
            { Ic: Cloud, label: 'Clouds', v: `${current.clouds}%` },
            { Ic: Gauge, label: 'Pressure', v: `${current.pressure}hPa` },
          ].map((it) => (
            <div key={it.label} className="bg-white border border-slate-200 rounded p-1.5 text-center">
              <it.Ic className="w-3 h-3 text-emerald-600 mx-auto mb-0.5" />
              <div className="text-slate-400 uppercase tracking-wide text-[9px]">{it.label}</div>
              <div className="font-semibold text-slate-800 font-mono text-[11px]">{it.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
