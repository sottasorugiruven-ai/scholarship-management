'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr } from '@/lib/format'
import { Download } from 'lucide-react'

export default function AdminReports() {
  const sb = supabaseBrowser()
  const [stats, setStats] = useState(null); const [rows, setRows] = useState([])

  useEffect(() => { (async () => {
    const [{ count: sc }, { data: fees }, { data: pays }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role','student'),
      sb.from('student_fees').select('total_fee'),
      sb.from('payments').select('*'),
    ])
    const totalFee = (fees || []).reduce((a,b)=>a+Number(b.total_fee),0)
    const A = (pays || []).filter(p => p.status === 'APPROVED')
    const P = (pays || []).filter(p => p.status === 'PENDING')
    const R = (pays || []).filter(p => p.status === 'REJECTED')
    const s = t => A.filter(x => x.payment_type === t).reduce((a,b)=>a+Number(b.amount),0)
    const manual = s('MANUAL_PAYMENT'); const recv = s('SCHOLARSHIP_RECEIVED'); const paid = s('SCHOLARSHIP_PAID_TO_COLLEGE')
    setStats({ students: sc||0, totalFee, manual, recv, paid, pending: P.length, approved: A.length, rejected: R.length, balance: Math.max(0, totalFee - (manual + paid)) })
    setRows(pays || [])
  })() }, [sb])

  function exportCsv() {
    const header = ['id','student_id','payment_type','payment_date','challan_number','bank_name','amount','status','rejection_reason','created_at']
    const csv = [header.join(','), ...rows.map(r => header.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'payments-report.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (!stats) return <div className="text-sm text-slate-500">Loading…</div>

  const cells = [
    ['Total students', stats.students], ['Total college fee', inr(stats.totalFee)],
    ['Total manual payments', inr(stats.manual)], ['Total scholarship received', inr(stats.recv)],
    ['Total scholarship paid to college', inr(stats.paid)], ['Total remaining college balance', inr(stats.balance)],
    ['Pending payments', stats.pending], ['Approved payments', stats.approved], ['Rejected payments', stats.rejected],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Reports</h1><p className="text-sm text-slate-500">Aggregated statistics from all approved transactions</p></div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b2b6b] text-white text-sm hover:bg-[#0a2358]"><Download className="h-4 w-4"/> Export CSV</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cells.map(([k,v]) => (
          <div key={k} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wide">{k}</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
