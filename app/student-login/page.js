'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { toast } from 'sonner'
import { GraduationCap, ArrowLeft, Loader2 } from 'lucide-react'

export default function StudentLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const sb = supabaseBrowser()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setLoading(false); toast.error(error.message); return }
    // Verify student role
    const { data: prof } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
    if (prof?.role !== 'student') {
      await sb.auth.signOut()
      setLoading(false)
      toast.error('This account is not a student account.')
      return
    }
    toast.success('Login successful')
    router.push('/student/dashboard')
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
              <p className="text-xs text-slate-500">Government College, Chennai</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none text-sm" placeholder="you@college.edu"/>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none text-sm" placeholder="••••••••"/>
            </div>
            <button disabled={loading} className="w-full h-11 rounded-lg bg-[#0b2b6b] hover:bg-[#0a2358] text-white font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin"/>} Sign in
            </button>
          </form>
          <div className="mt-6 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="font-medium text-slate-700 mb-1">Demo credentials</div>
            student@college.edu / Student@123
          </div>
        </div>
      </div>
    </div>
  )
}
