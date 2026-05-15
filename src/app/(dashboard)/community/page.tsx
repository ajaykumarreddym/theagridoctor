'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, MessageSquare, ThumbsUp, Loader2, Sparkles, Users as UsersIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Post = {
  id: string
  title: string
  body: string
  crop_tag: string | null
  tags: string[]
  image_urls: string[]
  upvotes: number
  created_at: string
  author_name: string
  reply_count: number
}

const POPULAR_TAGS = ['Rice', 'Wheat', 'Tomato', 'Disease', 'Pest', 'Fertilizer', 'Irrigation', 'Organic']

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'F'
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tag) params.set('tag', tag)
    try {
      const res = await fetch(`/api/community?${params}`)
      const json = await res.json()
      if (res.ok) setPosts(json.posts || [])
    } finally {
      setLoading(false)
    }
  }, [q, tag])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Community</h1>
          <p className="text-slate-500 mt-1">Ask questions, share knowledge, and learn from fellow farmers.</p>
        </div>
        <Link href="/community/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Ask a Question
          </Button>
        </Link>
      </div>

      {/* Search + tag chips */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search posts…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load() }}
              className="pl-9 h-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTag('')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                tag === '' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            {POPULAR_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t === tag ? '' : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  tag === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading community…</p>
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-400">
            <UsersIcon className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm mb-3">No posts yet. Be the first to start a discussion!</p>
            <Link href="/community/new">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" /> Create post
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/community/${p.id}`} className="block">
              <Card className="hover:border-emerald-200 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center flex-shrink-0">
                      {initialsOf(p.author_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{p.author_name}</span>
                        <span>·</span>
                        <span>{timeAgo(p.created_at)}</span>
                      </div>
                      <h3 className="font-semibold text-slate-800 mt-1 line-clamp-1">{p.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.body}</p>
                      {(p.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {p.tags.slice(0, 5).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {p.reply_count} replies
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {p.upvotes}
                        </span>
                        {p.reply_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <Sparkles className="w-3.5 h-3.5" />
                            AI + community
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
