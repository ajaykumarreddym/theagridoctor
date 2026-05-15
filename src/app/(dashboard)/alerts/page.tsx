'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bell, Check, Trash2, Filter, ChevronLeft, Loader2, MailOpen, Mail, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Notif = {
  id: string
  type: string
  title: string
  message: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

type Resp = { notifications: Notif[]; total: number; unread: number }

type LevelFilter = 'all' | 'critical' | 'warning' | 'info'
type StatusFilter = 'all' | 'unread' | 'read'

const LEVELS: { key: LevelFilter; label: string; color: string }[] = [
  { key: 'all', label: 'All levels', color: 'bg-slate-100 text-slate-700' },
  { key: 'critical', label: 'Critical', color: 'bg-rose-100 text-rose-700' },
  { key: 'warning', label: 'Warning', color: 'bg-amber-100 text-amber-700' },
  { key: 'info', label: 'Info', color: 'bg-sky-100 text-sky-700' },
]

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
]

const PAGE = 20

function levelOf(type: string): 'critical' | 'warning' | 'info' {
  if (type.includes('critical')) return 'critical'
  if (type.includes('warning')) return 'warning'
  return 'info'
}
function levelDotClass(level: string) {
  return level === 'critical' ? 'bg-rose-500'
    : level === 'warning' ? 'bg-amber-500'
    : 'bg-sky-500'
}
function levelBadgeClass(level: string) {
  return level === 'critical' ? 'bg-rose-100 text-rose-700'
    : level === 'warning' ? 'bg-amber-100 text-amber-700'
    : 'bg-sky-100 text-sky-700'
}
function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AlertsPage() {
  const [level, setLevel] = useState<LevelFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE))
      params.set('offset', String(page * PAGE))
      if (level !== 'all') params.set('level', level)
      if (status === 'unread') params.set('unread_only', '1')
      const res = await fetch(`/api/notifications?${params.toString()}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
      const j = (await res.json()) as Resp
      // Client-side 'read' filter (server only supports unread_only)
      let list = j.notifications
      if (status === 'read') list = list.filter((n) => n.read_at !== null)
      setData({ ...j, notifications: list })
      setSelected(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [level, status, page])

  useEffect(() => { load() }, [load])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [level, status])

  const act = async (action: string, ids?: string[]) => {
    setActing(true)
    setError(null)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(false)
    }
  }

  const list = data?.notifications ?? []
  const total = data?.total ?? 0
  const unread = data?.unread ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE))

  const allSelected = list.length > 0 && list.every((n) => selected.has(n.id))
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(list.map((n) => n.id)))
  }
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selIds = useMemo(() => Array.from(selected), [selected])
  const hasSel = selIds.length > 0
  const selReadCount = list.filter((n) => selected.has(n.id) && n.read_at).length
  const selUnreadCount = selIds.length - selReadCount

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-emerald-700">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to dashboard
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600" />
            Alerts & Notifications
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {total} notification{total === 1 ? '' : 's'} · {unread} unread
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings/alerts" className="text-xs">
            <Button size="sm" variant="outline">Alert settings</Button>
          </Link>
          {unread > 0 && (
            <Button size="sm" variant="outline" onClick={() => act('mark_all_read')} disabled={acting}>
              <Check className="w-4 h-4 mr-1" /> Mark all read
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!confirm('Delete all read notifications?')) return
              act('delete_all_read')
            }}
            disabled={acting}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Clear read
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wide">Level</span>
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLevel(l.key)}
                className={`text-[11px] px-2.5 py-1 rounded-md border ${
                  level === l.key
                    ? 'border-emerald-500 ring-1 ring-emerald-200 ' + l.color
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
            {STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(s.key)}
                className={`text-[11px] px-2.5 py-1 rounded-md border ${
                  status === s.key
                    ? 'border-emerald-500 ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {hasSel && (
        <div className="sticky top-2 z-20 bg-white border border-emerald-200 rounded-lg shadow-sm px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-700 font-medium">
            {selIds.length} selected
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selUnreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={() => act('mark_read', selIds)} disabled={acting}>
                <MailOpen className="w-3.5 h-3.5 mr-1" /> Mark read
              </Button>
            )}
            {selReadCount > 0 && (
              <Button size="sm" variant="outline" onClick={() => act('mark_unread', selIds)} disabled={acting}>
                <Mail className="w-3.5 h-3.5 mr-1" /> Mark unread
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                if (!confirm(`Delete ${selIds.length} notification(s)?`)) return
                act('delete', selIds)
              }}
              disabled={acting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={acting}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      {/* List */}
      <Card>
        {loading ? (
          <CardContent className="p-10 text-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading…
          </CardContent>
        ) : list.length === 0 ? (
          <CardContent className="p-16 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">No notifications match the current filters.</p>
          </CardContent>
        ) : (
          <div>
            {/* select-all header */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs text-slate-500">
                {allSelected ? 'Clear selection' : 'Select all on this page'}
              </span>
            </div>

            {list.map((n) => {
              const lvl = levelOf(n.type)
              const farmId = (n.metadata?.farm_id as string | undefined) ?? null
              const sel = selected.has(n.id)
              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-slate-50 last:border-0 flex items-start gap-3 transition-colors ${
                    sel ? 'bg-emerald-50/60' : n.read_at ? 'bg-white' : 'bg-emerald-50/20'
                  } hover:bg-slate-50`}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggle(n.id)}
                    className="mt-1.5 w-4 h-4 accent-emerald-600 cursor-pointer flex-shrink-0"
                  />
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${levelDotClass(lvl)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{n.title}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${levelBadgeClass(lvl)}`}>
                        {lvl}
                      </span>
                      {!n.read_at && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">New</span>
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                      <span>{timeAgo(n.created_at)}</span>
                      <span>·</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {farmId && (
                        <>
                          <span>·</span>
                          <Link href={`/farms/${farmId}`} className="text-emerald-600 hover:text-emerald-700 font-medium">
                            View farm →
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {n.read_at ? (
                      <button
                        type="button"
                        onClick={() => act('mark_unread', [n.id])}
                        disabled={acting}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Mark unread"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => act('mark_read', [n.id])}
                        disabled={acting}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Mark read"
                      >
                        <MailOpen className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('Delete this notification?')) return
                        act('delete', [n.id])
                      }}
                      disabled={acting}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Quick helper */}
      {total === 0 && !loading && !error && (
        <div className="text-xs text-slate-500 flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
          Alerts are created automatically when a field crosses a configured threshold. Enable monitoring on any farm to start receiving notifications.
        </div>
      )}
    </div>
  )
}
