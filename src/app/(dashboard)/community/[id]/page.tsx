'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, MessageSquare, Send, Sparkles, ThumbsUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'

type Reply = {
  id: string
  content: string
  upvotes: number
  created_at: string
  is_ai: boolean
  author_name: string
}

type Post = {
  id: string
  title: string
  body: string
  crop_tag: string | null
  tags: string[]
  upvotes: number
  created_at: string
  author_name: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'F'
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [input, setInput] = useState('')
  const [posting, setPosting] = useState(false)
  const [requestAi, setRequestAi] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/community/${id}`)
    if (res.status === 404) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const json = await res.json()
    if (res.ok) {
      setPost(json.post)
      setReplies(json.replies || [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || posting) return
    setPosting(true)
    try {
      const res = await fetch(`/api/community/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim(), request_ai: requestAi }),
      })
      if (res.ok) {
        setInput('')
        await load()
      }
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
        <p className="text-sm">Loading post…</p>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-slate-600 mb-4">This post no longer exists.</p>
        <Button onClick={() => router.push('/community')} className="bg-emerald-600 hover:bg-emerald-700">
          Back to Community
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href="/community" className="inline-flex items-center text-sm text-slate-500 hover:text-emerald-600">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Community
      </Link>

      {/* Post */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center flex-shrink-0">
              {initials(post.author_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{post.author_name}</span> · {timeAgo(post.created_at)}
              </div>
              <h1 className="text-xl font-bold text-slate-800 mt-1">{post.title}</h1>
              <div className="mt-3"><Markdown content={post.body} /></div>
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {post.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> {post.upvotes}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> {replies.length} replies
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h2>
        {replies.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-slate-400">
              No replies yet. Be the first to respond!
            </CardContent>
          </Card>
        ) : (
          replies.map((r) => (
            <Card key={r.id} className={r.is_ai ? 'border-emerald-200 bg-emerald-50/30' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full font-semibold flex items-center justify-center flex-shrink-0 ${
                    r.is_ai ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {r.is_ai ? <Sparkles className="w-4 h-4" /> : initials(r.author_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="font-medium text-slate-700">{r.author_name}</span>
                      {r.is_ai && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold">AI</span>
                      )}
                      <span>· {timeAgo(r.created_at)}</span>
                    </div>
                    <div className="mt-1">
                      {r.is_ai ? <Markdown content={r.content} compact /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.content}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Reply composer */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={submitReply} className="space-y-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              placeholder="Share your experience or advice…"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestAi}
                  onChange={(e) => setRequestAi(e.target.checked)}
                  className="accent-emerald-600"
                />
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Also request AgriDoctor AI answer
              </label>
              <Button type="submit" disabled={posting || !input.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Post Reply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
