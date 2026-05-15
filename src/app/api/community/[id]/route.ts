import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post, error } = await supabase
    .from('community_posts')
    .select('id,title,body,crop_tag,tags,image_urls,upvotes,created_at,user_id,users(full_name)')
    .eq('id', params.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: replies } = await supabase
    .from('community_replies')
    .select('id,content,upvotes,created_at,is_ai,user_id,users(full_name)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    post: {
      ...post,
      author_name: (post.users as unknown as { full_name?: string } | null)?.full_name || 'Farmer',
    },
    replies: (replies ?? []).map((r) => ({
      ...r,
      author_name: r.is_ai
        ? 'AgriDoctor AI'
        : (r.users as unknown as { full_name?: string } | null)?.full_name || 'Farmer',
    })),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
