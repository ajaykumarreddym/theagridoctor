'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const SOIL_TYPES = ['Loamy', 'Clay', 'Sandy', 'Black', 'Red', 'Silty', 'Other']
const WATER_SOURCES = ['Canal', 'Borewell', 'Rainwater', 'Drip Irrigation', 'River', 'Pond', 'Tank', 'Other']

export default function NewFarmPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    total_area_acres: '',
    lat: '',
    lng: '',
    soil_type: '',
    water_source: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Farm name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          total_area_acres: form.total_area_acres ? Number(form.total_area_acres) : null,
          lat: form.lat ? Number(form.lat) : null,
          lng: form.lng ? Number(form.lng) : null,
          soil_type: form.soil_type || null,
          water_source: form.water_source || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create farm')
      router.push(`/farms/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/farms">
          <button className="flex items-center text-sm text-slate-500 hover:text-emerald-600 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Farms
          </button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Add New Farm</h1>
        <p className="text-slate-500 mt-1">Your farm data helps the AI advisor give you personalized advice.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Farm Name *</Label>
              <Input id="name" placeholder="e.g. North Field, River Bank Plot" {...field('name')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Total Area (Acres)</Label>
              <Input id="area" type="number" step="0.1" min="0" placeholder="e.g. 5.5" {...field('total_area_acres')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Soil & Irrigation</CardTitle>
            <CardDescription>Used by AI to give tailored recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="soil">Soil Type</Label>
              <select
                id="soil"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...field('soil_type')}
              >
                <option value="">Select soil type...</option>
                {SOIL_TYPES.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="water">Water Source</Label>
              <select
                id="water"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...field('water_source')}
              >
                <option value="">Select water source...</option>
                {WATER_SOURCES.map(w => <option key={w} value={w.toLowerCase()}>{w}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Location (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" type="number" step="any" placeholder="e.g. 18.9255" {...field('lat')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" type="number" step="any" placeholder="e.g. 72.8242" {...field('lng')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <Link href="/farms" className="flex-1">
            <button type="button" className="w-full h-11 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </Link>
          <Button type="submit" disabled={loading} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? 'Creating…' : 'Create Farm'}
          </Button>
        </div>
      </form>
    </div>
  )
}
