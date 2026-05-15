import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { aiText } from '@/lib/ai'

async function generateAiReply(title: string, body: string, tags: string[]): Promise<string | null> {
  try {
    return await aiText(
      [
        {
          role: 'system',
          content:
            'You are AgriDoctor AI, a concise agronomy assistant for Indian smallholder farmers. ' +
            'Reply to a farmer community question in 4-7 short bullet points with practical, locally relevant advice. ' +
            'Use plain language, mention common causes and 2-3 concrete next steps. No disclaimers.',
        },
        {
          role: 'user',
          content: `Title: ${title}\nTags: ${tags.join(', ') || 'none'}\n\n${body}`,
        },
      ],
      { maxTokens: 500, temperature: 0.4 }
    )
  } catch (err) {
    console.error('[community/ai] generation failed:', err instanceof Error ? err.message : err)
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { content, request_ai } = await req.json()
    if (!content || String(content).trim().length === 0) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    const { data: reply, error } = await supabase
      .from('community_replies')
      .insert({
        post_id: params.id,
        user_id: user.id,
        is_ai: false,
        content: String(content).slice(0, 4000),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Optionally trigger AI reply (non-blocking to client)
    if (request_ai) {
      const { data: post } = await supabase
        .from('community_posts')
        .select('title,body,tags')
        .eq('id', params.id)
        .maybeSingle()
      if (post) {
        const aiContent = await generateAiReply(post.title, post.body, post.tags || [])
        if (aiContent) {
          await supabase.from('community_replies').insert({
            post_id: params.id,
            user_id: null,
            is_ai: true,
            content: aiContent,
          })
        }
      }
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
