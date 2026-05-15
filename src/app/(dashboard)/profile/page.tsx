'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, User, MapPin, Phone, Languages, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Puducherry', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh',
]

const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Malayalam']

type Profile = {
  full_name: string | null
  phone: string | null
  state: string | null
  district: string | null
  preferred_language: string | null
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState<Profile>({
    full_name: '',
    phone: '',
    state: '',
    district: '',
    preferred_language: 'English',
  })
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setForm((f) => ({ ...f, ...d.profile }))
        if (d.email) setEmail(d.email)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      setMessage({ type: 'ok', text: 'Profile updated successfully.' })
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
        <p className="text-sm">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Profile &amp; Settings</h1>
        <p className="text-slate-500 mt-1">Keep your details up to date so the AI advisor gives localized advice.</p>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-red-50 border-red-100 text-red-700'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5" />
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={save}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Personal Details
            </CardTitle>
            <CardDescription>Signed in as {email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={form.full_name ?? ''}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your name"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone (optional)
              </Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91…"
                maxLength={20}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state" className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> State
                </Label>
                <select
                  id="state"
                  value={form.state ?? ''}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  value={form.district ?? ''}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  placeholder="e.g. Ranga Reddy"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lang" className="flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" /> Preferred Language
              </Label>
              <select
                id="lang"
                value={form.preferred_language ?? 'English'}
                onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">AI advisor will respond in this language when possible.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={signOut}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Sign Out
          </Button>
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
