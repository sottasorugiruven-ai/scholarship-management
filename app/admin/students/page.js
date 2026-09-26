'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr } from '@/lib/format'
import { Search, Users } from 'lucide-react'

export default function AdminStudents() {
  const sb = supabaseBrowser()
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [dept, setDept] = useState(''); const [yr, setYr] = useState('')

  useEffect(() => { (async () => {
    const { data: profs } = await sb.from('profiles').select('*').eq('role', 'student')
    const { data: fees } = await sb.from('student_fees').select('*')
    const { data: pays } = await sb.from('payments').select('student_id,payment_type,amount,status')
    const mapFee = new Map((fees || []).map(f => [f.student_id, Number(f.total_fee)]))
    const enriched = (profs || []).map(p => {
      const my = (pays || []).filter(x => x.student_id === p.id && x.status === 'APPROVED')
      const manual = my.filter(x => x.payment_type === 'MANUAL_PAYMENT').reduce((a, b) => a + Number(b.amount), 0)
      const paidCol = my.filter(x => x.payment_type === 'SCHOLARSHIP_PAID_TO_COLLEGE').reduce((a, b) => a + Number(b.amount), 0)
      const totalPaid = manual + paidCol
      const fee = mapFee.get(p.id) || 0
      return { ...p, total_fee: fee, total_paid: totalPaid, balance: Math.max(0, fee - totalPaid), status: totalPaid >= fee && fee > 0 ? 'Complete' : 'Pending' }
    })
    setRows(enriched)
  })() }, [sb])

  const filtered = rows.filter(r => {
    if (q && !(r.full_name?.toLowerCase().includes(q.toLowerCase()) || r.register_number?.toLowerCase().includes(q.toLowerCase()))) return false
    if (dept && r.department !== dept) return false
    if (yr && r.year !== yr) return false
    return true
  })
  const depts = [...new Set(rows.map(r => r.department).filter(Boolean))]
  const years = [...new Set(rows.map(r => r.year).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Students</h1><p className="text-sm text-slate-500">All registered students and their fee status</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-slate-200">
          <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or register number…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-[#0b2b6b]"/></div>
          <select value={dept} onChange={e=>setDept(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All departments</option>{depts.map(d=><option key={d}>{d}</option>)}</select>
          <select value={yr} onChange={e=>setYr(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All years</option>{years.map(y=><option key={y}>{y}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? <div className="p-10 text-center text-slate-500 text-sm"><Users className="h-8 w-8 mx-auto mb-2 text-slate-300"/>No students found.</div> : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase"><tr>
                <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Register No</th><th className="text-left px-4 py-3">Department</th><th className="text-left px-4 py-3">Year</th><th className="text-right px-4 py-3">Total Fee</th><th className="text-right px-4 py-3">Paid</th><th className="text-right px-4 py-3">Balance</th><th className="text-left px-4 py-3">Status</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.full_name}</td>
                    <td className="px-4 py-3">{r.register_number}</td><td className="px-4 py-3">{r.department}</td><td className="px-4 py-3">{r.year}</td>
                    <td className="px-4 py-3 text-right">{inr(r.total_fee)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{inr(r.total_paid)}</td>
                    <td className="px-4 py-3 text-right">{inr(r.balance)}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${r.status === 'Complete' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
