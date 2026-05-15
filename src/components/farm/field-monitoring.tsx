'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, AlertCircle, CloudRain, CloudSun, Droplets, Gauge, Leaf, Loader2, Map as MapIcon, Radar, RefreshCw, Satellite, Sun, Thermometer, Wind, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PolygonMap } from './polygon-map'
import { computeAlerts, alertToneClasses, type MonitorSnapshot } from '@/lib/alerts'

type Snapshot = {
  scanned_at: string
  weather: {
    main: { temp: number; humidity: number; pressure: number; temp_min: number; temp_max: number }
    wind: { speed: number; deg: number }
    weather: { main: string; description: string; icon: string }[]
    clouds: { all: number }
    rain?: { '1h'?: number; '3h'?: number }
  } | null
  forecast: Array<{
    dt: number
    main: { temp: number; humidity: number }
    weather: { main: string; description: string; icon: string }[]
    rain?: { '3h'?: number }
  }> | null
  soil: { dt: number; t10: number; moisture: number; t0: number } | null
  uvi: { dt: number; uvi: number } | null
  ndvi: {
    image: { dt: number; cl: number; type: string; image: { ndvi: string; truecolor: string; falsecolor: string } }
    stats: { min?: number; max?: number; mean?: number; median?: number; std?: number; num?: number } | null
  } | null
  accumulated_gdd: { dt: number; temp: number; count: number } | null
  accumulated_rain: { dt: number; rain: number; count: number } | null
  errors: Record<string, string | null>
}

type MonitorResponse = {
  enabled: boolean
  farm: {
    id: string
    last_scan_at: string | null
    polygon_area_ha?: number | null
    polygon_radius_m?: number | null
  }
  snapshot?: Snapshot
  cached?: boolean
}

function kelvinToC(k?: number) {
  if (typeof k !== 'number') return '—'
  return (k - 273.15).toFixed(1)
}

function formatTime(iso?: string | null) {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleString()
}

function ndviColor(mean?: number): string {
  if (mean === undefined) return 'text-slate-500'
  if (mean >= 0.6) return 'text-emerald-600'
  if (mean >= 0.4) return 'text-lime-600'
  if (mean >= 0.2) return 'text-amber-600'
  return 'text-red-600'
}

function ndviLabel(mean?: number): string {
  if (mean === undefined) return '—'
  if (mean >= 0.6) return 'Healthy & dense'
  if (mean >= 0.4) return 'Moderate vigour'
  if (mean >= 0.2) return 'Sparse / stressed'
  return 'Very poor / bare'
}

export function FieldMonitoring({ farmId, farmLat, farmLng }: { farmId: string; farmLat: number | null; farmLng: number | null }) {
  const [state, setState] = useState<MonitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [radius, setRadius] = useState(300)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMonitor = useCallback(async (forceRefresh = false) => {
    const res = await fetch(`/api/farms/${farmId}/monitor${forceRefresh ? '?refresh=1' : ''}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return (await res.json()) as MonitorResponse
  }, [farmId])

  // Initial load
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMonitor(false)
      .then((data) => { if (!cancelled) setState(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchMonitor])

  // Radar: auto-refresh every 10 minutes when enabled
  useEffect(() => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current)
    if (state?.enabled) {
      scanTimerRef.current = setInterval(() => {
        fetchMonitor(false).then(setState).catch(() => { /* silent */ })
      }, 10 * 60 * 1000)
    }
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current)
    }
  }, [state?.enabled, fetchMonitor])

  const handleEnable = async (payload?: { geo_json?: unknown }) => {
    setEnabling(true)
    setError(null)
    try {
      const body = payload?.geo_json ? { geo_json: payload.geo_json } : { radius_m: radius }
      const res = await fetch(`/api/farms/${farmId}/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? `HTTP ${res.status}`)
      }
      setShowMap(false)
      setState(await fetchMonitor(true))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnabling(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      setState(await fetchMonitor(true))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('Disable field monitoring and remove satellite polygon?')) return
    setDisabling(true)
    try {
      const res = await fetch(`/api/farms/${farmId}/monitor`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disable')
      setState(await fetchMonitor(false))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDisabling(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading field data…</span>
        </CardContent>
      </Card>
    )
  }

  // Not enabled yet
  if (!state?.enabled) {
    const hasCoords = typeof farmLat === 'number' && typeof farmLng === 'number'
    return (
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Satellite className="w-4 h-4 text-emerald-600" />
            Field Monitoring
          </CardTitle>
          <CardDescription>
            Enable satellite + weather monitoring for this field (OpenWeatherMap Agro).
            Captures NDVI vegetation index, soil moisture, UV, and local weather every 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasCoords && !showMap ? (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>This farm has no GPS coordinates yet. Edit the farm and set latitude + longitude, or draw a polygon on the map below.</span>
            </div>
          ) : null}

          {showMap && hasCoords ? (
            <PolygonMap
              centerLat={farmLat as number}
              centerLng={farmLng as number}
              saving={enabling}
              onCancel={() => setShowMap(false)}
              onSave={(feature) => handleEnable({ geo_json: feature })}
            />
          ) : (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Field radius (metres)</label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={radius}
                  onChange={(e) => setRadius(Math.max(50, Math.min(5000, parseInt(e.target.value) || 300)))}
                  className="h-9 w-32 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">→ square of ~{((radius * 2) / 1000).toFixed(1)} km side</p>
              </div>
              <Button
                onClick={() => handleEnable()}
                disabled={enabling || !hasCoords}
                className="bg-emerald-600 hover:bg-emerald-700 text-sm"
              >
                {enabling ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Radar className="w-4 h-4 mr-1" />}
                {enabling ? 'Enabling…' : 'Quick enable (square)'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMap(true)}
                disabled={!hasCoords || enabling}
                className="text-sm"
              >
                <MapIcon className="w-4 h-4 mr-1" />
                Draw on map
              </Button>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Enabled — show snapshot
  const snap = state.snapshot
  const lastScanLabel = formatTime(state.farm.last_scan_at)
  const alerts = computeAlerts(snap as MonitorSnapshot)

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Field Monitoring
                <span className="text-xs font-normal text-slate-500">
                  · {state.farm.polygon_area_ha?.toFixed(2)} ha
                </span>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 text-xs">
                <Activity className="w-3 h-3" />
                Last scan {lastScanLabel}{state.cached && ' · cached'}
                <span className="text-slate-400 ml-2">· auto-refresh every 10 min</span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="h-8">
                <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Scan now
              </Button>
              <Button size="sm" variant="outline" onClick={handleDisable} disabled={disabling} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-3 h-3 mr-1" />
                Disable
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => {
            const tone = alertToneClasses(a.level)
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${tone.bg} ${tone.border} ${tone.text}`}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{a.title}</span>
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${tone.chip}`}>
                      {a.level}
                    </span>
                    {a.metric && <span className="text-xs opacity-80">· {a.metric}</span>}
                  </div>
                  <div className="text-xs mt-1 opacity-90">{a.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={<Thermometer className="w-4 h-4" />}
          label="Temperature"
          value={snap?.weather ? `${kelvinToC(snap.weather.main.temp)}°C` : '—'}
          detail={snap?.weather?.weather?.[0]?.description}
          tone="amber"
        />
        <MetricCard
          icon={<Droplets className="w-4 h-4" />}
          label="Humidity"
          value={snap?.weather ? `${snap.weather.main.humidity}%` : '—'}
          detail={snap?.weather?.clouds ? `${snap.weather.clouds.all}% cloud` : undefined}
          tone="sky"
        />
        <MetricCard
          icon={<Wind className="w-4 h-4" />}
          label="Wind"
          value={snap?.weather ? `${snap.weather.wind.speed.toFixed(1)} m/s` : '—'}
          detail={snap?.weather ? `${snap.weather.wind.deg}°` : undefined}
          tone="slate"
        />
        <MetricCard
          icon={<Gauge className="w-4 h-4" />}
          label="Pressure"
          value={snap?.weather ? `${Math.round(snap.weather.main.pressure)} hPa` : '—'}
          tone="slate"
        />
        <MetricCard
          icon={<Leaf className="w-4 h-4" />}
          label="Soil moisture"
          value={snap?.soil ? `${(snap.soil.moisture * 100).toFixed(1)}%` : '—'}
          detail={snap?.soil ? `t10 ${kelvinToC(snap.soil.t10)}°C` : undefined}
          tone="emerald"
        />
        <MetricCard
          icon={<Thermometer className="w-4 h-4" />}
          label="Surface temp"
          value={snap?.soil ? `${kelvinToC(snap.soil.t0)}°C` : '—'}
          tone="orange"
        />
        <MetricCard
          icon={<Sun className="w-4 h-4" />}
          label="UV Index"
          value={snap?.uvi ? snap.uvi.uvi.toFixed(1) : '—'}
          detail={snap?.uvi ? uvLabel(snap.uvi.uvi) : undefined}
          tone="yellow"
        />
        <MetricCard
          icon={<CloudRain className="w-4 h-4" />}
          label="30-day rain"
          value={snap?.accumulated_rain ? `${snap.accumulated_rain.rain.toFixed(1)} mm` : '—'}
          detail={snap?.accumulated_gdd ? `${snap.accumulated_gdd.temp.toFixed(0)} GDD` : undefined}
          tone="blue"
        />
      </div>

      {/* NDVI + forecast */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* NDVI */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-600" />
              Vegetation Health (NDVI)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snap?.ndvi ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className={`text-3xl font-bold ${ndviColor(snap.ndvi.stats?.mean)}`}>
                    {snap.ndvi.stats?.mean?.toFixed(2) ?? '—'}
                  </span>
                  <span className="text-sm text-slate-600">{ndviLabel(snap.ndvi.stats?.mean)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {snap.ndvi.image.type} · captured {new Date(snap.ndvi.image.dt * 1000).toLocaleDateString()} · cloud {snap.ndvi.image.cl.toFixed(1)}%
                </div>
                {snap.ndvi.stats && (
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                    <div>min <span className="font-semibold text-slate-700">{snap.ndvi.stats.min?.toFixed(2)}</span></div>
                    <div>max <span className="font-semibold text-slate-700">{snap.ndvi.stats.max?.toFixed(2)}</span></div>
                    <div>std <span className="font-semibold text-slate-700">{snap.ndvi.stats.std?.toFixed(2)}</span></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <SatelliteTile label="NDVI" url={`${snap.ndvi.image.image.ndvi}&paletteid=1`} />
                  <SatelliteTile label="True colour" url={snap.ndvi.image.image.truecolor} />
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">
                No recent cloud-free satellite scene available yet. Sentinel/Landsat typically pass every 3–5 days.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Forecast */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-sky-600" />
              Weather forecast (3h steps)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snap?.forecast?.length ? (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {snap.forecast.slice(0, 12).map((f) => (
                  <div key={f.dt} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-600 w-24">
                      {new Date(f.dt * 1000).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="capitalize text-slate-700 flex-1 truncate px-2">{f.weather?.[0]?.description}</span>
                    <span className="font-semibold text-slate-800 w-14 text-right">{kelvinToC(f.main.temp)}°C</span>
                    <span className="w-14 text-right text-sky-700">
                      {f.rain?.['3h'] ? `${f.rain['3h'].toFixed(1)} mm` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No forecast data.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function uvLabel(uvi: number): string {
  if (uvi < 3) return 'Low'
  if (uvi < 6) return 'Moderate'
  if (uvi < 8) return 'High'
  if (uvi < 11) return 'Very high'
  return 'Extreme'
}

function MetricCard({
  icon, label, value, detail, tone = 'slate',
}: { icon: React.ReactNode; label: string; value: string; detail?: string; tone?: 'amber' | 'sky' | 'slate' | 'emerald' | 'orange' | 'yellow' | 'blue' }) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  }
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      {detail && <div className="text-[11px] text-slate-500 mt-0.5 capitalize">{detail}</div>}
    </div>
  )
}

function SatelliteTile({ label, url }: { label: string; url: string }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      <div className="aspect-square relative">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-2">
            <AlertCircle className="w-6 h-6 mb-1" />
            <span className="text-[10px] text-center">Image unavailable</span>
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={url} 
              alt={label} 
              className="absolute inset-0 w-full h-full object-cover" 
              loading="lazy"
              onLoad={() => setLoading(false)}
              onError={() => {
                setError(true)
                setLoading(false)
              }}
            />
          </>
        )}
      </div>
      <div className="text-[10px] text-slate-500 py-1 px-2 text-center">{label}</div>
    </div>
  )
}
