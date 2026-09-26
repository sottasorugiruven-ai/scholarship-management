'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { apiFetch } from '@/lib/supabase/apiFetch'
import { toast } from 'sonner'
import { Plus, Trash2, Save } from 'lucide-react'

function Section({ title, kind, extra }) {
  const [rows, setRows] = useState([]); const [name, setName] = useState(''); const [busy, setBusy] = useState(false)
  const table = ({ department: 'departments', year: 'academic_years', scholarship: 'scholarships' })[kind]

  async function load() {
    const sb = supabaseBrowser()
    const { data } = await sb.from(table).select('*').order('name')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try { await apiFetch('/api/admin/master', { method: 'POST', body: JSON.stringify({ kind, name: name.trim() }) }); setName(''); toast.success(`${title} added`); load() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function del(id) {
    if (!confirm('Delete this item?')) return
    try { await apiFetch(`/api/admin/master/${kind}/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() }
    catch (e) { toast.error(e.message) }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="flex gap-2 mb-3">
        <input value={name} onChange={e=>setName(e.target.value)} className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder={`New ${title.toLowerCase()} name`}/>
        <button disabled={busy} onClick={add} className="inline-flex items-center gap-1 px-3 rounded-lg bg-[#0b2b6b] text-white text-sm hover:bg-[#0a2358] disabled:opacity-60"><Plus className="h-4 w-4"/> Add</button>
      </div>
      <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
        {rows.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Empty</li>}
        {rows.map(r => (
          <li key={r.id} className="px-3 py-2 flex items-center justify-between text-sm">
            <span>{r.name}</span>
            <button onClick={()=>del(r.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4"/></button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MasterData() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Master Data</h1><p className="text-sm text-slate-500">Manage departments, academic years and scholarships used across the portal.</p></div>
      <div className="grid md:grid-cols-3 gap-4">
        <Section title="Departments" kind="department"/>
        <Section title="Academic Years" kind="year"/>
        <Section title="Scholarships" kind="scholarship"/>
      </div>
    </div>
  )
}
