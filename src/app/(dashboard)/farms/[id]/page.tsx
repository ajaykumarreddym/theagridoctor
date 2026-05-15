'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trees, Leaf, ChevronLeft, Plus, Loader2, ChevronRight,
  Droplets, AlertTriangle, CheckCircle2, Clock, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldMonitoring } from '@/components/farm/field-monitoring'
import { WeatherRadar } from '@/components/farm/weather-radar'
import { CropTasks } from '@/components/farm/crop-tasks'
import type { Farm, CropCycle } from '@/types/farm'

type FarmWithCrops = Farm & { crop_cycles: CropCycle[] }

const GROWTH_STAGES = ['seedling', 'vegetative', 'flowering', 'fruiting', 'harvest', 'harvested']
const STAGE_COLORS: Record<string, string> = {
  seedling: 'bg-emerald-100 text-emerald-700',
  vegetative: 'bg-green-100 text-green-700',
  flowering: 'bg-pink-100 text-pink-700',
  fruiting: 'bg-amber-100 text-amber-700',
  harvest: 'bg-orange-100 text-orange-700',
  harvested: 'bg-slate-100 text-slate-600',
}

export default function FarmDetailPage() {
  const params = useParams()
  const router = useRouter()
  const farmId = params.id as string

  const [farm, setFarm] = useState<FarmWithCrops | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCrop, setShowAddCrop] = useState(false)
  const [addingCrop, setAddingCrop] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [cropForm, setCropForm] = useState({
    crop_name: '', variety: '', sown_date: '', expected_harvest_date: '', growth_stage: 'seedling'
  })

  const deleteFarm = async () => {
    if (!farm) return
    const confirmText = prompt(
      `This will permanently delete "${farm.name}" and all its crops. Type the farm name to confirm:`
    )
    if (confirmText === null) return
    if (confirmText.trim() !== farm.name.trim()) {
      alert('Name did not match. Deletion cancelled.')
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/farms/${farmId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      router.push('/farms')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete farm')
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetch(`/api/farms/${farmId}`)
      .then(r => r.json())
      .then(data => {
        if (data.id) setFarm(data)
        setLoading(false)
      })
      .catch(() => { setLoading(false) })
  }, [farmId])

  const addCrop = async () => {
    if (!cropForm.crop_name.trim()) return
    setAddingCrop(true)
    try {
      const res = await fetch(`/api/farms/${farmId}/crops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cropForm),
      })
      const newCrop: CropCycle = await res.json()
      if (newCrop.id) {
        setFarm(prev => prev ? { ...prev, crop_cycles: [newCrop, ...(prev.crop_cycles ?? [])] } : prev)
        setCropForm({ crop_name: '', variety: '', sown_date: '', expected_harvest_date: '', growth_stage: 'seedling' })
        setShowAddCrop(false)
      }
    } finally {
      setAddingCrop(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-40 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  if (!farm) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Farm not found.</p>
        <Link href="/farms"><button className="mt-4 text-emerald-600 text-sm hover:underline">Back to Farms</button></Link>
      </div>
    )
  }

  const activeCrops = farm.crop_cycles?.filter(c => c.status === 'active') ?? []
  const inactiveCrops = farm.crop_cycles?.filter(c => c.status !== 'active') ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link href="/farms">
        <button className="flex items-center text-sm text-slate-500 hover:text-emerald-600 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Farms
        </button>
      </Link>

      {/* Farm Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Trees className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{farm.name}</h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  {farm.total_area_acres ? `${farm.total_area_acres} acres` : 'Area not set'}
                  {farm.soil_type && ` · ${farm.soil_type} soil`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteFarm}
              disabled={deleting}
              className="text-red-600 hover:bg-red-50 border-red-200"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              Delete farm
            </Button>
          </div>
          {deleteError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-3">
              {deleteError}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-50">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Area</p>
              <p className="text-base font-semibold text-slate-700 mt-1">{farm.total_area_acres ?? '—'} ac</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Soil</p>
              <p className="text-base font-semibold text-slate-700 capitalize mt-1">{farm.soil_type ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center"><Droplets className="w-3 h-3 mr-1" />Water</p>
              <p className="text-base font-semibold text-slate-700 capitalize mt-1">{farm.water_source ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Active Crops</p>
              <p className="text-base font-semibold text-emerald-600 mt-1">{activeCrops.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Monitoring — Agro / satellite */}
      <FieldMonitoring
        farmId={farm.id}
        farmLat={farm.lat ?? null}
        farmLng={farm.lng ?? null}
      />

      {/* Weather Radar */}
      {typeof farm.lat === 'number' && typeof farm.lng === 'number' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              Live Weather Radar
            </CardTitle>
            <CardDescription>
              Real-time precipitation, clouds, temperature, wind and pressure over your field. Auto-refreshes every 5 min.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeatherRadar lat={farm.lat} lng={farm.lng} height={420} />
          </CardContent>
        </Card>
      )}

      {/* Crop Cycles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Crop Cycles</CardTitle>
            <CardDescription>{activeCrops.length} active · {inactiveCrops.length} completed</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddCrop(!showAddCrop)}
            className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Crop
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add crop form */}
          {showAddCrop && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-3">
              <h4 className="text-sm font-semibold text-emerald-900">New Crop Cycle</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Crop Name *</Label>
                  <Input
                    placeholder="e.g. Tomato"
                    value={cropForm.crop_name}
                    onChange={e => setCropForm(p => ({ ...p, crop_name: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Variety (optional)</Label>
                  <Input
                    placeholder="e.g. Cherry, Roma"
                    value={cropForm.variety}
                    onChange={e => setCropForm(p => ({ ...p, variety: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sowing Date</Label>
                  <Input
                    type="date"
                    value={cropForm.sown_date}
                    onChange={e => setCropForm(p => ({ ...p, sown_date: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Growth Stage</Label>
                  <select
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 capitalize"
                    value={cropForm.growth_stage}
                    onChange={e => setCropForm(p => ({ ...p, growth_stage: e.target.value }))}
                  >
                    {GROWTH_STAGES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={addCrop}
                  disabled={addingCrop || !cropForm.crop_name.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {addingCrop && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Save Crop
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddCrop(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Crops list */}
          {(farm.crop_cycles ?? []).length === 0 && !showAddCrop ? (
            <div className="py-10 text-center text-slate-400">
              <Leaf className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-sm">No crops added yet. Add your first crop cycle above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...activeCrops, ...inactiveCrops].map(crop => (
                <div key={crop.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {crop.crop_name}
                          {crop.variety && <span className="text-slate-400 font-normal"> · {crop.variety}</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STAGE_COLORS[crop.growth_stage] ?? 'bg-slate-100 text-slate-600'}`}>
                            {crop.growth_stage}
                          </span>
                          {crop.sown_date && (
                            <span className="text-[10px] text-slate-400 flex items-center">
                              <Clock className="w-2.5 h-2.5 mr-0.5" />
                              Sown {new Date(crop.sown_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      {crop.status === 'active'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">{crop.status}</span>
                      }
                    </div>
                  </div>
                  {crop.status === 'active' && (
                    <CropTasks cropId={crop.id} cropName={crop.crop_name} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick action - go to advisor */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-emerald-900">Ask the AI about this farm</p>
            <p className="text-sm text-emerald-700 mt-0.5">Get personalized advice based on your soil type, crops, and conditions.</p>
          </div>
          <Link href="/advisor">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-sm flex-shrink-0">
              Open Advisor
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
