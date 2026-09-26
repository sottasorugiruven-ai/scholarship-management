'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr } from '@/lib/format'

export default function AdminScholarships() {
  const sb = supabaseBrowser()
  const [rows, setRows] = useState([])
  useEffect(() => { (async () => {
    const { data: profs } = await sb.from('profiles').select('id,full_name,register_number,department,year').eq('role','student')
    const { data: pays } = await sb.from('payments').select('student_id,payment_type,amount,status')
    const approved = (pays || []).filter(p => p.status === 'APPROVED')
    const list = (profs || []).map(p => {
      const recv = approved.filter(x => x.student_id === p.id && x.payment_type === 'SCHOLARSHIP_RECEIVED').reduce((a,b)=>a+Number(b.amount),0)
      const paid = approved.filter(x => x.student_id === p.id && x.payment_type === 'SCHOLARSHIP_PAID_TO_COLLEGE').reduce((a,b)=>a+Number(b.amount),0)
      return { ...p, recv, paid, bal: recv - paid }
    })
    setRows(list)
  })() }, [sb])

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Scholarships</h1><p className="text-sm text-slate-500">Track scholarship received vs paid to college</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-xs text-slate-600 uppercase"><tr>
            <th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Reg No</th><th className="text-left px-4 py-3">Department</th><th className="text-right px-4 py-3">Received</th><th className="text-right px-4 py-3">Paid to College</th><th className="text-right px-4 py-3">Balance</th><th className="text-left px-4 py-3">Status</th>
          </tr></thead>
          <tbody>{rows.filter(r => r.recv > 0 || r.paid > 0).map(r => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium">{r.full_name}</td><td className="px-4 py-3">{r.register_number}</td><td className="px-4 py-3">{r.department}</td>
              <td className="px-4 py-3 text-right">{inr(r.recv)}</td><td className="px-4 py-3 text-right">{inr(r.paid)}</td>
              <td className="px-4 py-3 text-right font-semibold text-[#0b2b6b]">{inr(r.bal)}</td>
              <td className="px-4 py-3">{r.bal > 0 ? <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Pending transfer</span> : <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Settled</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        {rows.filter(r => r.recv > 0 || r.paid > 0).length === 0 && <div className="p-10 text-center text-sm text-slate-500">No scholarship activity yet.</div>}
      </div>
    </div>
  )
}
