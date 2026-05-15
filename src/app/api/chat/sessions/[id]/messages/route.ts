import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/chat/sessions/[id]/messages — get messages for a session
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify ownership
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
