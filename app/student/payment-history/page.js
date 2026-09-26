'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr, fmtDate } from '@/lib/format'
import { toast } from 'sonner'
import { Search, Eye, FileText } from 'lucide-react'

function StatusBadge({ status }) {
  const map = { PENDING: 'bg-amber-50 text-amber-700 border-amber-200', APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200', REJECTED: 'bg-red-50 text-red-700 border-red-200' }
  return <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>
}

export default function StudentPaymentHistory() {
  const sb = supabaseBrowser()
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    try {
      const { data: { session } } = await sb.auth.getSession(); if (!session) { setLoading(false); return }
      const { data } = await sb.from('payments').select('*').eq('student_id', session.user.id).order('created_at', { ascending: false })
      setPayments(data || [])
    } finally { setLoading(false) }
  })() }, [sb])

  const filtered = payments.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.payment_type?.toLowerCase().includes(s) || p.challan_number?.toLowerCase().includes(s) || p.payment_date?.includes(s) || p.bank_name?.toLowerCase().includes(s)
  })

  async function viewDoc(path) {
    const { data, error } = await sb.storage.from('payment-documents').createSignedUrl(path, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Payment History</h1>
          <p className="text-xs text-slate-500 mt-0.5">All your transactions</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none"/>
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading ? <div className="p-8 text-sm text-slate-500">Loading…</div> : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500"><FileText className="h-8 w-8 mx-auto mb-2 text-slate-300"/>No payment records yet.</div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">#</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Reference</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Document</th><th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.payment_type.replaceAll('_',' ')}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{p.challan_number || p.bank_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{inr(p.amount)}</td>
                  <td className="px-4 py-3">{p.document_path ? <button onClick={()=>viewDoc(p.document_path)} className="inline-flex items-center gap-1 text-[#0b2b6b] hover:underline text-xs"><Eye className="h-3.5 w-3.5"/> View</button> : <span className="text-slate-400">-</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status}/>{p.rejection_reason && <div className="text-[11px] text-red-600 mt-1">{p.rejection_reason}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
