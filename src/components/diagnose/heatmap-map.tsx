'use client'

import dynamic from 'next/dynamic'

export const HeatmapMap = dynamic(() => import('./heatmap-map-inner'), {
  ssr: false,
  loading: () => <div className="h-[520px] bg-slate-100 rounded-lg animate-pulse" />,
})
