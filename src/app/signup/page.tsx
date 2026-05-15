'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Sprout, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Some Supabase projects require email confirmation; session will be null.
    if (!data.session) {
      setNeedsConfirm(true)
      setLoading(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  if (needsConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Check your email</h2>
            <p className="text-slate-600 text-sm">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
            </p>
            <Link href="/login">
              <Button variant="outline" className="mt-4">Back to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

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
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Start getting AI-powered crop insights</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="name"
                    required
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                    autoComplete="name"
                  />
                </div>
              </div>
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
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    autoComplete="new-password"
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
                Create account
              </Button>

              <p className="text-sm text-center text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
