'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus, BarChart3, MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type MarketRecord = {
  state?: string
  district?: string
  market?: string
  commodity?: string
  variety?: string
  arrival_date?: string
  min_price?: string
  max_price?: string
  modal_price?: string
}

type MarketResponse = {
  total: number
  count: number
  records: MarketRecord[]
  updated: string | null
}

const POPULAR_COMMODITIES = ['Rice', 'Wheat', 'Tomato', 'Onion', 'Potato', 'Cotton', 'Maize', 'Soybean']
const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Gujarat', 'Punjab', 'Haryana', 'Uttar Pradesh', 'West Bengal']

export default function MarketPage() {
  const [commodity, setCommodity] = useState('Tomato')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MarketResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotConfigured(false)
    try {
      const params = new URLSearchParams()
      if (commodity) params.set('commodity', commodity)
      if (state) params.set('state', state)
      params.set('limit', '100')
      const res = await fetch(`/api/market?${params}`)
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'not_configured') {
          setNotConfigured(true)
          return
        }
        throw new Error(json.message || json.error || 'Failed to load market prices')
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [commodity, state])

  useEffect(() => {
    load()
  }, [load])

  const parseNum = (n?: string) => {
    if (!n) return null
    const v = parseFloat(n)
    return Number.isFinite(v) ? v : null
  }

  const stats = (() => {
    if (!data?.records?.length) return null
    const modals = data.records.map((r) => parseNum(r.modal_price)).filter((v): v is number => v !== null)
    if (!modals.length) return null
    const avg = modals.reduce((a, b) => a + b, 0) / modals.length
    const min = Math.min(...modals)
    const max = Math.max(...modals)
    return { avg, min, max, samples: modals.length }
  })()

  if (notConfigured) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Market Prices API not configured</CardTitle>
                <CardDescription>Add your data.gov.in API key to enable this page</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>To enable mandi price data, add this line to your <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-xs">.env</code> file and restart the dev server:</p>
            <pre className="bg-amber-100/70 text-amber-900 p-3 rounded-lg text-xs font-mono overflow-x-auto">DATAGOV_API_KEY=your_data_gov_in_api_key</pre>
            <p className="text-xs">
              Register for a free key at <a href="https://data.gov.in" target="_blank" rel="noreferrer" className="underline">data.gov.in</a>{' '}
              and use the Mandi Price dataset (resource <code className="font-mono">9ef84268-d588-465a-a308-a864a43d0070</code>).
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Market Prices</h1>
        <p className="text-slate-500 mt-1">Live mandi prices across India, sourced from data.gov.in.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Commodity (e.g. Tomato)"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">All States</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button onClick={load} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Fetch Prices
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_COMMODITIES.map((c) => (
              <button
                key={c}
                onClick={() => setCommodity(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  commodity.toLowerCase() === c.toLowerCase()
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Markets" value={stats.samples.toString()} icon={MapPin} tint="emerald" />
          <SummaryCard label="Avg Modal" value={`₹${stats.avg.toFixed(0)}`} icon={BarChart3} tint="blue" />
          <SummaryCard label="Min" value={`₹${stats.min.toFixed(0)}`} icon={TrendingDown} tint="red" />
          <SummaryCard label="Max" value={`₹${stats.max.toFixed(0)}`} icon={TrendingUp} tint="green" />
        </div>
      )}

      {/* Price distribution + best/worst markets */}
      {stats && data?.records?.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" /> Price distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Modal price across all {stats.samples} markets (₹{stats.min.toFixed(0)} — ₹{stats.max.toFixed(0)})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PriceHistogram
                values={data.records.map((r) => parseNum(r.modal_price)).filter((v): v is number => v !== null)}
                min={stats.min}
                max={stats.max}
                avg={stats.avg}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Best markets to sell
              </CardTitle>
              <CardDescription className="text-xs">Top 5 modal prices</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {[...data.records]
                  .map((r) => ({ r, v: parseNum(r.modal_price) }))
                  .filter((x): x is { r: MarketRecord; v: number } => x.v !== null)
                  .sort((a, b) => b.v - a.v)
                  .slice(0, 5)
                  .map(({ r, v }, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{r.market}</p>
                        <p className="text-[11px] text-slate-400 truncate">{r.district}, {r.state}</p>
                      </div>
                      <span className="font-mono text-emerald-700 font-semibold whitespace-nowrap ml-2">
                        ₹{v.toLocaleString('en-IN')}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Records table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Fetching market data…</p>
        </div>
      ) : data?.records?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{data.records.length} records</CardTitle>
            <CardDescription>
              {commodity ? `Showing ${commodity}` : 'All commodities'}
              {state && ` · ${state}`}
              {data.updated && ` · Updated ${data.updated}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Variety</th>
                  <th className="py-3 px-4 text-right">Min (₹)</th>
                  <th className="py-3 px-4 text-right">Max (₹)</th>
                  <th className="py-3 px-4 text-right">Modal (₹)</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((r, i) => {
                  const modal = parseNum(r.modal_price)
                  const min = parseNum(r.min_price)
                  const max = parseNum(r.max_price)
                  const spread = min !== null && max !== null ? max - min : 0
                  const trendIcon = spread > 500 ? TrendingUp : spread < 100 ? Minus : TrendingDown
                  const Trend = trendIcon
                  return (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{r.market}</div>
                        <div className="text-xs text-slate-400">{r.district}, {r.state}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{r.commodity}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{r.variety}</td>
                      <td className="py-3 px-4 text-right font-mono">{min !== null ? min.toLocaleString('en-IN') : '—'}</td>
                      <td className="py-3 px-4 text-right font-mono">{max !== null ? max.toLocaleString('en-IN') : '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 font-bold text-emerald-700">
                          <Trend className="w-3 h-3" />
                          {modal !== null ? `₹${modal.toLocaleString('en-IN')}` : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{r.arrival_date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm">No records for this commodity / state.</p>
        </div>
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, tint }: { label: string; value: string; icon: React.ElementType; tint: string }) {
  const tintMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
  }
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tintMap[tint]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PriceHistogram({ values, min, max, avg }: { values: number[]; min: number; max: number; avg: number }) {
  if (values.length === 0 || max <= min) {
    return <p className="text-xs text-slate-400 py-8 text-center">Not enough data to chart.</p>
  }
  const BIN_COUNT = 10
  const binSize = (max - min) / BIN_COUNT || 1
  const bins = new Array(BIN_COUNT).fill(0) as number[]
  for (const v of values) {
    const idx = Math.min(BIN_COUNT - 1, Math.floor((v - min) / binSize))
    bins[idx]++
  }
  const peak = Math.max(...bins, 1)
  const W = 560
  const H = 130
  const padL = 32
  const padR = 8
  const padT = 8
  const padB = 22
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = chartW / BIN_COUNT
  const avgX = padL + ((avg - min) / (max - min)) * chartW

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" className="min-w-[360px]">
        {/* y-axis grid */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padL}
            x2={W - padR}
            y1={padT + chartH * (1 - t)}
            y2={padT + chartH * (1 - t)}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}
        {/* bars */}
        {bins.map((count, i) => {
          const h = (count / peak) * chartH
          const x = padL + i * barW
          const y = padT + chartH - h
          return (
            <g key={i}>
              <rect
                x={x + 1}
                y={y}
                width={Math.max(0, barW - 2)}
                height={h}
                fill="#10b981"
                opacity={0.85}
                rx={2}
              />
              {count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 2}
                  fontSize={9}
                  textAnchor="middle"
                  fill="#475569"
                >
                  {count}
                </text>
              )}
            </g>
          )
        })}
        {/* avg line */}
        <line
          x1={avgX}
          x2={avgX}
          y1={padT}
          y2={padT + chartH}
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <text x={avgX + 4} y={padT + 10} fontSize={10} fill="#b45309" fontWeight={600}>
          avg ₹{avg.toFixed(0)}
        </text>
        {/* x-axis labels */}
        <text x={padL} y={H - 6} fontSize={10} fill="#94a3b8">
          ₹{Math.round(min).toLocaleString('en-IN')}
        </text>
        <text x={W - padR} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="end">
          ₹{Math.round(max).toLocaleString('en-IN')}
        </text>
        <text x={padL + chartW / 2} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
          modal price bins
        </text>
      </svg>
    </div>
  )
}
