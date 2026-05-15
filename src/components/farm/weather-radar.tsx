'use client'

import dynamic from 'next/dynamic'

// Leaflet must only run client-side
export const WeatherRadar = dynamic(() => import('./weather-radar-inner'), {
  ssr: false,
  loading: () => <div className="h-[380px] bg-slate-100 rounded-lg animate-pulse" />,
})
