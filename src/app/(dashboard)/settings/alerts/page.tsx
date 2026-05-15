'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RotateCcw, Save, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Prefs = {
  temp_high?: { critical?: number; warning?: number }
  temp_low?: { critical?: number; warning?: number }
  soil_moisture_low?: { critical?: number; warning?: number }
  soil_moisture_high?: { warning?: number }
  soil_surface_hot?: { warning?: number }
  uv?: { critical?: number; warning?: number }
  wind?: { critical?: number; warning?: number }
  rain_48h?: { critical?: number; warning?: number }
  ndvi?: { critical?: number; warning?: number }
}

type Response = { preferences: Prefs | null; defaults: Prefs }

function NumberField({
  label, unit, value, step = 1, onChange,
}: { label: string; unit?: string; value?: number; step?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 block mb-1">{label}{unit && ` (${unit})`}</label>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? undefined : Number(v))
        }}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
      />
    </div>
  )
}

export default function AlertSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>({})
  const [defaults, setDefaults] = useState<Prefs>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/alert-preferences')
        if (!r.ok) throw new Error(await r.text())
        const j = (await r.json()) as Response
        setDefaults(j.defaults ?? {})
        setPrefs(j.preferences ?? {})
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const effective = (key: keyof Prefs, sub: 'critical' | 'warning') => {
    const p = prefs[key] as Record<string, number> | undefined
    const d = defaults[key] as Record<string, number> | undefined
    return p?.[sub] ?? d?.[sub]
  }
  const setField = (key: keyof Prefs, sub: 'critical' | 'warning', v: number | undefined) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as Record<string, number> | undefined), [sub]: v },
    }))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/alert-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
      setSavedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    setPrefs({})
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-emerald-700">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Alert Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Configure the thresholds used to trigger field-monitoring alerts and notifications. Leave a field blank to use the default value.
        </p>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temperature</CardTitle>
          <CardDescription>Air temperature thresholds</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField label="Heat critical" unit="°C" value={effective('temp_high', 'critical')} onChange={(v) => setField('temp_high', 'critical', v)} />
          <NumberField label="Heat warning" unit="°C" value={effective('temp_high', 'warning')} onChange={(v) => setField('temp_high', 'warning', v)} />
          <NumberField label="Cold critical" unit="°C" value={effective('temp_low', 'critical')} onChange={(v) => setField('temp_low', 'critical', v)} />
          <NumberField label="Cold warning" unit="°C" value={effective('temp_low', 'warning')} onChange={(v) => setField('temp_low', 'warning', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soil</CardTitle>
          <CardDescription>Moisture is volumetric 0–1 (e.g. 0.15 = 15%).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField label="Moisture dry critical" value={effective('soil_moisture_low', 'critical')} step={0.01} onChange={(v) => setField('soil_moisture_low', 'critical', v)} />
          <NumberField label="Moisture dry warning" value={effective('soil_moisture_low', 'warning')} step={0.01} onChange={(v) => setField('soil_moisture_low', 'warning', v)} />
          <NumberField label="Waterlog warning" value={effective('soil_moisture_high', 'warning')} step={0.01} onChange={(v) => setField('soil_moisture_high', 'warning', v)} />
          <NumberField label="Surface hot" unit="°C" value={effective('soil_surface_hot', 'warning')} onChange={(v) => setField('soil_surface_hot', 'warning', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">UV & Wind</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField label="UV critical" value={effective('uv', 'critical')} onChange={(v) => setField('uv', 'critical', v)} />
          <NumberField label="UV warning" value={effective('uv', 'warning')} onChange={(v) => setField('uv', 'warning', v)} />
          <NumberField label="Wind critical" unit="m/s" value={effective('wind', 'critical')} onChange={(v) => setField('wind', 'critical', v)} />
          <NumberField label="Wind warning" unit="m/s" value={effective('wind', 'warning')} onChange={(v) => setField('wind', 'warning', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rain & Vegetation</CardTitle>
          <CardDescription>48h forecast rain (mm) and mean NDVI (0–1).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField label="Rain critical" unit="mm" value={effective('rain_48h', 'critical')} onChange={(v) => setField('rain_48h', 'critical', v)} />
          <NumberField label="Rain warning" unit="mm" value={effective('rain_48h', 'warning')} onChange={(v) => setField('rain_48h', 'warning', v)} />
          <NumberField label="NDVI critical" value={effective('ndvi', 'critical')} step={0.05} onChange={(v) => setField('ndvi', 'critical', v)} />
          <NumberField label="NDVI warning" value={effective('ndvi', 'warning')} step={0.05} onChange={(v) => setField('ndvi', 'warning', v)} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={resetDefaults} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-1" /> Reset to defaults
        </Button>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-slate-400">Saved {savedAt.toLocaleTimeString()}</span>}
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
