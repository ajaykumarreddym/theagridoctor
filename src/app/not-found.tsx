import Link from 'next/link'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Compass className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">404</h1>
        <p className="text-sm text-slate-600 mb-6">
          We couldn&apos;t find the page you&apos;re looking for. It may have been moved or doesn&apos;t exist.
        </p>
        <Link href="/">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Home className="w-4 h-4 mr-1.5" /> Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
