'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr, fmtDate } from '@/lib/format'
import { toast } from 'sonner'
import { Eye, Check, X, Search } from 'lucide-react'

function Badge({ s }) {
  const m = { PENDING: 'bg-amber-50 text-amber-700 border-amber-200', APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200', REJECTED: 'bg-red-50 text-red-700 border-red-200' }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${m[s]}`}>{s}</span>
}

export default function AdminPayments() {
  const sb = supabaseBrowser()
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [status, setStatus] = useState('PENDING'); const [type, setType] = useState('')
  const [rejectFor, setRejectFor] = useState(null); const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const { data } = await sb.from('payments').select('*, profiles:student_id(full_name,register_number,department,year)').order('created_at', { ascending: false })
    setRows(data || [])
  }, [sb])
  useEffect(() => { load() }, [load])

  async function viewDoc(path) {
    const { data, error } = await sb.storage.from('payment-documents').createSignedUrl(path, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank')
  }

  async function approve(row) {
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('payments').update({ status: 'APPROVED', verified_by: user.id, verified_at: new Date().toISOString(), rejection_reason: null }).eq('id', row.id)
    if (error) return toast.error(error.message)
    await sb.from('payment_audit_logs').insert({ payment_id: row.id, action: 'APPROVE', performed_by: user.id, old_status: row.status, new_status: 'APPROVED' })
    toast.success('Payment approved'); load()
  }

  async function reject() {
    if (!reason.trim()) { toast.error('Please provide a rejection reason'); return }
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('payments').update({ status: 'REJECTED', rejection_reason: reason, verified_by: user.id, verified_at: new Date().toISOString() }).eq('id', rejectFor.id)
    if (error) return toast.error(error.message)
    await sb.from('payment_audit_logs').insert({ payment_id: rejectFor.id, action: 'REJECT', performed_by: user.id, old_status: rejectFor.status, new_status: 'REJECTED', remarks: reason })
    setRejectFor(null); setReason(''); toast.success('Payment rejected'); load()
  }

  const filtered = rows.filter(r => {
    if (status && r.status !== status) return false
    if (type && r.payment_type !== type) return false
    if (q) {
      const s = q.toLowerCase()
      const hit = r.profiles?.full_name?.toLowerCase().includes(s) || r.profiles?.register_number?.toLowerCase().includes(s) || r.challan_number?.toLowerCase().includes(s)
      if (!hit) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Payments</h1><p className="text-sm text-slate-500">Review, approve or reject student transactions</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-slate-200">
          <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search student, reg no, challan…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-[#0b2b6b]"/></div>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All status</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select>
          <select value={type} onChange={e=>setType(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All types</option><option value="MANUAL_PAYMENT">Manual</option><option value="SCHOLARSHIP_RECEIVED">Scholarship Received</option><option value="SCHOLARSHIP_PAID_TO_COLLEGE">Scholarship Paid</option></select>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No records match your filters.</div> : (
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase"><tr>
                <th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Reg No</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Date</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Doc</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.profiles?.full_name}</td>
                    <td className="px-4 py-3">{r.profiles?.register_number}</td>
                    <td className="px-4 py-3">{r.payment_type.replaceAll('_',' ')}</td>
                    <td className="px-4 py-3">{fmtDate(r.payment_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{inr(r.amount)}</td>
                    <td className="px-4 py-3">{r.document_path ? <button onClick={()=>viewDoc(r.document_path)} className="text-[#0b2b6b] hover:underline text-xs inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5"/> View</button> : '-'}</td>
                    <td className="px-4 py-3"><Badge s={r.status}/>{r.rejection_reason && <div className="text-[11px] text-red-600 mt-1">{r.rejection_reason}</div>}</td>
                    <td className="px-4 py-3">{r.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button onClick={()=>approve(r)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"><Check className="h-3.5 w-3.5"/> Approve</button>
                        <button onClick={()=>setRejectFor(r)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"><X className="h-3.5 w-3.5"/> Reject</button>
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {rejectFor && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={()=>setRejectFor(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900">Reject Payment</h3>
            <p className="text-sm text-slate-500 mt-1">Provide a clear reason — the student will see this.</p>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className="mt-3 w-full p-3 rounded-lg border border-slate-300 text-sm" placeholder="e.g. Uploaded challan is unclear. Please upload a clearer copy."/>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={()=>setRejectFor(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm">Cancel</button>
              <button onClick={reject} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
