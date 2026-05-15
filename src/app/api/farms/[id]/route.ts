import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('farms')
      .select('*, crop_cycles(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('farms')
      .update(body)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('farms').delete().eq('id', params.id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
