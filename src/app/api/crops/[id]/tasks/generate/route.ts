import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { generateTasks, dueDateFromOffset } from '@/lib/crop-tasks'

// POST /api/crops/[id]/tasks/generate — use AI to generate tasks and insert them
// Body (optional): { replace_pending?: boolean }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { replace_pending?: boolean }

    // Load crop cycle + farm + owner profile (for context)
    const { data: crop, error: cropErr } = await supabase
      .from('crop_cycles')
      .select('id, crop_name, variety, growth_stage, sown_date, expected_harvest_date, farm_id, farms!inner(user_id, soil_type, water_source, name)')
      .eq('id', params.id)
      .single()
    if (cropErr || !crop) return NextResponse.json({ error: 'Crop not found' }, { status: 404 })
    // @ts-expect-error join typing
    if (crop.farms.user_id !== user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: profile } = await supabase
      .from('users')
      .select('state, district, preferred_language')
      .eq('id', user.id)
      .maybeSingle()

    // @ts-expect-error join typing
    const farm = crop.farms as { soil_type: string | null; water_source: string | null; name: string }
    const location = [profile?.district, profile?.state].filter(Boolean).join(', ') || null

    const generated = await generateTasks({
      crop_name: crop.crop_name,
      variety: crop.variety,
      growth_stage: crop.growth_stage,
      sown_date: crop.sown_date,
      expected_harvest_date: crop.expected_harvest_date,
      soil_type: farm.soil_type,
      water_source: farm.water_source,
      location,
      language: profile?.preferred_language ?? 'English',
    })

    if (generated.length === 0)
      return NextResponse.json({ error: 'AI returned no tasks' }, { status: 502 })

    if (body.replace_pending) {
      await supabase
        .from('crop_tasks')
        .delete()
        .eq('crop_cycle_id', params.id)
        .eq('status', 'pending')
        .eq('ai_generated', true)
    }

    const rows = generated.map((t) => ({
      crop_cycle_id: params.id,
      task_name: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      due_date: dueDateFromOffset(t.due_offset_days),
      status: 'pending',
      ai_generated: true,
    }))

    const { data, error } = await supabase.from('crop_tasks').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ tasks: data, generated_count: data?.length ?? 0 })
  } catch (err) {
    console.error('[tasks/generate]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
