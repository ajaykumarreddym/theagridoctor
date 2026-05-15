import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/diagnose/heatmap
//   ?days=90 &crop=Rice &scope=me|all
// Returns a list of diagnosis points keyed to farm lat/lng:
//   { points: [{ id, lat, lng, crop_type, disease_name, severity, status, created_at, is_mine }], count }
//
// Geolocation strategy: diagnoses are not geotagged directly.  We approximate each
// diagnosis' location by the primary farm of the reporting user (first farm with
// lat/lng found).  This is sufficient for district-level heatmapping.

type FarmLite = { id: string; user_id: string; lat: number; lng: number }

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const days = Math.max(1, Math.min(730, Number(sp.get('days') ?? 90)))
  const crop = sp.get('crop')?.trim()
  const scope = sp.get('scope') === 'me' ? 'me' : 'all'

  const since = new Date(Date.now() - days * 86400000).toISOString()

  // 1) fetch diagnoses
  let dq = supabase
    .from('diagnoses')
    .select('id, user_id, crop_type, disease_name, severity, status, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (scope === 'me') dq = dq.eq('user_id', user.id)
  if (crop) dq = dq.ilike('crop_type', `%${crop}%`)

  const { data: diagnoses, error: dErr } = await dq
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  if (!diagnoses || diagnoses.length === 0)
    return NextResponse.json({ points: [], count: 0 })

  // 2) fetch farms with coords for those users
  const userIds = Array.from(new Set(diagnoses.map((d) => d.user_id)))
  const { data: farms, error: fErr } = await supabase
    .from('farms')
    .select('id, user_id, lat, lng')
    .in('user_id', userIds)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  // Pick first farm per user
  const farmByUser = new Map<string, FarmLite>()
  for (const f of (farms ?? []) as FarmLite[]) {
    if (!farmByUser.has(f.user_id)) farmByUser.set(f.user_id, f)
  }

  // 3) deterministic small jitter (so co-located users don't fully overlap) based on diagnosis id
  const jitter = (seed: string) => {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
    const r1 = ((h & 0xffff) / 0xffff) - 0.5
    const r2 = (((h >>> 16) & 0xffff) / 0xffff) - 0.5
    // ~500m jitter
    return { dLat: r1 * 0.005, dLng: r2 * 0.005 }
  }

  const points = diagnoses
    .map((d) => {
      const f = farmByUser.get(d.user_id)
      if (!f) return null
      const { dLat, dLng } = jitter(d.id)
      return {
        id: d.id,
        lat: Number(f.lat) + dLat,
        lng: Number(f.lng) + dLng,
        crop_type: d.crop_type,
        disease_name: d.disease_name,
        severity: d.severity ?? 'unknown',
        status: d.status,
        created_at: d.created_at,
        is_mine: d.user_id === user.id,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json({ points, count: points.length })
}
