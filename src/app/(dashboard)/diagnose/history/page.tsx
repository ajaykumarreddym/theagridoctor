import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import type { Diagnosis } from '@/types/diagnose'
import { AlertTriangle, CheckCircle2, ChevronRight, Sprout, Clock, Filter, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
}

export default async function DiagnoseHistoryPage({
  searchParams,
}: {
  searchParams: { crop?: string; severity?: string; status?: string }
}) {
  const { user, supabase } = await requireUser()

  let query = supabase
    .from('diagnoses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (searchParams.crop) query = query.ilike('crop_type', `%${searchParams.crop}%`)
  if (searchParams.severity) query = query.eq('severity', searchParams.severity)
  if (searchParams.status) query = query.eq('status', searchParams.status)

  const { data, error } = await query.limit(50)

  void error
  const diagnoses: Diagnosis[] = (data ?? []) as Diagnosis[]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Diagnosis History</h1>
          <p className="text-slate-500 mt-1">{diagnoses.length} total record{diagnoses.length !== 1 ? 's' : ''} found</p>
        </div>
        <Link href="/diagnose">
          <button className="flex items-center h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Sprout className="w-4 h-4 mr-2" />
            New Diagnosis
          </button>
        </Link>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/diagnose/heatmap">
          <button className="flex items-center h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors">
            <MapPin className="w-4 h-4 mr-1.5 text-emerald-600" />
            View heatmap
          </button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="bg-slate-50/60 border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter Results</span>
          </div>
          <form className="flex flex-wrap gap-3">
            <input
              name="crop"
              defaultValue={searchParams.crop}
              placeholder="Crop type..."
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 w-36"
            />
            <select
              name="severity"
              defaultValue={searchParams.severity ?? ''}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              name="status"
              defaultValue={searchParams.status ?? ''}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Apply
            </button>
            <Link href="/diagnose/history">
              <button
                type="button"
                className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Reset
              </button>
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {diagnoses.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Sprout className="w-12 h-12 mx-auto mb-4 text-slate-200" />
          <p className="text-lg font-medium text-slate-500">No diagnoses found</p>
          <p className="text-sm mt-1">
            {searchParams.crop || searchParams.severity || searchParams.status
              ? 'Try adjusting your filters.'
              : "Run your first AI diagnosis to see results here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {diagnoses.map(d => {
            const sev = d.severity ?? 'low'
            return (
              <Link key={d.id} href={`/diagnose/${d.id}`}>
                <Card className="hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Image Thumbnail */}
                    {d.image_urls?.[0] ? (
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200">
                        <img 
                          src={d.image_urls[0]} 
                          alt={d.disease_name ?? 'Crop image'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${sev === 'critical' || sev === 'high' ? 'bg-red-50' : sev === 'medium' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        {d.full_report_json?.is_diseased === false ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <AlertTriangle className={`w-6 h-6 ${sev === 'critical' || sev === 'high' ? 'text-red-500' : sev === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`} />
                        )}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {d.disease_name ?? 'Unknown Condition'}
                        </p>
                        {d.severity && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${SEVERITY_STYLES[d.severity] ?? ''}`}>
                            {d.severity}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${d.status === 'resolved' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {d.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="capitalize">{d.crop_type}</span>
                        {d.confidence_pct !== null && (
                          <span className="flex items-center">
                            {d.confidence_pct.toFixed(0)}% confidence
                          </span>
                        )}
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 transition-colors" />
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
