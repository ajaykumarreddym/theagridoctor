import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET() {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, phone, state, district, preferred_language, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    profile: data ?? { id: user.id, full_name: null, phone: null, state: null, district: null, preferred_language: null },
    email: user.email,
  })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { full_name, phone, state, district, preferred_language } = body ?? {}

    const update: Record<string, string | null> = {}
    if (full_name !== undefined) update.full_name = full_name ? String(full_name).slice(0, 120) : null
    if (phone !== undefined) update.phone = phone ? String(phone).slice(0, 20) : null
    if (state !== undefined) update.state = state ? String(state).slice(0, 100) : null
    if (district !== undefined) update.district = district ? String(district).slice(0, 100) : null
    if (preferred_language !== undefined) update.preferred_language = preferred_language ? String(preferred_language).slice(0, 30) : null

    // Upsert in case trigger hasn't run or row missing
    const { data, error } = await supabase
      .from('users')
      .upsert({ id: user.id, ...update }, { onConflict: 'id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profile: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
