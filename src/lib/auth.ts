import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Server-side helper. Returns the authenticated Supabase user or redirects
 * to /login if no session exists.
 */
export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { user, supabase }
}

/**
 * Same but returns null instead of redirecting (for API routes where we want
 * to return a 401 JSON response).
 */
export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { user, supabase }
}
