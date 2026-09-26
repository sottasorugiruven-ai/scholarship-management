'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { toast } from 'sonner'
import { GraduationCap, ArrowLeft, Loader2 } from 'lucide-react'

export default function StudentLogin() {
  const router = useRouter()
  const [roll, setRoll] = useState('')
  const [dob, setDob] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-redirect if already logged in as student
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = supabaseBrowser()
      const { data: { session } } = await sb.auth.getSession()
      if (!session || cancelled) return
      const { data: prof } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (cancelled) return
      if (prof?.role === 'student') window.location.replace('/student/dashboard')
      else if (prof?.role === 'admin') window.location.replace('/admin/dashboard')
    })()
    return () => { cancelled = true }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    const sb = supabaseBrowser()
    try {
      // Clear any stale session so setSession below starts clean
      await sb.auth.signOut().catch(() => {})

      // 1. Exchange Roll + DOB for Supabase tokens on the server
      const res = await fetch('/api/auth/student-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll: roll.trim(), dob }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Login failed')
      console.log('[student-login] tokens received')

      // 2. Install session into the browser client (writes auth cookies + storage)
      const { data: setData, error: setErr } = await sb.auth.setSession({
        access_token: j.access_token, refresh_token: j.refresh_token,
      })
      if (setErr || !setData.session) throw new Error(setErr?.message || 'Could not establish session')
      console.log('[student-login] session installed for', setData.session.user.id)

      // 3. Verify session is really there (guards against race with cookie writes)
      const { data: { session: verify } } = await sb.auth.getSession()
      if (!verify) throw new Error('Session did not persist. Please try again.')
      console.log('[student-login] session verified')

      // 4. Verify profile + role
      const { data: prof, error: profErr } = await sb.from('profiles')
        .select('role, full_name, status').eq('id', verify.user.id).maybeSingle()
      if (profErr || !prof) {
        console.error('[student-login] profile lookup failed', profErr)
        throw new Error('Student account could not be verified. Please contact the administrator.')
      }
      if (prof.role !== 'student') {
        await sb.auth.signOut()
        throw new Error('This account is not a student account.')
      }
      if (prof.status === 'inactive') {
        await sb.auth.signOut()
        throw new Error('This account is inactive. Please contact the administrator.')
      }
      console.log('[student-login] role verified, redirecting')

      toast.success(`Welcome, ${prof.full_name || 'student'}`)

      // 5. Navigate. Try Next.js router first; hard-fallback if it stalls.
      router.replace('/student/dashboard')
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname !== '/student/dashboard') {
          window.location.replace('/student/dashboard')
        }
      }, 400)
    } catch (err) {
      console.error('[student-login] failed', err)
      toast.error(err.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-[#0b2b6b]"><ArrowLeft className="h-4 w-4"/> Back</Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-lg bg-[#0b2b6b] text-white grid place-items-center"><GraduationCap className="h-6 w-6"/></div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Student Login</h1>
              <p className="text-xs text-slate-500">Sign in with your Roll Number and Date of Birth</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Roll / Registration Number</label>
              <input required value={roll} onChange={e=>setRoll(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none text-sm" placeholder="e.g. 23IT042"/>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Date of Birth</label>
              <input type="date" required value={dob} onChange={e=>setDob(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none text-sm"/>
            </div>
            <button disabled={loading} className="w-full h-11 rounded-lg bg-[#0b2b6b] hover:bg-[#0a2358] text-white font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin"/>} {loading ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>
          <div className="mt-6 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="font-medium text-slate-700 mb-1">Demo credentials</div>
            Roll: <b>23IT042</b> &nbsp;&middot;&nbsp; DOB: <b>2005-06-15</b>
          </div>
        </div>
      </div>
    </div>
  )
}
