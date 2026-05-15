import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/notifications
//   ?limit=20 &offset=0 &unread_only=1 &level=critical|warning|info &farm_id=<uuid>
export async function GET(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const limit = Math.min(100, Number(sp.get('limit') ?? 20))
  const offset = Math.max(0, Number(sp.get('offset') ?? 0))
  const unreadOnly = sp.get('unread_only') === '1'
  const level = sp.get('level')
  const farmId = sp.get('farm_id')

  let q = supabase
    .from('notifications')
    .select('id, type, title, message, metadata, read_at, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (unreadOnly) q = q.is('read_at', null)
  if (level === 'critical') q = q.eq('type', 'alert_critical')
  else if (level === 'warning') q = q.eq('type', 'alert_warning')
  else if (level === 'info') q = q.eq('type', 'info')
  if (farmId) q = q.contains('metadata', { farm_id: farmId })

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  return NextResponse.json({
    notifications: data ?? [],
    total: count ?? 0,
    unread: unread ?? 0,
  })
}

// POST — actions
//   { action: 'mark_all_read' }
//   { action: 'mark_read' | 'mark_unread' | 'delete', ids: string[] }
//   { action: 'delete_all_read' }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { action?: string; ids?: string[] }
  const now = new Date().toISOString()

  switch (body.action) {
    case 'mark_all_read': {
      const { error } = await supabase.from('notifications')
        .update({ read_at: now }).eq('user_id', user.id).is('read_at', null)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'mark_read': {
      if (!Array.isArray(body.ids) || body.ids.length === 0)
        return NextResponse.json({ error: 'ids required' }, { status: 400 })
      const { error } = await supabase.from('notifications')
        .update({ read_at: now }).eq('user_id', user.id).in('id', body.ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'mark_unread': {
      if (!Array.isArray(body.ids) || body.ids.length === 0)
        return NextResponse.json({ error: 'ids required' }, { status: 400 })
      const { error } = await supabase.from('notifications')
        .update({ read_at: null }).eq('user_id', user.id).in('id', body.ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'delete': {
      if (!Array.isArray(body.ids) || body.ids.length === 0)
        return NextResponse.json({ error: 'ids required' }, { status: 400 })
      const { error } = await supabase.from('notifications')
        .delete().eq('user_id', user.id).in('id', body.ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'delete_all_read': {
      const { error } = await supabase.from('notifications')
        .delete().eq('user_id', user.id).not('read_at', 'is', null)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
