'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Check, PlayCircle, Loader2, Database, UserPlus } from 'lucide-react'

const SQL_URL = '/api/setup/sql'

export default function SetupPage() {
  const [sql, setSql] = useState('')
  const [copied, setCopied] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [result, setResult] = useState(null)

  async function loadSql() {
    const r = await fetch(SQL_URL)
    const t = await r.text()
    setSql(t)
  }

  async function copySql() {
    if (!sql) { await loadSql() }
    const t = sql || (await (await fetch(SQL_URL)).text())
    await navigator.clipboard.writeText(t)
    setCopied(true); toast.success('SQL copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  async function seed() {
    setSeeding(true); setResult(null)
    try {
      const r = await fetch('/api/setup/seed', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      setResult(j)
      toast.success('Demo data seeded successfully')
    } catch (e) { toast.error(e.message) }
    finally { setSeeding(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-[#0b2b6b] mb-4"><ArrowLeft className="h-4 w-4"/> Back to Home</Link>
        <h1 className="text-2xl font-bold text-slate-900">First-time Setup</h1>
        <p className="text-slate-600 mt-1 text-sm">Run these two steps once to prepare your Supabase project.</p>

        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#0b2b6b] grid place-items-center"><Database className="h-5 w-5"/></div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900">Step 1 — Run the SQL schema</h2>
              <p className="text-sm text-slate-600 mt-1">Open <a className="text-[#0b2b6b] underline" target="_blank" href="https://supabase.com/dashboard/project/_/sql/new">Supabase SQL Editor</a>, paste this SQL, and click <b>Run</b>.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={copySql} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358]">
                  {copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>} Copy SQL
                </button>
                <a href={SQL_URL} target="_blank" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">View SQL</a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#0b2b6b] grid place-items-center"><UserPlus className="h-5 w-5"/></div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900">Step 2 — Seed demo accounts &amp; data</h2>
              <p className="text-sm text-slate-600 mt-1">Creates a demo student (Monisha A, 23IT042) and an admin, plus sample transactions.</p>
              <button disabled={seeding} onClick={seed} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358] disabled:opacity-60">
                {seeding ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlayCircle className="h-4 w-4"/>} Seed Demo Data
              </button>
              {result && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                  <div className="font-medium text-emerald-800">✓ Setup complete!</div>
                  <div className="mt-2 grid gap-1 text-emerald-900">
                    <div><b>Student:</b> student@college.edu / Student@123</div>
                    <div><b>Admin:</b> admin@college.edu / Admin@123</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link href="/student-login" className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-50">Go to Student Login</Link>
          <Link href="/admin-login" className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-50">Go to Admin Login</Link>
        </div>
      </div>
    </div>
  )
}
