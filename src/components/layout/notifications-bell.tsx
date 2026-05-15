'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function levelDot(type: string) {
  if (type.includes('critical')) return 'bg-rose-500'
  if (type.includes('warning')) return 'bg-amber-500'
  return 'bg-sky-500'
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (!res.ok) return
      const j = await res.json()
      setItems(j.notifications ?? [])
      setUnread(j.unread ?? 0)
    } catch {
      /* ignore */
    }
  }, [])

  // Initial load + poll every 60s
  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  // Refresh when opening
  useEffect(() => {
    if (open) fetchNotifs()
  }, [open, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const markAllRead = async () => {
    setLoading(true)
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      await fetchNotifs()
    } finally {
      setLoading(false)
    }
  }

  const markOneRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', ids: [id] }),
    })
    fetchNotifs()
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <div className="text-sm font-semibold text-slate-800">Notifications</div>
              <div className="text-xs text-slate-500">
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </div>
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                No notifications yet
              </div>
            ) : (
              items.map((n) => {
                const farmId = (n.metadata?.farm_id as string | undefined) ?? null
                const href = farmId ? `/farms/${farmId}` : null
                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 border-b border-slate-50 last:border-0 ${
                      n.read_at ? 'bg-white' : 'bg-emerald-50/40'
                    } hover:bg-slate-50 cursor-pointer`}
                    onClick={() => { if (!n.read_at) markOneRead(n.id) }}
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${levelDot(n.type)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 truncate">{n.title}</div>
                      {n.body && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
                      <div className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)} ago</div>
                    </div>
                  </div>
                )
                return href ? (
                  <Link key={n.id} href={href} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex items-center justify-between">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
            >
              View all alerts →
            </Link>
            <Link
              href="/settings/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-600 hover:text-emerald-700 font-medium"
            >
              Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
