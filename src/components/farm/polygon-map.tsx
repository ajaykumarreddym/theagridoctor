'use client'

import dynamic from 'next/dynamic'

// Leaflet must only run client-side
export const PolygonMap = dynamic(() => import('./polygon-map-inner'), {
  ssr: false,
  loading: () => <div className="h-[460px] bg-slate-100 rounded-lg animate-pulse" />,
})
