'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trees, MapPin, Sprout, ChevronRight, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Farm, CropCycle } from '@/types/farm'

type FarmWithCrops = Farm & { crop_cycles: CropCycle[] }

const SOIL_COLORS: Record<string, string> = {
  loamy: 'bg-amber-100 text-amber-800',
  clay: 'bg-orange-100 text-orange-800',
  sandy: 'bg-yellow-100 text-yellow-800',
  black: 'bg-slate-700 text-white',
  red: 'bg-red-100 text-red-800',
}

export default function FarmsPage() {
  const [farms, setFarms] = useState<FarmWithCrops[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/farms')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setFarms(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-100 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-52 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Farm Management</h1>
          <p className="text-slate-500 mt-1">{farms.length} farm{farms.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Link href="/farms/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Farm
          </Button>
        </Link>
      </div>

      {farms.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-2xl">
          <Trees className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600">No farms yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">Add your first farm to start tracking crops and getting AI insights</p>
          <Link href="/farms/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Farm
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {farms.map(farm => {
            const activeCrops = farm.crop_cycles?.filter(c => c.status === 'active') ?? []
            return (
              <Link key={farm.id} href={`/farms/${farm.id}`}>
                <Card className="hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <Trees className="w-5 h-5 text-emerald-600" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors mt-1" />
                    </div>
                    <CardTitle className="text-base mt-3">{farm.name}</CardTitle>
                    <CardDescription className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {farm.total_area_acres ? `${farm.total_area_acres} acres` : 'Area not set'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {farm.soil_type && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${SOIL_COLORS[farm.soil_type.toLowerCase()] ?? 'bg-slate-100 text-slate-600'}`}>
                          {farm.soil_type} soil
                        </span>
                      )}
                      {farm.water_source && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {farm.water_source}
                        </span>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-50">
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Active Crops</p>
                      {activeCrops.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No active crops</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {activeCrops.slice(0, 4).map(c => (
                            <span key={c.id} className="inline-flex items-center text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                              <Leaf className="w-2.5 h-2.5 mr-1" />
                              {c.crop_name}
                            </span>
                          ))}
                          {activeCrops.length > 4 && (
                            <span className="text-xs text-slate-400">+{activeCrops.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
