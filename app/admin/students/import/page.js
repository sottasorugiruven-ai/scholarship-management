'use client'
import { useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/supabase/apiFetch'
import { toast } from 'sonner'
import { ArrowLeft, Download, Upload, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'

export default function ImportStudents() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function validate() {
    if (!file) { toast.error('Please select a file'); return }
    setBusy(true); setResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const j = await apiFetch('/api/admin/students/validate', { method: 'POST', body: fd })
      setPreview(j); toast.success(`Parsed ${j.total} rows`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function confirmImport() {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const j = await apiFetch('/api/admin/students/import', { method: 'POST', body: fd })
      setResult(j); toast.success(`Imported ${j.imported} students`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2"><Link href="/admin/students" className="text-sm text-slate-600 hover:text-[#0b2b6b] inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4"/> Students</Link></div>
      <div><h1 className="text-2xl font-bold text-slate-900">Import Students from Excel</h1><p className="text-sm text-slate-500">Upload an .xlsx to bulk-create students with auto-generated Roll+DOB login.</p></div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center gap-4">
        <a href="/api/admin/students/template" download className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"><Download className="h-4 w-4"/> Download Excel Template</a>
        <div className="flex-1"/>
        <input type="file" accept=".xlsx,.csv" onChange={e=>{ setFile(e.target.files?.[0]); setPreview(null); setResult(null) }} className="text-sm"/>
        <button disabled={!file || busy} onClick={validate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>} Validate File</button>
      </div>

      {preview && !result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Import Preview</h2>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">Total: <b>{preview.total}</b></span>
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Valid: <b>{preview.valid}</b></span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Duplicates: <b>{preview.duplicate}</b></span>
                <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">Invalid: <b>{preview.invalid}</b></span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ setFile(null); setPreview(null) }} className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm">Cancel</button>
              <button disabled={busy || preview.valid === 0} onClick={confirmImport} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>} Confirm &amp; Import {preview.valid} Valid</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase"><tr><th className="text-left px-4 py-2">Row</th><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Roll</th><th className="text-left px-4 py-2">DOB</th><th className="text-left px-4 py-2">Dept</th><th className="text-left px-4 py-2">Year</th><th className="text-left px-4 py-2">Status</th></tr></thead>
              <tbody>
                {preview.rows.map(r => (
                  <tr key={r.row} className={`border-t border-slate-100 ${r.status === 'invalid' ? 'bg-red-50/40' : r.status === 'duplicate' ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-2 text-slate-500">{r.row}</td><td className="px-4 py-2">{r.data.full_name}</td><td className="px-4 py-2">{r.data.register_number}</td><td className="px-4 py-2">{r.data.dob || '-'}</td><td className="px-4 py-2">{r.data.department}</td><td className="px-4 py-2">{r.data.year}</td>
                    <td className="px-4 py-2">{r.status === 'valid' ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><CheckCircle2 className="h-3.5 w-3.5"/> Valid</span> : r.status === 'duplicate' ? <span className="inline-flex items-center gap-1 text-amber-700 text-xs"><AlertTriangle className="h-3.5 w-3.5"/> Duplicate</span> : <div><span className="inline-flex items-center gap-1 text-red-700 text-xs"><XCircle className="h-3.5 w-3.5"/> Invalid</span><div className="text-[11px] text-red-600 mt-0.5">{r.errors.join(', ')}</div></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900">Import Result</h2>
          <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200"><div className="text-xs text-emerald-700">Successfully Imported</div><div className="text-2xl font-bold text-emerald-800">{result.imported}</div></div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200"><div className="text-xs text-amber-700">Duplicates Skipped</div><div className="text-2xl font-bold text-amber-800">{result.skipped_duplicates}</div></div>
            <div className="p-4 rounded-xl bg-red-50 border border-red-200"><div className="text-xs text-red-700">Invalid Rows</div><div className="text-2xl font-bold text-red-800">{result.invalid}</div></div>
          </div>
          {result.failures?.length ? (
            <div className="mt-4"><div className="text-sm font-medium text-slate-800 mb-2">Failures</div><ul className="text-xs text-red-700 list-disc pl-5">{result.failures.map((f,i)=><li key={i}>Row {f.row}: {f.error}</li>)}</ul></div>
          ) : null}
          <div className="mt-4"><Link href="/admin/students" className="px-4 py-2 rounded-lg bg-[#0b2b6b] text-white text-sm">Go to Students</Link></div>
        </div>
      )}
    </div>
  )
}
