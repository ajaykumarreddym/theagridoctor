import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Activity, Sprout, Cloud, AlertTriangle, ArrowRight, Trees, BarChart3,
  MessageCircle, Users as UsersIcon, Leaf, Satellite, Radar, Bell,
  CalendarClock, CheckCircle2,
} from 'lucide-react'
import { computeAlerts, alertToneClasses, type MonitorSnapshot } from '@/lib/alerts'
import { WeatherRadar } from '@/components/farm/weather-radar'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { user, supabase } = await requireUser()

  const [
    { count: farmCount },
    { data: crops },
    { data: diagnoses },
    { count: sessionCount },
    { data: profile },
    { data: monitoredFarms },
  ] = await Promise.all([
    supabase.from('farms').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('crop_cycles')
      .select('id,status,growth_stage,farm_id,farms!inner(user_id)')
      .eq('farms.user_id', user.id),
    supabase
      .from('diagnoses')
      .select('id,disease_name,severity,status,crop_type,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('chat_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('users').select('full_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('farms')
      .select('id,name,lat,lng,last_scan_at,polygon_area_ha,latest_monitor_snapshot')
      .eq('user_id', user.id)
      .not('agro_polygon_id', 'is', null)
      .order('last_scan_at', { ascending: false }),
  ])

  // Pick any farm with coords as fallback radar centre (first monitored farm, else any farm with lat/lng)
  const { data: anyFarmWithCoords } = (monitoredFarms && monitoredFarms.length > 0)
    ? { data: null }
    : await supabase
        .from('farms')
        .select('id,name,lat,lng')
        .eq('user_id', user.id)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(1)
        .maybeSingle()
        .then((r) => ({ data: r.data ? [r.data] : null }))

  const radarTarget =
    monitoredFarms?.find((f) => typeof f.lat === 'number' && typeof f.lng === 'number')
      ?? anyFarmWithCoords?.[0]
      ?? null

  const activeCrops = (crops ?? []).filter((c) => c.status === 'active').length
  const openIssues = (diagnoses ?? []).filter(
    (d) => d.status === 'open' && (d.severity === 'high' || d.severity === 'critical')
  ).length

  const healthScore = (() => {
    const total = diagnoses?.length ?? 0
    if (total === 0) return activeCrops > 0 ? 100 : null
    const criticalWeight = (diagnoses ?? []).reduce((acc, d) => {
      if (d.status === 'resolved') return acc
      switch (d.severity) {
        case 'critical': return acc + 25
        case 'high': return acc + 15
        case 'medium': return acc + 8
        case 'low': return acc + 3
        default: return acc
      }
    }, 0)
    return Math.max(10, 100 - criticalWeight)
  })()

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Farmer'

  // — Per-farm field health (only farms with Agro monitoring enabled)
  type MonitoredFarm = {
    id: string
    name: string
    last_scan_at: string | null
    polygon_area_ha: number | null
    latest_monitor_snapshot: MonitorSnapshot
  }
  const fieldHealth = (monitoredFarms ?? []).map((f) => {
    const farm = f as unknown as MonitoredFarm
    const alerts = computeAlerts(farm.latest_monitor_snapshot)
    const critical = alerts.filter((a) => a.level === 'critical').length
    const warning = alerts.filter((a) => a.level === 'warning').length
    const snap = farm.latest_monitor_snapshot
    const ndvi = snap?.ndvi?.mean ?? null
    const moisture = snap?.soil?.moisture ?? null
    const tempK = snap?.weather?.main?.temp ?? null
    return {
      id: farm.id,
      name: farm.name,
      last_scan_at: farm.last_scan_at,
      area_ha: farm.polygon_area_ha,
      ndvi,
      moisture,
      tempC: typeof tempK === 'number' ? tempK - 273.15 : null,
      critical,
      warning,
    }
  })
  const totalCritical = fieldHealth.reduce((s, f) => s + f.critical, 0)
  const totalWarning = fieldHealth.reduce((s, f) => s + f.warning, 0)

  // Upcoming pending tasks across all user's crops (next 14 days)
  const in14d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const { data: upcomingTasks } = await supabase
    .from('crop_tasks')
    .select('id,task_name,category,priority,due_date,crop_cycle_id,crop_cycles!inner(crop_name,farm_id,farms!inner(user_id,name))')
    .eq('status', 'pending')
    .eq('crop_cycles.farms.user_id', user.id)
    .lte('due_date', in14d)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(6)

  type UpcomingTask = {
    id: string
    task_name: string
    category: string | null
    priority: string | null
    due_date: string | null
    crop_cycles: { crop_name: string; farms: { name: string } }
  }
  const tasks = (upcomingTasks ?? []) as unknown as UpcomingTask[]

  const today = new Date()
  const greeting = (() => {
    const h = today.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const tiles = [
    {
      label: 'Farm Health',
      value: healthScore !== null ? `${healthScore}%` : '—',
      sub: openIssues > 0 ? `${openIssues} urgent issue(s)` : 'No urgent issues',
      icon: Activity,
      tint: 'emerald',
    },
    {
      label: 'Active Crops',
      value: activeCrops.toString(),
      sub: `${farmCount ?? 0} farm(s)`,
      icon: Sprout,
      tint: 'green',
    },
    {
      label: 'Diagnoses',
      value: (diagnoses?.length ?? 0).toString(),
      sub: `${openIssues} open`,
      icon: AlertTriangle,
      tint: openIssues > 0 ? 'red' : 'slate',
    },
    {
      label: 'AI Chats',
      value: (sessionCount ?? 0).toString(),
      sub: 'Conversations',
      icon: MessageCircle,
      tint: 'blue',
    },
  ]

  const tintClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-500',
    blue: 'bg-blue-50 text-blue-600',
  }
  void tintClasses // retained for potential downstream use

  const quickLinks = [
    { href: '/diagnose', label: 'New Diagnosis', icon: Sprout },
    { href: '/advisor', label: 'Ask AI Advisor', icon: MessageCircle },
    { href: '/farms/new', label: 'Add Farm', icon: Trees },
    { href: '/weather', label: 'Weather', icon: Cloud },
    { href: '/market', label: 'Market Prices', icon: BarChart3 },
    { href: '/alerts', label: 'Alerts', icon: Bell },
    { href: '/community', label: 'Community', icon: UsersIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg">
        {/* Decorative radial dots */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-emerald-100/90 font-medium">{dateLabel}</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1 tracking-tight">
              {greeting}, {displayName}
            </h1>
            <p className="text-emerald-50/90 mt-1 text-sm md:text-base max-w-xl">
              {openIssues > 0
                ? `You have ${openIssues} urgent issue${openIssues > 1 ? 's' : ''} needing attention.`
                : totalCritical > 0
                ? `${totalCritical} field alert${totalCritical > 1 ? 's' : ''} flagged by satellite monitoring.`
                : tasks.length > 0
                ? `${tasks.length} task${tasks.length > 1 ? 's' : ''} queued for the next 14 days.`
                : 'Everything looks healthy across your farms today.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/diagnose"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white text-emerald-700 font-medium text-sm hover:bg-emerald-50 transition-colors shadow-sm"
            >
              <Sprout className="w-4 h-4" /> New diagnosis
            </Link>
            <Link
              href="/advisor"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/60 backdrop-blur border border-white/20 font-medium text-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Ask AI
            </Link>
          </div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {tiles.map((t) => {
          const tints: Record<string, { bg: string; ring: string; fg: string; accent: string }> = {
            emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-100', fg: 'text-emerald-700', accent: 'bg-emerald-500' },
            green:   { bg: 'bg-green-50',   ring: 'ring-green-100',   fg: 'text-green-700',   accent: 'bg-green-500' },
            red:     { bg: 'bg-rose-50',    ring: 'ring-rose-100',    fg: 'text-rose-700',    accent: 'bg-rose-500' },
            slate:   { bg: 'bg-slate-50',   ring: 'ring-slate-100',   fg: 'text-slate-600',   accent: 'bg-slate-400' },
            blue:    { bg: 'bg-sky-50',     ring: 'ring-sky-100',     fg: 'text-sky-700',     accent: 'bg-sky-500' },
          }
          const style = tints[t.tint] ?? tints.slate
          return (
            <Card key={t.label} className={`relative overflow-hidden ring-1 ${style.ring} hover:shadow-md transition-shadow`}>
              <div className={`absolute top-0 right-0 w-24 h-24 ${style.bg} rounded-full -translate-y-8 translate-x-8 opacity-60`} />
              <CardContent className="relative p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.label}</p>
                  <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center`}>
                    <t.icon className={`w-5 h-5 ${style.fg}`} />
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">{t.value}</p>
                <p className="text-[11px] text-slate-400 mt-1">{t.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick actions + Upcoming tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Jump straight into the tools you use most</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {quickLinks.map((q, i) => {
                const tints = [
                  'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                  'bg-sky-50 text-sky-700 hover:bg-sky-100',
                  'bg-amber-50 text-amber-700 hover:bg-amber-100',
                  'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                  'bg-rose-50 text-rose-700 hover:bg-rose-100',
                  'bg-orange-50 text-orange-700 hover:bg-orange-100',
                  'bg-purple-50 text-purple-700 hover:bg-purple-100',
                ]
                const tint = tints[i % tints.length]
                return (
                  <Link
                    key={q.href}
                    href={q.href}
                    className="group flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-colors ${tint}`}>
                      <q.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">{q.label}</span>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming tasks */}
        <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-emerald-600" />
                Upcoming tasks
              </CardTitle>
              <CardDescription>Next 14 days</CardDescription>
            </div>
            {tasks.length > 0 && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {tasks.length}
              </span>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {tasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-xs">No tasks due soon</p>
                <p className="text-[10px] text-slate-400 mt-1">Generate tasks from a farm page</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {tasks.slice(0, 5).map((t) => {
                  const daysLabel = (() => {
                    if (!t.due_date) return null
                    const ms = new Date(t.due_date).getTime() - Date.now()
                    const d = Math.ceil(ms / 86400000)
                    if (d < 0) return { label: `${Math.abs(d)}d late`, tone: 'text-rose-600 bg-rose-50' }
                    if (d === 0) return { label: 'today', tone: 'text-amber-600 bg-amber-50' }
                    if (d === 1) return { label: 'tmrw', tone: 'text-amber-600 bg-amber-50' }
                    if (d <= 3) return { label: `${d}d`, tone: 'text-emerald-700 bg-emerald-50' }
                    return { label: `${d}d`, tone: 'text-slate-600 bg-slate-100' }
                  })()
                  const prio = (t.priority ?? '').toLowerCase()
                  const prioDot = prio === 'high' ? 'bg-rose-500' : prio === 'low' ? 'bg-slate-300' : 'bg-amber-400'
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prioDot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate">{t.task_name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {t.crop_cycles?.crop_name} · {t.crop_cycles?.farms?.name}
                        </p>
                      </div>
                      {daysLabel && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${daysLabel.tone}`}>
                          {daysLabel.label}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* (old quick actions block removed) */}

      {/* Field Health — satellite-monitored farms (full width) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-600" />
              Field Health
            </CardTitle>
            <CardDescription>
              {fieldHealth.length === 0
                ? 'Enable satellite monitoring on any farm to see live NDVI, soil and weather here.'
                : `${fieldHealth.length} field${fieldHealth.length === 1 ? '' : 's'} monitored · `
                  + `${totalCritical} critical, ${totalWarning} warning`}
            </CardDescription>
          </div>
          {fieldHealth.length === 0 && (
            <Link
              href="/farms"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center"
            >
              Enable <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          )}
        </CardHeader>
        {fieldHealth.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {fieldHealth.map((f) => {
                const mostSevere: 'critical' | 'warning' | 'info' =
                  f.critical > 0 ? 'critical' : f.warning > 0 ? 'warning' : 'info'
                const tone = alertToneClasses(mostSevere)
                const ndviDisplay = f.ndvi !== null ? f.ndvi.toFixed(2) : '—'
                const ndviColorClass =
                  f.ndvi === null ? 'text-slate-400'
                    : f.ndvi >= 0.6 ? 'text-emerald-600'
                    : f.ndvi >= 0.4 ? 'text-lime-600'
                    : f.ndvi >= 0.2 ? 'text-amber-600'
                    : 'text-red-600'
                const scanAgo = (() => {
                  if (!f.last_scan_at) return 'never'
                  const mins = Math.floor((Date.now() - new Date(f.last_scan_at).getTime()) / 60000)
                  if (mins < 1) return 'just now'
                  if (mins < 60) return `${mins}m ago`
                  const hrs = Math.floor(mins / 60)
                  if (hrs < 24) return `${hrs}h ago`
                  return `${Math.floor(hrs / 24)}d ago`
                })()
                return (
                  <Link
                    key={f.id}
                    href={`/farms/${f.id}`}
                    className="block rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {f.area_ha ? `${f.area_ha.toFixed(2)} ha · ` : ''}scanned {scanAgo}
                        </p>
                      </div>
                      {(f.critical > 0 || f.warning > 0) && (
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${tone.chip}`}>
                          {f.critical > 0 ? `${f.critical} critical` : `${f.warning} warn`}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">NDVI</div>
                        <div className={`font-bold text-base ${ndviColorClass}`}>{ndviDisplay}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Soil moist.</div>
                        <div className="font-bold text-base text-slate-700">
                          {f.moisture !== null ? `${(f.moisture * 100).toFixed(0)}%` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Temp</div>
                        <div className="font-bold text-base text-slate-700">
                          {f.tempC !== null ? `${f.tempC.toFixed(1)}°C` : '—'}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* placeholder for downstream replacement */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Diagnoses */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Diagnoses</CardTitle>
              <CardDescription>Last 5 crop health checks</CardDescription>
            </div>
            <Link
              href="/diagnose/history"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center"
            >
              View all
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {(!diagnoses || diagnoses.length === 0) ? (
              <div className="text-center py-8 text-slate-400">
                <Leaf className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm">No diagnoses yet</p>
                <Link
                  href="/diagnose"
                  className="inline-flex mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Run your first diagnosis →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {diagnoses.map((d) => (
                  <Link
                    key={d.id}
                    href={`/diagnose/${d.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        d.severity === 'critical' || d.severity === 'high' ? 'bg-red-50' : 'bg-emerald-50'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 ${
                          d.severity === 'critical' || d.severity === 'high' ? 'text-red-500' : 'text-emerald-500'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {d.disease_name || 'Unknown condition'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {d.crop_type} · {new Date(d.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                        d.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : d.severity === 'high'
                          ? 'bg-orange-100 text-orange-700'
                          : d.severity === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {d.severity || 'n/a'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Farm overview */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Your Farms</CardTitle>
              <CardDescription>{farmCount ?? 0} registered · {activeCrops} active crops</CardDescription>
            </div>
            <Link
              href="/farms"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center"
            >
              Manage
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {!farmCount || farmCount === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Trees className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm">No farms yet</p>
                <Link
                  href="/farms/new"
                  className="inline-flex mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Add your first farm →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-50">
                    <p className="text-xs text-emerald-700 font-medium">Farms</p>
                    <p className="text-2xl font-bold text-emerald-800">{farmCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50">
                    <p className="text-xs text-green-700 font-medium">Active Crops</p>
                    <p className="text-2xl font-bold text-green-800">{activeCrops}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50">
                    <p className="text-xs text-amber-700 font-medium">Harvested</p>
                    <p className="text-2xl font-bold text-amber-800">
                      {(crops ?? []).filter((c) => c.status === 'harvested').length}
                    </p>
                  </div>
                </div>
                <Link
                  href="/farms"
                  className="block text-center text-sm font-medium text-emerald-600 hover:text-emerald-700 mt-3"
                >
                  Open Farm Management →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Radar — full width at bottom for max visibility */}
      <Card className="border-sky-100">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Radar className="w-4 h-4 text-sky-600" />
              Live Radar
              {radarTarget && (
                <span className="text-xs font-normal text-slate-500 truncate">· {radarTarget.name}</span>
              )}
            </CardTitle>
            <CardDescription>
              {radarTarget
                ? 'Real-time precipitation with 2h playback, current conditions readout, and severity layers.'
                : 'Add a farm with GPS coordinates to see the live weather radar here.'}
            </CardDescription>
          </div>
          {radarTarget && (
            <Link
              href={`/farms/${radarTarget.id}`}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center"
            >
              Open farm <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {radarTarget && typeof radarTarget.lat === 'number' && typeof radarTarget.lng === 'number' ? (
            <WeatherRadar
              lat={radarTarget.lat}
              lng={radarTarget.lng}
              height={420}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-slate-400 text-sm">
              <Radar className="w-10 h-10 mb-2 text-slate-200" />
              <p>No farm location yet</p>
              <Link href="/farms/new" className="mt-3 text-xs text-emerald-600 font-medium hover:text-emerald-700">
                Add a farm →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
