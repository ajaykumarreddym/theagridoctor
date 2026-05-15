import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/crops/[id]/tasks — list tasks for a crop cycle
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // verify crop belongs to user (via farm)
  const { data: crop } = await supabase
    .from('crop_cycles')
    .select('id, farm_id, farms!inner(user_id)')
    .eq('id', params.id)
    .single()
  // @ts-expect-error supabase join typing
  if (!crop || crop.farms?.user_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('crop_tasks')
    .select('id, task_name, description, category, due_date, status, priority, ai_generated, created_at, completed_at')
    .eq('crop_cycle_id', params.id)
    .order('status', { ascending: true }) // pending before done
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Map task_name to title for frontend compatibility
  const tasks = data?.map((t: any) => ({ ...t, title: t.task_name })) ?? []
  return NextResponse.json({ tasks })
}

// POST /api/crops/[id]/tasks — create a manual task
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: crop } = await supabase
    .from('crop_cycles')
    .select('id, farms!inner(user_id)')
    .eq('id', params.id)
    .single()
  // @ts-expect-error supabase join typing
  if (!crop || crop.farms?.user_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as {
    title?: string; description?: string; category?: string; due_date?: string; priority?: string
  }
  if (!body.title || !body.title.trim())
    return NextResponse.json({ error: 'title required' }, { status: 400 })

  const toNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

  const { data, error } = await supabase
    .from('crop_tasks')
    .insert({
      crop_cycle_id: params.id,
      task_name: body.title.trim().slice(0, 120),
      description: toNull(body.description),
      category: toNull(body.category),
      due_date: toNull(body.due_date),
      priority: toNull(body.priority) ?? 'medium',
      ai_generated: false,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Map task_name to title for frontend compatibility
  const task = data ? { ...data, title: (data as any).task_name } : null
  return NextResponse.json({ task }, { status: 201 })
}
