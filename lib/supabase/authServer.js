// Server-side helpers for authenticating admins via Bearer token and
// for computing a deterministic (never client-visible) derived password
// used by the Roll+DOB student login.
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './admin'

export function anonServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

export async function requireAdmin(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { user: null, error: 'Missing authorization' }
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return { user: null, error: 'Invalid session' }
  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (prof?.role !== 'admin') return { user: null, error: 'Admin access required' }
  return { user: data.user }
}

// Deterministic password derived from roll + dob. Never exposed to client.
// Bcrypt-hashed by Supabase Auth on user creation.
export function derivePassword(roll, dob) {
  const clean = String(roll || '').trim().toUpperCase()
  const d = String(dob || '').trim()
  return `SFP:${clean}:${d}:v1`
}

export function normalizeDob(input) {
  if (!input) return null
  const s = String(input).trim()
  // Accept YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, Excel date serial handled by caller
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/
  const dmy1 = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  let m
  if ((m = s.match(iso))) return `${m[1]}-${m[2]}-${m[3]}`
  if ((m = s.match(dmy1))) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  return null
}
