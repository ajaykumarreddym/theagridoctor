// OpenWeatherMap Agro API client — https://agromonitoring.com/api
// All endpoints authenticated with ?appid=AGRO_API_KEY

const AGRO_BASE = 'http://api.agromonitoring.com/agro/1.0'

function requireKey(): string {
  const key = process.env.AGRO_API_KEY
  if (!key) throw new Error('AGRO_API_KEY not configured')
  return key
}

function url(path: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({ appid: requireKey(), ...(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) as Record<string, string>) })
  return `${AGRO_BASE}${path}?${qs.toString()}`
}

// Build a square polygon (GeoJSON) of approx `radiusMeters` around a lat/lng.
// Agro requires a closed polygon (first == last point) with at least ~0.01 km² area.
export function buildSquarePolygon(lat: number, lng: number, radiusMeters = 300) {
  // Rough degree conversion: 1° lat ≈ 111_320 m; 1° lng ≈ 111_320 * cos(lat)
  const dLat = radiusMeters / 111_320
  const dLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180))
  const coords = [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat], // close
  ]
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

// ─── Polygon management ──────────────────────────────────────────────────────
export async function createPolygon(name: string, geoJson: object, duplicated = true) {
  const res = await fetch(url('/polygons', { duplicated: String(duplicated) }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, geo_json: geoJson }),
  })
  if (!res.ok) throw new Error(`Agro createPolygon failed ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json() as Promise<{ id: string; area: number; center: [number, number]; geo_json: object }>
}

export async function deletePolygon(polyId: string): Promise<void> {
  const res = await fetch(url(`/polygons/${polyId}`), { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`Agro deletePolygon failed ${res.status}`)
}

// ─── Weather / soil / UV / NDVI ──────────────────────────────────────────────
export type AgroWeather = {
  dt: number
  weather: { main: string; description: string; icon: string }[]
  main: { temp: number; humidity: number; pressure: number; temp_min: number; temp_max: number }
  wind: { speed: number; deg: number }
  clouds: { all: number }
  rain?: { '1h'?: number; '3h'?: number }
}

export async function currentWeather(polyId: string): Promise<AgroWeather> {
  const res = await fetch(url('/weather', { polyid: polyId }))
  if (!res.ok) throw new Error(`Agro weather ${res.status}`)
  return res.json()
}

export async function forecastWeather(polyId: string): Promise<AgroWeather[]> {
  const res = await fetch(url('/weather/forecast', { polyid: polyId }))
  if (!res.ok) throw new Error(`Agro forecast ${res.status}`)
  return res.json()
}

export type AgroSoil = { dt: number; t10: number; moisture: number; t0: number }
export async function soil(polyId: string): Promise<AgroSoil> {
  const res = await fetch(url('/soil', { polyid: polyId }))
  if (!res.ok) throw new Error(`Agro soil ${res.status}`)
  return res.json()
}

export type AgroUvi = { dt: number; uvi: number }
export async function uvi(polyId: string): Promise<AgroUvi> {
  const res = await fetch(url('/uvi', { polyid: polyId }))
  if (!res.ok) throw new Error(`Agro uvi ${res.status}`)
  return res.json()
}

// Satellite: list images in date range. Returns image URLs + stats URL.
export type SatImage = {
  dt: number
  type: string // 'Landsat 8' | 'Sentinel-2' ...
  cl: number // cloud %
  image: { truecolor: string; falsecolor: string; ndvi: string; evi: string }
  stats?: { ndvi?: string; evi?: string }
  data?: { ndvi?: string; evi?: string }
  sun?: { azimuth: number; elevation: number }
}
export async function satelliteImages(polyId: string, start: number, end: number): Promise<SatImage[]> {
  const res = await fetch(url('/image/search', { polyid: polyId, start, end }))
  if (!res.ok) throw new Error(`Agro satellite ${res.status}`)
  return res.json()
}

// NDVI stats for latest clear scene
export async function latestNdviStats(polyId: string, days = 30): Promise<{ image: SatImage; stats: { min?: number; max?: number; mean?: number; median?: number; std?: number; num?: number } | null } | null> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - days * 86400
  const images = await satelliteImages(polyId, start, end)
  if (!images.length) return null
  // prefer lowest cloud coverage
  const sorted = [...images].sort((a, b) => (a.cl ?? 100) - (b.cl ?? 100))
  const best = sorted[0]
  // Rewrite image URLs to include appid so the browser can fetch them directly
  const key = requireKey()
  const withKey = (u?: string) => (u ? `${u}${u.includes('?') ? '&' : '?'}appid=${key}` : u)
  const decoratedImage: SatImage = {
    ...best,
    image: {
      truecolor: withKey(best.image.truecolor) ?? '',
      falsecolor: withKey(best.image.falsecolor) ?? '',
      ndvi: withKey(best.image.ndvi) ?? '',
      evi: withKey(best.image.evi) ?? '',
    },
  }
  const statsUrl = best.stats?.ndvi
  if (!statsUrl) return { image: decoratedImage, stats: null }
  try {
    const statsRes = await fetch(`${statsUrl}${statsUrl.includes('?') ? '&' : '?'}appid=${key}`)
    if (!statsRes.ok) return { image: decoratedImage, stats: null }
    return { image: decoratedImage, stats: await statsRes.json() }
  } catch {
    return { image: decoratedImage, stats: null }
  }
}

// Accumulated parameters (GDD and rainfall)
export async function accumulatedTemperature(polyId: string, start: number, end: number, threshold = 10) {
  const res = await fetch(url('/weather/history/accumulated_temperature', { polyid: polyId, start, end, threshold }))
  if (!res.ok) throw new Error(`Agro GDD ${res.status}`)
  return res.json() as Promise<{ dt: number; temp: number; count: number }[]>
}

export async function accumulatedPrecipitation(polyId: string, start: number, end: number) {
  const res = await fetch(url('/weather/history/accumulated_precipitation', { polyid: polyId, start, end }))
  if (!res.ok) throw new Error(`Agro rainfall ${res.status}`)
  return res.json() as Promise<{ dt: number; rain: number; count: number }[]>
}
