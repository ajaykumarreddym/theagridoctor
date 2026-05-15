'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Sparkles, Plus, Check, Trash2, Droplets, Leaf, Bug, Scissors, Eye, Wheat, HelpCircle, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Task = {
  id: string
  title: string
  description: string | null
  category: string | null
  due_date: string | null
  status: 'pending' | 'done' | 'skipped'
  priority: string | null
  ai_generated: boolean
  created_at: string
  completed_at: string | null
}

const CAT_ICON: Record<string, React.ElementType> = {
  irrigation: Droplets,
  fertilization: Leaf,
  pest: Bug,
  weeding: Scissors,
  monitoring: Eye,
  harvest: Wheat,
  other: HelpCircle,
}
const CAT_TINT: Record<string, string> = {
  irrigation: 'bg-sky-50 text-sky-600',
  fertilization: 'bg-emerald-50 text-emerald-600',
  pest: 'bg-rose-50 text-rose-600',
  weeding: 'bg-amber-50 text-amber-600',
  monitoring: 'bg-indigo-50 text-indigo-600',
  harvest: 'bg-orange-50 text-orange-600',
  other: 'bg-slate-100 text-slate-500',
}

function priBadge(p: string | null | undefined) {
  if (p === 'high') return 'bg-rose-100 text-rose-700'
  if (p === 'low') return 'bg-slate-100 text-slate-500'
  return 'bg-amber-100 text-amber-700'
}

function daysUntil(d: string | null): { label: string; tone: string } {
  if (!d) return { label: 'No date', tone: 'text-slate-400' }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(d + 'T00:00:00'); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `Overdue ${-diff}d`, tone: 'text-rose-600 font-semibold' }
  if (diff === 0) return { label: 'Today', tone: 'text-amber-600 font-semibold' }
  if (diff === 1) return { label: 'Tomorrow', tone: 'text-amber-600' }
  if (diff <= 7) return { label: `In ${diff}d`, tone: 'text-emerald-600' }
  return { label: new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), tone: 'text-slate-500' }
}

export function CropTasks({ cropId, cropName }: { cropId: string; cropName: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/crops/${cropId}/tasks`)
      const j = await r.json()
      setTasks(j.tasks ?? [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
     
  }, [cropId])

  const generate = async (replace = false) => {
    setGenerating(true)
    setError(null)
    try {
      const r = await fetch(`/api/crops/${cropId}/tasks/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replace_pending: replace }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${r.status}`)
      }
      await load()
      setExpanded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate tasks')
    } finally {
      setGenerating(false)
    }
  }

  const toggle = async (t: Task) => {
    const nextStatus = t.status === 'done' ? 'pending' : 'done'
    // optimistic
    setTasks((prev) => prev?.map((x) => x.id === t.id ? { ...x, status: nextStatus } : x) ?? prev)
    try {
      await fetch(`/api/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
    } catch {
      load()
    }
  }

  const del = async (id: string) => {
    setTasks((prev) => prev?.filter((x) => x.id !== id) ?? prev)
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch {
      load()
    }
  }

  const addManual = async () => {
    if (!newTitle.trim()) return
    try {
      const r = await fetch(`/api/crops/${cropId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, due_date: newDue || null }),
      })
      if (r.ok) {
        setNewTitle(''); setNewDue(''); setAdding(false)
        await load()
      }
    } catch {/* ignore */}
  }

  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0
  const list = tasks ?? []
  const visible = expanded ? list : list.slice(0, 3)

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Tasks
          {pendingCount > 0 && (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded">{pendingCount}</span>
          )}
        </button>
        <div className="flex gap-1.5">
          {list.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generate(true)}
              disabled={generating}
              className="h-7 text-[11px] px-2"
              title="Regenerate tasks (replaces pending AI tasks)"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            </Button>
          )}
          {list.length === 0 ? (
            <Button
              size="sm"
              onClick={() => generate(false)}
              disabled={generating || loading}
              className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Generate with AI
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding((v) => !v)}
              className="h-7 text-[11px] px-2"
            >
              <Plus className="w-3 h-3 mr-0.5" /> Add
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded px-2 py-1 mt-2">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 mt-2"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Loading tasks…</p>
      ) : list.length === 0 ? (
        <p className="text-[11px] text-slate-400 mt-2">
          No tasks yet. Generate a calendar for <span className="font-medium text-slate-600">{cropName}</span> with AI.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {visible.map((t) => {
            const Icon = CAT_ICON[t.category ?? 'other'] ?? HelpCircle
            const tint = CAT_TINT[t.category ?? 'other']
            const due = daysUntil(t.due_date)
            const done = t.status === 'done'
            return (
              <li
                key={t.id}
                className={`group flex items-start gap-2 px-2 py-2 rounded-lg border ${
                  done ? 'bg-slate-50/60 border-slate-100' : 'bg-white border-slate-100 hover:border-emerald-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border ${
                    done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'
                  } flex items-center justify-center transition-colors`}
                  aria-label={done ? 'Mark pending' : 'Mark done'}
                >
                  {done && <Check className="w-3 h-3" />}
                </button>
                <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${tint}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-medium ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {t.title}
                    </span>
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${priBadge(t.priority)}`}>
                      {t.priority ?? 'med'}
                    </span>
                  </div>
                  {t.description && !done && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.description}</p>
                  )}
                  <p className={`text-[10px] mt-0.5 ${due.tone}`}>{due.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => del(t.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 p-1"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            )
          })}
          {!expanded && list.length > 3 && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Show {list.length - 3} more
              </button>
            </li>
          )}
        </ul>
      )}

      {adding && (
        <div className="mt-2 p-2 bg-slate-50 rounded-lg space-y-2">
          <input
            type="text"
            placeholder="Task title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full h-8 px-2 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <div className="flex gap-1.5">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="flex-1 h-8 px-2 text-xs rounded border border-slate-200"
            />
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={addManual} disabled={!newTitle.trim()}>
              Save
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setAdding(false); setNewTitle(''); setNewDue('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
