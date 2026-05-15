'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Info, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const POPULAR_TAGS = ['Rice', 'Wheat', 'Tomato', 'Disease', 'Pest', 'Fertilizer', 'Irrigation', 'Organic']

export default function CreatePostPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [requestAi, setRequestAi] = useState(true)

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !body.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          tags: selectedTags,
          crop_tag: selectedTags[0] || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create post')
      const postId = json.post?.id

      // If user opted in, silently request an AI seed reply so the post has an initial answer
      if (postId && requestAi) {
        await fetch(`/api/community/${postId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Requesting AI guidance on this question.',
            request_ai: true,
          }),
        }).catch(() => {})
      }

      router.push(postId ? `/community/${postId}` : '/community')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/community" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-emerald-600">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Community
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ask the Community</h1>
        <p className="text-slate-500 mt-1">Get advice from other farmers and our AI agronomy expert.</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold text-slate-700">Question Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Yellow spots on Tomato leaves after heavy rain"
                className="h-12 text-base rounded-xl border-slate-200"
                required
                maxLength={200}
              />
              <p className="text-xs text-slate-500 flex items-center mt-1">
                <Info className="w-3.5 h-3.5 mr-1" /> Be specific to get better answers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body" className="text-sm font-semibold text-slate-700">Details *</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Include details like crop age, recent fertilizers used, soil type, and weather conditions…"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-700 flex justify-between items-center">
                Select Tags
                <span className="text-xs font-normal text-slate-400">{selectedTags.length} selected</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md scale-105'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requestAi}
                onChange={(e) => setRequestAi(e.target.checked)}
                className="accent-emerald-600"
              />
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Also request an AgriDoctor AI answer
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/community">
            <Button type="button" variant="ghost" className="h-12 px-6 rounded-xl text-slate-600 hover:bg-slate-100">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting…
              </>
            ) : (
              'Post Question'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
