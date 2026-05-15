'use client'

import { useEffect, useState } from 'react'
import { Cloud, Droplets, Wind, Sun, Search, Loader2, AlertCircle, MapPin, Gauge, Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

type WeatherResponse = {
  location: string
  current: {
    temp: number
    feels_like: number
    humidity: number
    pressure: number
    wind_speed: number
    wind_deg: number
    clouds: number
    weather: { main: string; description: string; icon: string }
    sunrise: number
    sunset: number
  }
  forecast: {
    dt: number
    date: string
    temp: number
    humidity: number
    weather: { main: string; description: string; icon: string }
    pop: number
  }[]
}

const DEFAULT_LOCATION = 'Hyderabad,IN'

export default function WeatherPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<WeatherResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  const load = async (params: string) => {
    setLoading(true)
    setError(null)
    setNotConfigured(false)
    try {
      const res = await fetch(`/api/weather?${params}`)
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'not_configured') {
          setNotConfigured(true)
          return
        }
        throw new Error(json.message || json.error || 'Failed to load weather')
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load(`lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
        () => load(`q=${encodeURIComponent(DEFAULT_LOCATION)}`),
        { timeout: 5000 }
      )
    } else {
      load(`q=${encodeURIComponent(DEFAULT_LOCATION)}`)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    load(`q=${encodeURIComponent(query.trim())}`)
  }

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
                <CardTitle className="text-base">Weather API not configured</CardTitle>
                <CardDescription>Add your OpenWeatherMap key to enable this page</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>To enable weather data, add this line to your <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-xs">.env</code> file and restart the dev server:</p>
            <pre className="bg-amber-100/70 text-amber-900 p-3 rounded-lg text-xs font-mono overflow-x-auto">OPENWEATHER_API_KEY=your_openweathermap_api_key</pre>
            <p className="text-xs">Get a free key at <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer" className="underline">openweathermap.org</a>.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Weather</h1>
          <p className="text-slate-500 mt-1">Live conditions and 5-day forecast for your farm.</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search city (e.g. Pune, IN)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            Search
          </Button>
        </form>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading weather data…</p>
        </div>
      ) : data ? (
        <>
          {/* Current conditions */}
          <Card className="bg-gradient-to-br from-sky-500 to-emerald-600 text-white border-0 shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center text-sm opacity-90 mb-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    {data.location}
                  </div>
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="text-6xl font-bold">{Math.round(data.current.temp)}°</span>
                    <span className="text-lg opacity-90 capitalize">{data.current.weather?.description}</span>
                  </div>
                  <p className="text-sm opacity-80 mt-2">
                    Feels like {Math.round(data.current.feels_like)}°C
                  </p>
                </div>
                {data.current.weather?.icon && (
                  <Image
                    src={`https://openweathermap.org/img/wn/${data.current.weather.icon}@4x.png`}
                    alt={data.current.weather.description || 'Weather icon'}
                    width={120}
                    height={120}
                    unoptimized
                  />
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/20">
                <MetricMini icon={Droplets} label="Humidity" value={`${data.current.humidity}%`} />
                <MetricMini icon={Wind} label="Wind" value={`${data.current.wind_speed?.toFixed(1)} m/s`} />
                <MetricMini icon={Gauge} label="Pressure" value={`${data.current.pressure} hPa`} />
                <MetricMini icon={Eye} label="Clouds" value={`${data.current.clouds}%`} />
              </div>
            </CardContent>
          </Card>

          {/* Forecast */}
          {data.forecast.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">5-Day Forecast</CardTitle>
                <CardDescription>Daytime conditions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {data.forecast.map((f) => (
                    <div
                      key={f.dt}
                      className="flex flex-col items-center p-4 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors"
                    >
                      <p className="text-xs font-semibold text-slate-600 uppercase">
                        {new Date(f.dt * 1000).toLocaleDateString('en-IN', { weekday: 'short' })}
                      </p>
                      {f.weather?.icon && (
                        <Image
                          src={`https://openweathermap.org/img/wn/${f.weather.icon}@2x.png`}
                          alt={f.weather.description || ''}
                          width={64}
                          height={64}
                          unoptimized
                        />
                      )}
                      <p className="text-2xl font-bold text-slate-800">{Math.round(f.temp)}°</p>
                      <p className="text-[11px] text-slate-500 capitalize truncate max-w-full">
                        {f.weather?.description}
                      </p>
                      <div className="flex items-center text-[11px] text-blue-600 mt-1">
                        <Droplets className="w-3 h-3 mr-0.5" />
                        {(f.pop * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Farming tips */}
          <Card className="bg-emerald-50/50 border-emerald-100">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Sun className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-900 mb-1">Farming insight</p>
                  <p className="text-sm text-emerald-800">{getFarmingTip(data)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function MetricMini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 opacity-80" />
      <div>
        <p className="text-xs opacity-80">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

function getFarmingTip(data: WeatherResponse): string {
  const { temp, humidity } = data.current
  const highRain = data.forecast.some((f) => f.pop > 0.5)
  if (highRain) {
    return 'High chance of rainfall in the coming days — delay any fertilizer spray and check field drainage.'
  }
  if (temp > 35) {
    return 'Heat stress risk. Irrigate during early morning or evening and consider mulching to retain soil moisture.'
  }
  if (humidity > 80) {
    return 'High humidity increases fungal disease risk (e.g. blight, mildew). Monitor leaves closely.'
  }
  if (temp < 15) {
    return 'Cool temperatures — slow germination. Protect sensitive seedlings and cover transplants at night.'
  }
  return 'Conditions look favourable for routine field operations. Continue scheduled irrigation and scouting.'
}
