'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/supabase/apiFetch'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'

export default function AddStudent() {
  const [depts, setDepts] = useState([]); const [years, setYears] = useState([]); const [schols, setSchols] = useState([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ full_name: '', register_number: '', dob: '', email: '', department: '', year: '', scholarship_id: '', total_fee: '', phone: '', address: '' })

  useEffect(() => { (async () => {
    const sb = supabaseBrowser()
    const [{ data: d }, { data: y }, { data: s }] = await Promise.all([
      sb.from('departments').select('*').order('name'),
      sb.from('academic_years').select('*').order('name'),
      sb.from('scholarships').select('*').order('name'),
    ])
    setDepts(d || []); setYears(y || []); setSchols(s || [])
  })() }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await apiFetch('/api/admin/students', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Student created. They can login with Roll + DOB.')
      setForm({ full_name: '', register_number: '', dob: '', email: '', department: '', year: '', scholarship_id: '', total_fee: '', phone: '', address: '' })
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const inp = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none bg-white'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Link href="/admin/students" className="text-sm text-slate-600 hover:text-[#0b2b6b] inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4"/> Students</Link></div>
      </div>
      <div><h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><UserPlus className="h-6 w-6 text-[#0b2b6b]"/> Add Student</h1><p className="text-sm text-slate-500">Create a new student. A login (Roll + DOB) is created automatically.</p></div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 grid md:grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-slate-700">Student Name *</label><input required value={form.full_name} onChange={e=>set('full_name', e.target.value)} className={inp+' mt-1'}/></div>
        <div><label className="text-sm font-medium text-slate-700">Roll / Registration Number *</label><input required value={form.register_number} onChange={e=>set('register_number', e.target.value)} className={inp+' mt-1'} placeholder="e.g. 23IT042"/></div>
        <div><label className="text-sm font-medium text-slate-700">Date of Birth *</label><input required type="date" value={form.dob} onChange={e=>set('dob', e.target.value)} className={inp+' mt-1'}/></div>
        <div><label className="text-sm font-medium text-slate-700">Email *</label><input required type="email" value={form.email} onChange={e=>set('email', e.target.value)} className={inp+' mt-1'}/></div>
        <div><label className="text-sm font-medium text-slate-700">Department *</label><select required value={form.department} onChange={e=>set('department', e.target.value)} className={inp+' mt-1'}><option value="">Select department</option>{depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
        <div><label className="text-sm font-medium text-slate-700">Academic Year *</label><select required value={form.year} onChange={e=>set('year', e.target.value)} className={inp+' mt-1'}><option value="">Select year</option>{years.map(y=><option key={y.id} value={y.name}>{y.name}</option>)}</select></div>
        <div><label className="text-sm font-medium text-slate-700">Scholarship *</label><select required value={form.scholarship_id} onChange={e=>set('scholarship_id', e.target.value)} className={inp+' mt-1'}><option value="">Select scholarship</option>{schols.filter(s=>s.active !== false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className="text-sm font-medium text-slate-700">Total College Fee (₹) *</label><input required type="number" min="0" value={form.total_fee} onChange={e=>set('total_fee', e.target.value)} className={inp+' mt-1'}/></div>
        <div><label className="text-sm font-medium text-slate-700">Phone (optional)</label><input value={form.phone} onChange={e=>set('phone', e.target.value)} className={inp+' mt-1'}/></div>
        <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700">Address (optional)</label><textarea value={form.address} onChange={e=>set('address', e.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 text-sm" rows={2}/></div>
        <div className="md:col-span-2 flex gap-3">
          <button disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserPlus className="h-4 w-4"/>} Create Student</button>
          <Link href="/admin/students" className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
