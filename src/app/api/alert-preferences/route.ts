import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { DEFAULT_ALERT_PREFS, type AlertPreferences } from '@/lib/alerts'

export async function GET() {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('users')
    .select('alert_preferences')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    preferences: (data?.alert_preferences as AlertPreferences | null) ?? null,
    defaults: DEFAULT_ALERT_PREFS,
  })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { preferences?: AlertPreferences | null } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  // Upsert user row in public.users with alert_preferences
  const { error } = await supabase
    .from('users')
    .upsert({ id: user.id, alert_preferences: body.preferences ?? null }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
