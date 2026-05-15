'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-600">
          We hit an unexpected error while loading this page. You can try again or head back to the dashboard.
        </p>
        {error.message && (
          <pre className="mt-4 text-[11px] text-left text-rose-700 bg-rose-50 border border-rose-100 rounded p-2 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button onClick={() => reset()} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Try again
          </Button>
          <Link href="/">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-1.5" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
