'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { fmtDate } from '@/lib/format'
import { toast } from 'sonner'
import { Eye, Search, FileText } from 'lucide-react'

export default function AdminDocuments() {
  const sb = supabaseBrowser()
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [type, setType] = useState('')

  useEffect(() => { (async () => {
    const { data } = await sb.from('payments').select('id,payment_type,payment_date,document_path,status,created_at,profiles:student_id(full_name,register_number)').not('document_path','is', null).order('created_at', { ascending: false })
    setRows(data || [])
  })() }, [sb])

  async function view(path) {
    const { data, error } = await sb.storage.from('payment-documents').createSignedUrl(path, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank')
  }

  const filtered = rows.filter(r => {
    if (type && r.payment_type !== type) return false
    if (q) { const s = q.toLowerCase(); if (!(r.profiles?.full_name?.toLowerCase().includes(s) || r.profiles?.register_number?.toLowerCase().includes(s))) return false }
    return true
  })

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Documents</h1><p className="text-sm text-slate-500">All challans and bank statements uploaded by students</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 flex gap-3 border-b border-slate-200">
          <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search student or reg no…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-[#0b2b6b]"/></div>
          <select value={type} onChange={e=>setType(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm"><option value="">All types</option><option value="MANUAL_PAYMENT">Challan (Manual)</option><option value="SCHOLARSHIP_RECEIVED">Bank Statement</option><option value="SCHOLARSHIP_PAID_TO_COLLEGE">Challan (Scholarship)</option></select>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-500"><FileText className="h-8 w-8 mx-auto mb-2 text-slate-300"/>No documents found.</div> : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase"><tr><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Reg No</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Uploaded</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Action</th></tr></thead>
              <tbody>{filtered.map(r => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{r.profiles?.full_name}</td><td className="px-4 py-3">{r.profiles?.register_number}</td>
                  <td className="px-4 py-3">{r.payment_type.replaceAll('_',' ')}</td><td className="px-4 py-3">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">{r.status}</span></td>
                  <td className="px-4 py-3"><button onClick={()=>view(r.document_path)} className="inline-flex items-center gap-1 text-[#0b2b6b] hover:underline text-xs"><Eye className="h-3.5 w-3.5"/> View</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
