import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import {
  buildSquarePolygon,
  createPolygon,
  deletePolygon,
  currentWeather,
  forecastWeather,
  soil,
  uvi,
  latestNdviStats,
  accumulatedTemperature,
  accumulatedPrecipitation,
} from '@/lib/agro'
import { computeAlerts, type MonitorSnapshot, type AlertPreferences } from '@/lib/alerts'
import type { SupabaseClient } from '@supabase/supabase-js'

// GET /api/farms/[id]/monitor — returns latest scan snapshot (from cache or live)
//   ?refresh=1 forces a live fetch
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: farm, error } = await supabase
      .from('farms')
      .select('id, name, lat, lng, agro_polygon_id, polygon_geojson, polygon_area_ha, polygon_radius_m, last_scan_at, latest_monitor_snapshot')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (error || !farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })
    if (!farm.agro_polygon_id) {
      return NextResponse.json({ enabled: false, farm }, { status: 200 })
    }

    const refresh = req.nextUrl.searchParams.get('refresh') === '1'
    const cacheFresh = farm.last_scan_at && Date.now() - new Date(farm.last_scan_at).getTime() < 10 * 60 * 1000
    if (!refresh && cacheFresh && farm.latest_monitor_snapshot) {
      return NextResponse.json({ enabled: true, farm, snapshot: farm.latest_monitor_snapshot, cached: true })
    }

    const snapshot = await scanPolygon(farm.agro_polygon_id)
    const now = new Date().toISOString()
    await supabase
      .from('farms')
      .update({ last_scan_at: now, latest_monitor_snapshot: snapshot })
      .eq('id', farm.id)

    // Diff alerts vs previous snapshot & insert notifications for new critical/warning ones
    try {
      const { data: prefRow } = await supabase
        .from('users')
        .select('alert_preferences')
        .eq('id', user.id)
        .maybeSingle()
      await syncAlertNotifications(
        supabase,
        user.id,
        farm.id,
        farm.name,
        farm.latest_monitor_snapshot as MonitorSnapshot,
        snapshot as MonitorSnapshot,
        (prefRow?.alert_preferences as AlertPreferences | null) ?? null,
      )
    } catch (e) {
      console.warn('Notification sync failed (non-fatal):', e)
    }

    return NextResponse.json({ enabled: true, farm: { ...farm, last_scan_at: now }, snapshot, cached: false })
  } catch (err) {
    console.error('[/api/farms/.../monitor GET]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}

// POST — enable monitoring: create Agro polygon around farm lat/lng
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { radius_m?: number; geo_json?: unknown }
    const radius = Math.max(50, Math.min(5000, body.radius_m ?? 300))

    const { data: farm } = await supabase
      .from('farms')
      .select('id, name, lat, lng, agro_polygon_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })

    if (farm.agro_polygon_id) {
      // already enabled — idempotent no-op
      return NextResponse.json({ ok: true, polygon_id: farm.agro_polygon_id, message: 'already enabled' })
    }

    // Use custom GeoJSON if provided, else build a square around farm lat/lng
    let polygon: object
    if (body.geo_json) {
      polygon = validateGeoJsonPolygon(body.geo_json)
    } else {
      if (farm.lat === null || farm.lng === null) {
        return NextResponse.json({ error: 'Farm has no location; set lat/lng first or draw a polygon' }, { status: 400 })
      }
      polygon = buildSquarePolygon(Number(farm.lat), Number(farm.lng), radius)
    }

    const created = await createPolygon(`${farm.name} (${farm.id.slice(0, 8)})`, polygon)

    await supabase
      .from('farms')
      .update({
        agro_polygon_id: created.id,
        polygon_geojson: polygon,
        polygon_area_ha: created.area,
        polygon_radius_m: body.geo_json ? null : radius,
      })
      .eq('id', farm.id)

    return NextResponse.json({ ok: true, polygon_id: created.id, area_ha: created.area, radius_m: body.geo_json ? null : radius })
  } catch (err) {
    console.error('[/api/farms/.../monitor POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}

// DELETE — disable monitoring + remove polygon from Agro
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: farm } = await supabase
      .from('farms')
      .select('id, agro_polygon_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })

    if (farm.agro_polygon_id) {
      try {
        await deletePolygon(farm.agro_polygon_id)
      } catch (err) {
        console.warn('Agro delete failed (continuing):', err)
      }
    }
    await supabase
      .from('farms')
      .update({
        agro_polygon_id: null,
        polygon_geojson: null,
        polygon_area_ha: null,
        last_scan_at: null,
        latest_monitor_snapshot: null,
      })
      .eq('id', farm.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateGeoJsonPolygon(raw: unknown): object {
  // Accept either a Feature<Polygon> or a raw Polygon geometry; normalize to a Feature
  if (!raw || typeof raw !== 'object') throw new Error('Invalid GeoJSON')
  const obj = raw as Record<string, unknown>
  if (obj.type === 'Feature') {
    const g = obj.geometry as Record<string, unknown> | undefined
    if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates)) throw new Error('Feature must have Polygon geometry')
    return obj
  }
  if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
    return { type: 'Feature', properties: {}, geometry: obj }
  }
  throw new Error('Expected a GeoJSON Feature<Polygon> or Polygon')
}

async function scanPolygon(polyId: string) {
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysAgo = now - 30 * 86400

  // Fire all requests in parallel; tolerate individual failures
  const settled = await Promise.allSettled([
    currentWeather(polyId),
    forecastWeather(polyId),
    soil(polyId),
    uvi(polyId),
    latestNdviStats(polyId, 30),
    accumulatedTemperature(polyId, thirtyDaysAgo, now, 10),
    accumulatedPrecipitation(polyId, thirtyDaysAgo, now),
  ])

  const [weatherR, forecastR, soilR, uviR, ndviR, gddR, rainR] = settled
  const okOrNull = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)
  const errOf = <T,>(r: PromiseSettledResult<T>): string | null => (r.status === 'rejected' ? String(r.reason).slice(0, 200) : null)

  return {
    scanned_at: new Date().toISOString(),
    weather: okOrNull(weatherR),
    forecast: okOrNull(forecastR)?.slice(0, 16) ?? null, // next ~2 days at 3h
    soil: okOrNull(soilR),
    uvi: okOrNull(uviR),
    ndvi: okOrNull(ndviR),
    accumulated_gdd: okOrNull(gddR)?.slice(-1)[0] ?? null,
    accumulated_rain: okOrNull(rainR)?.slice(-1)[0] ?? null,
    errors: {
      weather: errOf(weatherR),
      forecast: errOf(forecastR),
      soil: errOf(soilR),
      uvi: errOf(uviR),
      ndvi: errOf(ndviR),
      gdd: errOf(gddR),
      rain: errOf(rainR),
    },
  }
}

// Diff previous vs current alert sets; insert notifications for alerts that are
// newly present (didn't exist in previous snapshot). Critical + warning only.
async function syncAlertNotifications(
  supabase: SupabaseClient,
  userId: string,
  farmId: string,
  farmName: string,
  prev: MonitorSnapshot,
  next: MonitorSnapshot,
  prefs: AlertPreferences | null,
) {
  const prevAlerts = computeAlerts(prev, prefs)
  const nextAlerts = computeAlerts(next, prefs)
  const prevIds = new Set(prevAlerts.map((a) => a.id))
  const newAlerts = nextAlerts.filter(
    (a) => !prevIds.has(a.id) && (a.level === 'critical' || a.level === 'warning'),
  )
  if (newAlerts.length === 0) return

  const rows = newAlerts.map((a) => ({
    user_id: userId,
    type: `alert_${a.level}`,
    title: `${farmName}: ${a.title}`,
    body: a.detail,
    metadata: { farm_id: farmId, alert_id: a.id, level: a.level, metric: a.metric ?? null },
  }))
  await supabase.from('notifications').insert(rows)
}
