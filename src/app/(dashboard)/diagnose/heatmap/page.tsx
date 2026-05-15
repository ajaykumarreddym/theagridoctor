'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, MapPin, Loader2, AlertCircle, Activity, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HeatmapMap } from '@/components/diagnose/heatmap-map'

type Point = {
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

const DAY_OPTS = [
  { key: 7, label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
  { key: 365, label: '1y' },
]

const POPULAR_CROPS = ['Rice', 'Wheat', 'Tomato', 'Cotton', 'Onion', 'Potato', 'Maize']

const SEV_TINT: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
  unknown: 'bg-slate-400',
}

export default function DiagnoseHeatmapPage() {
  const [scope, setScope] = useState<'all' | 'me'>('all')
  const [days, setDays] = useState(90)
  const [crop, setCrop] = useState('')
  const [cropInput, setCropInput] = useState('')
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Time-scrub slider: daysAgo window [min, max] over the fetched range
  const [windowDays, setWindowDays] = useState<[number, number]>([0, 90])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      p.set('days', String(days))
      p.set('scope', scope)
      if (crop) p.set('crop', crop)
      const r = await fetch(`/api/diagnose/heatmap?${p.toString()}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
      const j = await r.json()
      setPoints(j.points ?? [])
      setWindowDays([0, days])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load')
    } finally {
      setLoading(false)
    }
  }, [days, scope, crop])

  useEffect(() => { load() }, [load])

  // Apply time-window client-side filter
  const visiblePoints = useMemo(() => {
    const now = Date.now()
    const minTs = now - windowDays[1] * 86400000
    const maxTs = now - windowDays[0] * 86400000
    return points.filter((p) => {
      const t = new Date(p.created_at).getTime()
      return t >= minTs && t <= maxTs
    })
  }, [points, windowDays])

  const bySev = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of visiblePoints) m[p.severity] = (m[p.severity] ?? 0) + 1
    return m
  }, [visiblePoints])

  const byDisease = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of visiblePoints) {
      const k = p.disease_name ?? 'Unknown'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [visiblePoints])

  return (
    <div className="space-y-5">
      <Link href="/diagnose/history" className="inline-flex items-center text-sm text-slate-600 hover:text-emerald-700">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to diagnosis history
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-emerald-600" />
          Disease & Pest Heatmap
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Location of reported crop issues across the community. Helps you anticipate nearby outbreaks.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wide">Scope</span>
            {(['all', 'me'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`text-[11px] px-2.5 py-1 rounded-md border ${
                  scope === s
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s === 'all' ? 'Community' : 'My reports'}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Range</span>
            {DAY_OPTS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDays(d.key)}
                className={`text-[11px] px-2.5 py-1 rounded-md border ${
                  days === d.key
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Crop</span>
            <input
              type="text"
              placeholder="e.g. Rice"
              value={cropInput}
              onChange={(e) => setCropInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setCrop(cropInput.trim())}
              className="flex-1 h-8 px-2 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setCrop(cropInput.trim())}
            >
              Apply
            </Button>
            {crop && (
              <button
                className="text-[11px] text-slate-500 hover:text-rose-600"
                onClick={() => { setCrop(''); setCropInput('') }}
              >
                Clear
              </button>
            )}
          </div>
        </CardContent>
        <CardContent className="px-4 pb-4 pt-0 flex flex-wrap gap-1.5">
          {POPULAR_CROPS.map((c) => (
            <button
              key={c}
              onClick={() => { setCropInput(c); setCrop(c) }}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                crop === c
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            {loading ? 'Loading…' : `${visiblePoints.length} of ${points.length} report${points.length === 1 ? '' : 's'} shown`}
          </CardTitle>
          <CardDescription>Circle size & colour = severity · thick border = your reports · clusters auto-group at lower zoom</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Time scrubber */}
          {points.length > 0 && !loading && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                <span className="uppercase tracking-wide font-medium">Time window</span>
                <span className="font-mono">
                  {windowDays[1]}d ago → {windowDays[0] === 0 ? 'today' : `${windowDays[0]}d ago`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={days}
                  value={windowDays[0]}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), windowDays[1] - 1)
                    setWindowDays([Math.max(0, v), windowDays[1]])
                  }}
                  className="flex-1 accent-emerald-600"
                />
                <input
                  type="range"
                  min={0}
                  max={days}
                  value={windowDays[1]}
                  onChange={(e) => {
                    const v = Math.max(Number(e.target.value), windowDays[0] + 1)
                    setWindowDays([windowDays[0], Math.min(days, v)])
                  }}
                  className="flex-1 accent-emerald-600"
                />
                <button
                  onClick={() => setWindowDays([0, days])}
                  className="text-[10px] text-slate-500 hover:text-emerald-700 px-2 py-0.5 border border-slate-200 rounded"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {error ? (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
            </div>
          ) : loading ? (
            <div className="h-[520px] bg-slate-100 rounded-lg flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : visiblePoints.length === 0 ? (
            <div className="h-[520px] bg-slate-50 rounded-lg flex flex-col items-center justify-center text-slate-400 text-sm">
              <MapPin className="w-10 h-10 mb-2 text-slate-200" />
              {points.length === 0
                ? 'No reports match these filters. Try widening the time range or changing crop.'
                : 'No reports in the selected time window. Slide the handles to widen.'}
            </div>
          ) : (
            <HeatmapMap points={visiblePoints} height={520} />
          )}

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 flex-wrap text-[11px] text-slate-500">
            <span className="uppercase tracking-wide">Severity:</span>
            {(['critical', 'high', 'medium', 'low', 'unknown'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1 capitalize">
                <span className={`w-3 h-3 rounded-full ${SEV_TINT[s]}`} />
                {s} {bySev[s] ? `(${bySev[s]})` : ''}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top diseases */}
      {byDisease.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top reported issues</CardTitle>
            <CardDescription>Most frequent in the current view</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {byDisease.map(([name, count]) => (
                <li key={name} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{name}</span>
                  <span className="text-xs text-slate-500">{count} report{count === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Location is approximated from the reporter&apos;s primary farm and slightly jittered for privacy.
        Reports without a registered farm location are not shown on the map.
      </p>
    </div>
  )
}
