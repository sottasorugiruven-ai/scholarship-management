'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { apiFetch } from '@/lib/supabase/apiFetch'
import { inr } from '@/lib/format'
import { toast } from 'sonner'
import { Search, Users, Plus, Upload, Settings2, Edit, Trash2, Power, X, Save, Loader2 } from 'lucide-react'

export default function AdminStudents() {
  const sb = supabaseBrowser()
  const [rows, setRows] = useState([])
  const [depts, setDepts] = useState([]); const [years, setYears] = useState([]); const [schols, setSchols] = useState([])
  const [q, setQ] = useState(''); const [dept, setDept] = useState(''); const [yr, setYr] = useState(''); const [scholId, setScholId] = useState(''); const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const [{ data: profs }, { data: fees }, { data: pays }, { data: d }, { data: y }, { data: s }] = await Promise.all([
      sb.from('profiles').select('*, scholarships:scholarship_id(name)').eq('role', 'student').order('created_at', { ascending: false }),
      sb.from('student_fees').select('*'),
      sb.from('payments').select('student_id,payment_type,amount,status'),
      sb.from('departments').select('*').order('name'),
      sb.from('academic_years').select('*').order('name'),
      sb.from('scholarships').select('*').order('name'),
    ])
    const mapFee = new Map((fees || []).map(f => [f.student_id, Number(f.total_fee)]))
    const enriched = (profs || []).map(p => {
      const my = (pays || []).filter(x => x.student_id === p.id && x.status === 'APPROVED')
      const paid = my.filter(x => x.payment_type === 'MANUAL_PAYMENT' || x.payment_type === 'SCHOLARSHIP_PAID_TO_COLLEGE').reduce((a,b) => a + Number(b.amount), 0)
      const fee = mapFee.get(p.id) || 0
      return { ...p, total_fee: fee, total_paid: paid, balance: Math.max(0, fee - paid) }
    })
    setRows(enriched); setDepts(d || []); setYears(y || []); setSchols(s || [])
  }, [sb])
  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    if (q) { const s = q.toLowerCase(); if (!(r.full_name?.toLowerCase().includes(s) || r.register_number?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s))) return false }
    if (dept && r.department !== dept) return false
    if (yr && r.year !== yr) return false
    if (scholId && r.scholarship_id !== scholId) return false
    if (status && r.status !== status) return false
    return true
  })

  async function toggleStatus(r) {
    const next = r.status === 'inactive' ? 'active' : 'inactive'
    try { await apiFetch(`/api/admin/students/${r.id}`, { method: 'PUT', body: JSON.stringify({ status: next }) }); toast.success(`Student ${next}`); load() }
    catch (e) { toast.error(e.message) }
  }
  async function remove(r) {
    if (!confirm(`Delete ${r.full_name}? Students with payment history will be deactivated instead.`)) return
    try {
      const j = await apiFetch(`/api/admin/students/${r.id}`, { method: 'DELETE' })
      toast.success(j.mode === 'hard' ? 'Student permanently deleted' : 'Student deactivated (has payment history)')
      load()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Students</h1><p className="text-sm text-slate-500">Manage students, credentials and fees</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/students/new" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b2b6b] text-white text-sm hover:bg-[#0a2358]"><Plus className="h-4 w-4"/> Add Student</Link>
          <Link href="/admin/students/import" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"><Upload className="h-4 w-4"/> Import Excel</Link>
          <Link href="/admin/master" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"><Settings2 className="h-4 w-4"/> Master Data</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-slate-200">
          <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, roll no, email…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-[#0b2b6b]"/></div>
          <select value={dept} onChange={e=>setDept(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All departments</option>{depts.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select>
          <select value={yr} onChange={e=>setYr(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All years</option>{years.map(y=><option key={y.id} value={y.name}>{y.name}</option>)}</select>
          <select value={scholId} onChange={e=>setScholId(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All scholarships</option>{schols.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? <div className="p-10 text-center text-slate-500 text-sm"><Users className="h-8 w-8 mx-auto mb-2 text-slate-300"/>No students found.</div> : (
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase"><tr>
                <th className="text-left px-4 py-3">Photo</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Roll No</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Dept</th><th className="text-left px-4 py-3">Year</th><th className="text-left px-4 py-3">Scholarship</th><th className="text-right px-4 py-3">Fee</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 align-middle">
                    <td className="px-4 py-3"><div className="h-9 w-9 rounded-full bg-slate-200 overflow-hidden grid place-items-center text-slate-500 text-xs font-medium">{r.profile_photo_url ? <img src={r.profile_photo_url} alt="" className="h-full w-full object-cover"/> : (r.full_name?.[0] || 'S')}</div></td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.full_name}</td>
                    <td className="px-4 py-3">{r.register_number}</td>
                    <td className="px-4 py-3 text-slate-600">{r.email || '-'}</td>
                    <td className="px-4 py-3">{r.department || '-'}</td>
                    <td className="px-4 py-3">{r.year || '-'}</td>
                    <td className="px-4 py-3">{r.scholarships?.name || '-'}</td>
                    <td className="px-4 py-3 text-right">{inr(r.total_fee)}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${r.status === 'inactive' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{r.status || 'active'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button title="Edit" onClick={()=>setEditing(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-700"><Edit className="h-4 w-4"/></button>
                        <button title={r.status === 'inactive' ? 'Activate' : 'Deactivate'} onClick={()=>toggleStatus(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-700"><Power className="h-4 w-4"/></button>
                        <button title="Delete" onClick={()=>remove(r)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && <EditModal student={editing} depts={depts} years={years} schols={schols} onClose={()=>setEditing(null)} onSaved={()=>{ setEditing(null); load() }}/>}
    </div>
  )
}

function EditModal({ student, depts, years, schols, onClose, onSaved }) {
  const [f, setF] = useState({
    full_name: student.full_name || '', register_number: student.register_number || '', dob: student.dob || '', email: student.email || '',
    department: student.department || '', year: student.year || '', scholarship_id: student.scholarship_id || '',
    total_fee: student.total_fee ?? '', phone: student.phone || '', address: student.address || '', status: student.status || 'active',
  })
  const [busy, setBusy] = useState(false)
  const inp = 'w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white'
  function set(k,v) { setF(p => ({ ...p, [k]: v })) }
  async function save() {
    setBusy(true)
    try { await apiFetch(`/api/admin/students/${student.id}`, { method: 'PUT', body: JSON.stringify(f) }); toast.success('Student updated'); onSaved() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Edit Student</h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800"><X className="h-5 w-5"/></button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-600">Name</label><input value={f.full_name} onChange={e=>set('full_name', e.target.value)} className={inp+' mt-1'}/></div>
          <div><label className="text-xs text-slate-600">Roll Number</label><input value={f.register_number} onChange={e=>set('register_number', e.target.value)} className={inp+' mt-1'}/></div>
          <div><label className="text-xs text-slate-600">Date of Birth</label><input type="date" value={f.dob} onChange={e=>set('dob', e.target.value)} className={inp+' mt-1'}/></div>
          <div><label className="text-xs text-slate-600">Email</label><input type="email" value={f.email} onChange={e=>set('email', e.target.value)} className={inp+' mt-1'}/></div>
          <div><label className="text-xs text-slate-600">Department</label><select value={f.department} onChange={e=>set('department', e.target.value)} className={inp+' mt-1'}><option value="">-</option>{depts.map(d=><option key={d.id}>{d.name}</option>)}</select></div>
          <div><label className="text-xs text-slate-600">Year</label><select value={f.year} onChange={e=>set('year', e.target.value)} className={inp+' mt-1'}><option value="">-</option>{years.map(y=><option key={y.id}>{y.name}</option>)}</select></div>
          <div><label className="text-xs text-slate-600">Scholarship</label><select value={f.scholarship_id || ''} onChange={e=>set('scholarship_id', e.target.value || null)} className={inp+' mt-1'}><option value="">-</option>{schols.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="text-xs text-slate-600">Total Fee</label><input type="number" value={f.total_fee} onChange={e=>set('total_fee', e.target.value)} className={inp+' mt-1'}/></div>
          <div><label className="text-xs text-slate-600">Phone</label><input value={f.phone} onChange={e=>set('phone', e.target.value)} className={inp+' mt-1'}/></div>
          <div><label className="text-xs text-slate-600">Status</label><select value={f.status} onChange={e=>set('status', e.target.value)} className={inp+' mt-1'}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          <div className="md:col-span-2"><label className="text-xs text-slate-600">Address</label><textarea value={f.address} onChange={e=>set('address', e.target.value)} rows={2} className="mt-1 w-full p-3 rounded-lg border border-slate-300 text-sm"/></div>
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-300 text-sm">Cancel</button>
          <button disabled={busy} onClick={save} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b2b6b] text-white text-sm hover:bg-[#0a2358] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Save Changes</button>
        </div>
      </div>
    </div>
  )
}
