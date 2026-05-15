import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET() {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('farms')
      .select('*, crop_cycles(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, total_area_acres, lat, lng, soil_type, water_source } = body

    if (!name) return NextResponse.json({ error: 'Farm name is required' }, { status: 400 })

    const toNullIfBlank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)
    const toNumOrNull = (v: unknown) => {
      if (v === '' || v === null || v === undefined) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    const { data, error } = await supabase
      .from('farms')
      .insert({
        user_id: user.id,
        name: name.trim(),
        total_area_acres: toNumOrNull(total_area_acres),
        lat: toNumOrNull(lat),
        lng: toNumOrNull(lng),
        soil_type: toNullIfBlank(soil_type),
        water_source: toNullIfBlank(water_source),
      })
      .select('*')
      .single()

    if (error) {
      console.error('[/api/farms POST] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
