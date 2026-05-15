// Computes human-readable alerts from a monitor snapshot.
// Snapshot shape comes from /api/farms/[id]/monitor GET.

export type AlertLevel = 'critical' | 'warning' | 'info'

export type FieldAlert = {
  id: string
  level: AlertLevel
  title: string
  detail: string
  metric?: string
}

export type AlertPreferences = {
  temp_high?: { critical?: number; warning?: number }          // °C
  temp_low?: { critical?: number; warning?: number }           // °C
  soil_moisture_low?: { critical?: number; warning?: number }  // 0-1 volumetric
  soil_moisture_high?: { warning?: number }                    // 0-1 (waterlogging)
  soil_surface_hot?: { warning?: number }                      // °C
  uv?: { critical?: number; warning?: number }                 // index
  wind?: { critical?: number; warning?: number }               // m/s
  rain_48h?: { critical?: number; warning?: number }           // mm
  ndvi?: { critical?: number; warning?: number }               // index
}

export const DEFAULT_ALERT_PREFS: Required<{ [K in keyof AlertPreferences]: AlertPreferences[K] }> = {
  temp_high: { critical: 40, warning: 35 },
  temp_low: { critical: 2, warning: 5 },
  soil_moisture_low: { critical: 0.10, warning: 0.20 },
  soil_moisture_high: { warning: 0.45 },
  soil_surface_hot: { warning: 40 },
  uv: { critical: 11, warning: 8 },
  wind: { critical: 17, warning: 12 },
  rain_48h: { critical: 50, warning: 20 },
  ndvi: { critical: 0.2, warning: 0.4 },
}

function mergedPrefs(user?: AlertPreferences | null) {
  // deep-merge shallow: each key gets user override then default fallback
  const out = JSON.parse(JSON.stringify(DEFAULT_ALERT_PREFS)) as typeof DEFAULT_ALERT_PREFS
  if (!user) return out
  for (const k of Object.keys(out) as (keyof typeof out)[]) {
    const u = (user as Record<string, unknown>)[k] as Record<string, number> | undefined
    if (u && typeof u === 'object') {
      Object.assign(out[k] as Record<string, number>, u)
    }
  }
  return out
}

export type MonitorSnapshot = {
  scanned_at?: string
  weather?: {
    main?: { temp?: number; humidity?: number; pressure?: number }
    wind?: { speed?: number }
    rain?: { '1h'?: number; '3h'?: number }
  } | null
  forecast?: Array<{
    dt?: number
    main?: { temp?: number; humidity?: number }
    rain?: { '3h'?: number }
    weather?: Array<{ main?: string }>
  }> | null
  soil?: { moisture?: number; t0?: number; t10?: number } | null
  uvi?: { uvi?: number } | null
  ndvi?: { dt?: number; mean?: number; min?: number; max?: number; ndvi_url?: string; true_url?: string } | null
  accumulated_rain?: { count?: number } | null
} | null | undefined

function k2c(k?: number) {
  return typeof k === 'number' ? k - 273.15 : undefined
}

export function computeAlerts(snap: MonitorSnapshot, prefs?: AlertPreferences | null): FieldAlert[] {
  if (!snap) return []
  const p = mergedPrefs(prefs)
  const alerts: FieldAlert[] = []

  // — Temperature (current)
  const tempC = k2c(snap.weather?.main?.temp)
  if (typeof tempC === 'number') {
    if (tempC >= (p.temp_high?.critical ?? 40)) {
      alerts.push({
        id: 'heat-critical',
        level: 'critical',
        title: 'Extreme heat',
        detail: `Air temperature is ${tempC.toFixed(1)}°C. Risk of heat stress — increase irrigation and shade susceptible crops.`,
        metric: `${tempC.toFixed(1)}°C`,
      })
    } else if (tempC >= (p.temp_high?.warning ?? 35)) {
      alerts.push({
        id: 'heat-warning',
        level: 'warning',
        title: 'High temperature',
        detail: `Air temperature is ${tempC.toFixed(1)}°C. Monitor soil moisture closely.`,
        metric: `${tempC.toFixed(1)}°C`,
      })
    } else if (tempC <= (p.temp_low?.critical ?? 2)) {
      alerts.push({
        id: 'frost-critical',
        level: 'critical',
        title: 'Frost risk',
        detail: `Air temperature is ${tempC.toFixed(1)}°C — frost damage likely. Cover sensitive crops.`,
        metric: `${tempC.toFixed(1)}°C`,
      })
    } else if (tempC <= (p.temp_low?.warning ?? 5)) {
      alerts.push({
        id: 'cold-warning',
        level: 'warning',
        title: 'Low temperature',
        detail: `Air temperature is ${tempC.toFixed(1)}°C. Watch for cold stress.`,
        metric: `${tempC.toFixed(1)}°C`,
      })
    }
  }

  // — Soil moisture (0-1 volumetric)
  const moisture = snap.soil?.moisture
  if (typeof moisture === 'number') {
    if (moisture < (p.soil_moisture_low?.critical ?? 0.1)) {
      alerts.push({
        id: 'soil-dry-critical',
        level: 'critical',
        title: 'Soil very dry',
        detail: `Soil moisture is ${(moisture * 100).toFixed(0)}%. Immediate irrigation recommended.`,
        metric: `${(moisture * 100).toFixed(0)}%`,
      })
    } else if (moisture < (p.soil_moisture_low?.warning ?? 0.2)) {
      alerts.push({
        id: 'soil-dry-warning',
        level: 'warning',
        title: 'Low soil moisture',
        detail: `Soil moisture is ${(moisture * 100).toFixed(0)}%. Consider irrigating within 24h.`,
        metric: `${(moisture * 100).toFixed(0)}%`,
      })
    } else if (moisture > (p.soil_moisture_high?.warning ?? 0.45)) {
      alerts.push({
        id: 'soil-saturated',
        level: 'warning',
        title: 'Soil saturation',
        detail: `Soil moisture is ${(moisture * 100).toFixed(0)}%. Risk of waterlogging / root disease.`,
        metric: `${(moisture * 100).toFixed(0)}%`,
      })
    }
  }

  // — Soil temperature (surface)
  const t0 = k2c(snap.soil?.t0)
  if (typeof t0 === 'number' && t0 >= (p.soil_surface_hot?.warning ?? 40)) {
    alerts.push({
      id: 'soil-hot',
      level: 'warning',
      title: 'Hot topsoil',
      detail: `Surface soil temp is ${t0.toFixed(1)}°C. Mulch or water to protect root zone.`,
      metric: `${t0.toFixed(1)}°C`,
    })
  }

  // — UV index
  const uv = snap.uvi?.uvi
  if (typeof uv === 'number') {
    if (uv >= (p.uv?.critical ?? 11)) {
      alerts.push({
        id: 'uv-critical',
        level: 'critical',
        title: 'Extreme UV',
        detail: `UV index is ${uv.toFixed(1)}. Avoid fieldwork 10am–4pm; protect workers.`,
        metric: uv.toFixed(1),
      })
    } else if (uv >= (p.uv?.warning ?? 8)) {
      alerts.push({
        id: 'uv-warning',
        level: 'warning',
        title: 'Very high UV',
        detail: `UV index is ${uv.toFixed(1)}. Use sun protection.`,
        metric: uv.toFixed(1),
      })
    }
  }

  // — Wind
  const wind = snap.weather?.wind?.speed
  if (typeof wind === 'number') {
    if (wind >= (p.wind?.critical ?? 17)) {
      alerts.push({
        id: 'wind-critical',
        level: 'critical',
        title: 'Very strong wind',
        detail: `Wind speed ${wind.toFixed(1)} m/s. Avoid spraying; secure tall crops.`,
        metric: `${wind.toFixed(1)} m/s`,
      })
    } else if (wind >= (p.wind?.warning ?? 12)) {
      alerts.push({
        id: 'wind-warning',
        level: 'warning',
        title: 'Strong wind',
        detail: `Wind speed ${wind.toFixed(1)} m/s. Delay spraying; secure young plants.`,
        metric: `${wind.toFixed(1)} m/s`,
      })
    }
  }

  // — Rain (forecast next ~2 days, sum of 3h buckets)
  const rainForecast = (snap.forecast ?? []).reduce((s, f) => s + (f.rain?.['3h'] ?? 0), 0)
  if (rainForecast >= (p.rain_48h?.critical ?? 50)) {
    alerts.push({
      id: 'rain-heavy',
      level: 'critical',
      title: 'Heavy rain forecast',
      detail: `Forecast rainfall ~${rainForecast.toFixed(0)} mm over next 48h. Prepare drainage; delay fertiliser application.`,
      metric: `${rainForecast.toFixed(0)} mm`,
    })
  } else if (rainForecast >= (p.rain_48h?.warning ?? 20)) {
    alerts.push({
      id: 'rain-moderate',
      level: 'warning',
      title: 'Significant rain forecast',
      detail: `~${rainForecast.toFixed(0)} mm expected in next 48h.`,
      metric: `${rainForecast.toFixed(0)} mm`,
    })
  }

  // — NDVI vegetation health
  const ndvi = snap.ndvi?.mean
  if (typeof ndvi === 'number') {
    if (ndvi < (p.ndvi?.critical ?? 0.2)) {
      alerts.push({
        id: 'ndvi-poor',
        level: 'critical',
        title: 'Very low vegetation index',
        detail: `Mean NDVI ${ndvi.toFixed(2)} — vegetation sparse / stressed / bare. Inspect the field.`,
        metric: ndvi.toFixed(2),
      })
    } else if (ndvi < (p.ndvi?.warning ?? 0.4)) {
      alerts.push({
        id: 'ndvi-warn',
        level: 'warning',
        title: 'Below-average vegetation',
        detail: `Mean NDVI ${ndvi.toFixed(2)} — canopy below healthy range for most crops.`,
        metric: ndvi.toFixed(2),
      })
    }
  }

  return alerts
}

export function alertToneClasses(level: AlertLevel) {
  switch (level) {
    case 'critical':
      return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', chip: 'bg-rose-100 text-rose-700' }
    case 'warning':
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', chip: 'bg-amber-100 text-amber-700' }
    default:
      return { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', chip: 'bg-sky-100 text-sky-700' }
  }
}
