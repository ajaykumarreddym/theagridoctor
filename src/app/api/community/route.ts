import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const tag = searchParams.get('tag')?.trim()

  let query = supabase
    .from('community_posts')
    .select('id,title,body,crop_tag,tags,image_urls,upvotes,created_at,user_id,users(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch reply counts
  const ids = (data ?? []).map((p) => p.id)
  const counts: Record<string, number> = {}
  if (ids.length) {
    const { data: replies } = await supabase
      .from('community_replies')
      .select('post_id')
      .in('post_id', ids)
    for (const r of replies ?? []) counts[r.post_id] = (counts[r.post_id] ?? 0) + 1
  }

  return NextResponse.json({
    posts: (data ?? []).map((p) => ({
      ...p,
      author_name: (p.users as unknown as { full_name?: string } | null)?.full_name || 'Farmer',
      reply_count: counts[p.id] ?? 0,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { title, body: content, crop_tag, tags, image_urls } = body ?? {}
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        title: String(title).slice(0, 200),
        body: String(content).slice(0, 10000),
        crop_tag: crop_tag || null,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        image_urls: Array.isArray(image_urls) ? image_urls.slice(0, 6) : [],
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
