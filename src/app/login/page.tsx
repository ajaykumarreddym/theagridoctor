'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Sprout, Mail, Lock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.replace(redirect)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            id="email"
            type="email"
            required
            placeholder="farmer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            id="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9"
            autoComplete="current-password"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Sign in
      </Button>

      <p className="text-sm text-center text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">
          Create one
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-800 tracking-tight">AgriDoctor</span>
        </div>

        <Card className="shadow-xl border-slate-100">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your AgriDoctor account</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
