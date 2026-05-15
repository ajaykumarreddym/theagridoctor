import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/chat/sessions — list all sessions for user
export async function GET() {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/chat/sessions — create a new session
export async function POST() {
  try {
    const { user, supabase } = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, title: 'New Conversation' })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
