import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// PATCH /api/tasks/[id] — update status / fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ownership check via join
  const { data: task } = await supabase
    .from('crop_tasks')
    .select('id, crop_cycle_id, crop_cycles!inner(farm_id, farms!inner(user_id))')
    .eq('id', params.id)
    .single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // @ts-expect-error supabase join typing
  if (task.crop_cycles?.farms?.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    status?: 'pending' | 'done' | 'skipped'
    title?: string; description?: string; due_date?: string; priority?: string; category?: string
  }

  const update: Record<string, string | null> = {}
  if (body.status && ['pending', 'done', 'skipped'].includes(body.status)) {
    update.status = body.status
    update.completed_at = body.status === 'pending' ? null : new Date().toISOString()
  }
  if (body.title !== undefined) update.task_name = body.title.trim().slice(0, 120)
  if (body.description !== undefined) update.description = body.description || null
  if (body.due_date !== undefined) update.due_date = body.due_date || null
  if (body.priority !== undefined) update.priority = body.priority || null
  if (body.category !== undefined) update.category = body.category || null

  const { data, error } = await supabase
    .from('crop_tasks')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Map task_name to title for frontend compatibility
  const taskWithTitle = data ? { ...data, title: (data as any).task_name } : null
  return NextResponse.json({ task: taskWithTitle })
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: task } = await supabase
    .from('crop_tasks')
    .select('id, crop_cycles!inner(farms!inner(user_id))')
    .eq('id', params.id)
    .single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // @ts-expect-error
  if (task.crop_cycles?.farms?.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('crop_tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
