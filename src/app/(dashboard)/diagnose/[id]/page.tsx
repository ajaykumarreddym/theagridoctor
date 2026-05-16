import { requireUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import type { Diagnosis, DiagnosisReport } from '@/types/diagnose'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Leaf,
  FlaskConical,
  Sprout,
  Shield,
  TrendingDown,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const SEVERITY_CONFIG = {
  low: { label: 'Low', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  medium: { label: 'Medium', classes: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle },
  high: { label: 'High', classes: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
  critical: { label: 'Critical', classes: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Confidence</span>
        <span className="font-semibold">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Icon className="w-4 h-4 mr-2 text-emerald-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default async function DiagnoseResultPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser()

  const { data, error } = await supabase
    .from('diagnoses')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) notFound()

  const diagnosis = data as Diagnosis
  const report = diagnosis.full_report_json as DiagnosisReport
  const severity = diagnosis.severity ?? 'low'
  const severityConf = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low
  const SeverityIcon = severityConf.icon

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-slate-500 space-x-1">
        <Link href="/diagnose" className="hover:text-emerald-600 transition-colors">Diagnose</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700 font-medium">Result</span>
      </nav>

      {/* Hero Card */}
      <Card className={`border-2 ${diagnosis.severity === 'critical' ? 'border-red-200' : diagnosis.severity === 'high' ? 'border-orange-200' : 'border-slate-200'}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${severityConf.classes}`}>
                  <SeverityIcon className="w-3.5 h-3.5" />
                  {severityConf.label} Severity
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-wide">{diagnosis.crop_type}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">
                {report?.disease_name ?? diagnosis.disease_name ?? 'Unknown Condition'}
              </h1>
              {report?.affected_part && (
                <p className="text-sm text-slate-500 mt-1">Affected part: <span className="capitalize font-medium text-slate-700">{report.affected_part}</span></p>
              )}
              {diagnosis.confidence_pct !== null && (
                <ConfidenceBar value={diagnosis.confidence_pct} />
              )}
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${diagnosis.severity === 'critical' || diagnosis.severity === 'high' ? 'bg-red-50' : 'bg-emerald-50'}`}>
              {report?.is_diseased
                ? <AlertTriangle className={`w-8 h-8 ${diagnosis.severity === 'critical' || diagnosis.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                : <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              }
            </div>
          </div>

          {/* Quick stats */}
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400">Est. Yield Loss</p>
                <p className="text-lg font-bold text-red-600 mt-0.5">{report.estimated_yield_loss_pct_if_untreated ?? '—'}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Act Within</p>
                <p className="text-lg font-bold text-amber-600 mt-0.5">{report.urgency_days ?? '—'} days</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Detected</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{new Date(diagnosis.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Images */}
      {diagnosis.image_urls && diagnosis.image_urls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Uploaded Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {diagnosis.image_urls.map((url, idx) => (
                <a 
                  key={idx} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 block"
                >
                  <img 
                    src={url} 
                    alt={`Diagnosis image ${idx + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report ? (
        <div className="space-y-4">
          {/* Cause */}
          <Section title="Root Cause" icon={Leaf}>
            <p className="text-sm text-slate-700 leading-relaxed">{report.cause}</p>
          </Section>

          {/* Symptoms */}
          {report.symptoms?.length > 0 && (
            <Section title="Observed Symptoms" icon={AlertTriangle}>
              <ul className="space-y-2">
                {report.symptoms.map((s, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2.5 mt-1.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Organic Treatment */}
          {report.organic_treatment?.length > 0 && (
            <Section title="Organic Treatment" icon={Sprout} className="border-emerald-100">
              <ul className="space-y-2">
                {report.organic_treatment.map((t, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2.5 mt-1.5 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Chemical Treatment */}
          {report.chemical_treatment?.length > 0 && (
            <Section title="Chemical Treatment" icon={FlaskConical} className="border-blue-100">
              <div className="space-y-3">
                {report.chemical_treatment.map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                    <p className="text-sm font-semibold text-blue-900">{c.product}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-blue-400">Dosage</p>
                        <p className="text-xs text-blue-800 font-medium">{c.dosage}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-blue-400">Frequency</p>
                        <p className="text-xs text-blue-800 font-medium">{c.frequency}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Prevention */}
          {report.prevention_tips?.length > 0 && (
            <Section title="Prevention Tips" icon={Shield}>
              <ul className="space-y-2">
                {report.prevention_tips.map((t, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2.5 mt-1.5 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Urgency Warning */}
          {report.urgency_days <= 3 && (
            <div className="flex items-start space-x-3 p-4 rounded-xl border border-red-200 bg-red-50">
              <Clock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">⚠️ Urgent Action Required</p>
                <p className="text-sm text-red-700 mt-0.5">
                  Treat within <strong>{report.urgency_days} day{report.urgency_days !== 1 ? 's' : ''}</strong> to prevent further damage. Untreated, this may cause up to <strong>{report.estimated_yield_loss_pct_if_untreated}% yield loss</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-slate-500">
            <TrendingDown className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>Detailed report data is unavailable for this entry.</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Link href="/diagnose" className="flex-1">
          <button className="w-full h-11 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            New Diagnosis
          </button>
        </Link>
        <Link href="/diagnose/history" className="flex-1">
          <button className="w-full h-11 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
            View History
          </button>
        </Link>
      </div>
    </div>
  )
}
