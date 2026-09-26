'use client'
import { supabaseBrowser } from './browser'

export async function apiFetch(url, opts = {}) {
  const { data: { session } } = await supabaseBrowser().auth.getSession()
  const headers = { ...(opts.headers || {}), Authorization: session ? `Bearer ${session.access_token}` : '' }
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, { ...opts, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}
