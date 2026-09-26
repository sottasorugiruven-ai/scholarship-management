'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr, fmtDate } from '@/lib/format'
import { toast } from 'sonner'
import { Camera, Wallet, Award, X, FileText, ChevronRight, CheckCircle2, AlertCircle, Clock, Eye, Search } from 'lucide-react'

function StatusBadge({ status }) {
  const map = {
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending' },
    APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Approved' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rejected' },
  }
  const s = map[status] || map.PENDING
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
}

export default function StudentDashboard() {
  const sb = supabaseBrowser()
  const [profile, setProfile] = useState(null)
  const [fee, setFee] = useState(0)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // 'manual' | 'scholarship' | null
  const [scholSub, setScholSub] = useState(null) // 'received' | 'paid'
  const [showQuick, setShowQuick] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const [{ data: prof }, { data: feeRow }, { data: pays }] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('student_fees').select('total_fee').eq('student_id', user.id).maybeSingle(),
      sb.from('payments').select('*').eq('student_id', user.id).order('created_at', { ascending: false }),
    ])
    setProfile(prof); setFee(Number(feeRow?.total_fee || 0)); setPayments(pays || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { load() }, [load])

  const approved = payments.filter(p => p.status === 'APPROVED')
  const sumBy = (type) => approved.filter(p => p.payment_type === type).reduce((a, b) => a + Number(b.amount), 0)
  const manualPaid = sumBy('MANUAL_PAYMENT')
  const scholReceived = sumBy('SCHOLARSHIP_RECEIVED')
  const scholPaidCollege = sumBy('SCHOLARSHIP_PAID_TO_COLLEGE')
  const totalPaidCollege = manualPaid + scholPaidCollege
  const collegeBalance = Math.max(0, fee - totalPaidCollege)
  const scholBalance = Math.max(0, scholReceived - scholPaidCollege)

  const filtered = payments.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (p.payment_type?.toLowerCase().includes(s)) || (p.challan_number?.toLowerCase().includes(s)) || (p.payment_date?.includes(s))
  })

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\//.test(file.type)) { toast.error('Only image files are allowed'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return }
    const path = `${profile.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await sb.storage.from('student-profiles').upload(path, file, { upsert: true, contentType: file.type })
    if (error) return toast.error(error.message)
    const { data } = await sb.storage.from('student-profiles').createSignedUrl(path, 60 * 60 * 24 * 365)
    await sb.from('profiles').update({ profile_photo_url: data.signedUrl }).eq('id', profile.id)
    toast.success('Profile photo updated')
    load()
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading dashboard…</div>

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-slate-200 overflow-hidden grid place-items-center text-slate-500 text-2xl font-semibold">
                {profile?.profile_photo_url ? <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover"/> : (profile?.full_name?.[0] || 'S')}
              </div>
              <label className="absolute -bottom-1 -right-1 h-8 w-8 bg-[#0b2b6b] text-white rounded-full grid place-items-center cursor-pointer hover:bg-[#0a2358] shadow-sm">
                <Camera className="h-4 w-4"/>
                <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden"/>
              </label>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">{profile?.full_name}</div>
              <div className="text-sm text-slate-600 mt-0.5">Register No: <b>{profile?.register_number || '-'}</b></div>
              <div className="text-sm text-slate-600">Department: {profile?.department || '-'}</div>
              <div className="text-sm text-slate-600">Year: {profile?.year || '-'}</div>
            </div>
          </div>
          <div className="md:text-right border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 pt-4 md:pt-0">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Total Amount</div>
            <div className="text-3xl font-bold text-[#0b2b6b] mt-1">{inr(fee)}</div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      {!mode && (
        <div className="grid md:grid-cols-2 gap-4">
          <button onClick={()=>setMode('manual')} className="text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-blue-50 text-[#0b2b6b] grid place-items-center"><Wallet className="h-5 w-5"/></div><div><div className="font-semibold text-slate-900">Manual Payment</div><div className="text-sm text-slate-500">Pay your fee manually to college</div></div><ChevronRight className="ml-auto h-5 w-5 text-slate-400"/></div>
          </button>
          <button onClick={()=>{ setMode('scholarship'); setScholSub(null) }} className="text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-blue-50 text-[#0b2b6b] grid place-items-center"><Award className="h-5 w-5"/></div><div><div className="font-semibold text-slate-900">Scholarship Payment</div><div className="text-sm text-slate-500">View scholarship details and pay to college</div></div><ChevronRight className="ml-auto h-5 w-5 text-slate-400"/></div>
          </button>
        </div>
      )}

      {mode === 'manual' && <ManualPaymentForm profile={profile} onDone={()=>{ setMode(null); load() }} onCancel={()=>setMode(null)} />}
      {mode === 'scholarship' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-slate-900 flex items-center gap-2"><Award className="h-5 w-5 text-[#0b2b6b]"/> Scholarship Payment</div>
            <button onClick={()=>setMode(null)} className="p-1 text-slate-500 hover:text-slate-800"><X className="h-5 w-5"/></button>
          </div>
          {!scholSub && (
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={()=>setScholSub('received')} className="text-left p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"><div className="font-medium text-slate-900">Scholarship Received</div><div className="text-xs text-slate-500 mt-1">Record scholarship credited by government/bank</div></button>
              <button onClick={()=>setScholSub('paid')} className="text-left p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"><div className="font-medium text-slate-900">Scholarship Paid to College</div><div className="text-xs text-slate-500 mt-1">Record scholarship transferred to college</div></button>
            </div>
          )}
          {scholSub === 'received' && <ScholarshipReceivedForm profile={profile} onDone={()=>{ setMode(null); setScholSub(null); load() }} onCancel={()=>setScholSub(null)} />}
          {scholSub === 'paid' && <ScholarshipPaidForm profile={profile} scholBalance={scholReceived - scholPaidCollege} onDone={()=>{ setMode(null); setScholSub(null); load() }} onCancel={()=>setScholSub(null)} />}
        </div>
      )}

      {/* Payment History (prominent) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
            <p className="text-xs text-slate-500 mt-0.5">All your transactions, newest first</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search type, date, challan…" className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none"/>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2"/>
              No payment records yet. Start by submitting a Manual Payment or Scholarship Receipt.
            </div>
          ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Document</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.payment_type.replaceAll('_',' ')}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{p.challan_number || p.bank_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{inr(p.amount)}</td>
                  <td className="px-4 py-3">{p.document_path ? <DocLink path={p.document_path}/> : <span className="text-slate-400">-</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status}/>{p.status === 'REJECTED' && p.rejection_reason && <div className="text-[11px] text-red-600 mt-1">{p.rejection_reason}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>) }
        </div>
      </div>

      {/* Payment Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Total Amount Paid</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{inr(totalPaidCollege)}</div>
          <div className="text-xs text-slate-500 mt-1">Manual + Scholarship paid to college</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Remaining Balance</div>
          <div className="text-2xl font-bold text-[#0b2b6b] mt-1">{inr(collegeBalance)}</div>
          <div className="text-xs text-slate-500 mt-1">Total fee − amount paid</div>
        </div>
      </div>

      <div>
        <button onClick={()=>setShowQuick(v=>!v)} className="text-sm text-[#0b2b6b] hover:underline font-medium">{showQuick ? 'Hide' : 'View'} Quick Summary →</button>
        {showQuick && (
          <div className="mt-3 bg-blue-50/60 border border-blue-100 rounded-xl p-5 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Total College Fee</span><span className="font-semibold">{inr(fee)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Manual Payment</span><span className="font-semibold">{inr(manualPaid)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Scholarship Received</span><span className="font-semibold">{inr(scholReceived)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Scholarship Paid to College</span><span className="font-semibold">{inr(scholPaidCollege)}</span></div>
            <div className="flex justify-between sm:col-span-2 pt-2 border-t border-blue-200"><span className="text-slate-700 font-medium">Scholarship Balance</span><span className="font-bold text-[#0b2b6b]">{inr(scholBalance)}</span></div>
          </div>
        )}
      </div>
    </div>
  )
}

function DocLink({ path }) {
  const [busy, setBusy] = useState(false)
  async function open() {
    setBusy(true)
    const bucket = path.startsWith('pay/') ? 'payment-documents' : 'payment-documents'
    const { data, error } = await supabaseBrowser().storage.from('payment-documents').createSignedUrl(path, 300)
    setBusy(false)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank')
  }
  return <button onClick={open} disabled={busy} className="inline-flex items-center gap-1 text-[#0b2b6b] hover:underline text-xs"><Eye className="h-3.5 w-3.5"/> View</button>
}

function FormShell({ title, onCancel, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-slate-900">{title}</div>
        <button onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-800"><X className="h-5 w-5"/></button>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) { return <div><label className="text-sm font-medium text-slate-700">{label}</label><div className="mt-1">{children}</div></div> }
const inp = "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-[#0b2b6b] focus:ring-2 focus:ring-blue-100 outline-none"

async function submitPayment({ studentId, payment_type, payment_date, challan_number, bank_name, amount, file }) {
  const sb = supabaseBrowser()
  const { data: ins, error: insErr } = await sb.from('payments').insert({
    student_id: studentId, payment_type, payment_date, challan_number: challan_number || null,
    bank_name: bank_name || null, amount: Number(amount), status: 'PENDING'
  }).select().single()
  if (insErr) throw new Error(insErr.message)
  let document_path = null
  if (file) {
    document_path = `${studentId}/${ins.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await sb.storage.from('payment-documents').upload(document_path, file, { contentType: file.type })
    if (upErr) throw new Error(upErr.message)
    await sb.from('payments').update({ document_path }).eq('id', ins.id)
  }
  return ins
}

function ManualPaymentForm({ profile, onDone, onCancel }) {
  const [date, setDate] = useState(''); const [challan, setChallan] = useState(''); const [amt, setAmt] = useState(''); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (!date || !challan || !amt || !file) { toast.error('All fields are required'); return }
    if (Number(amt) <= 0) { toast.error('Amount must be > 0'); return }
    if (!/^(image\/(jpe?g|png)|application\/pdf)$/.test(file.type)) { toast.error('Only JPG, PNG, or PDF allowed'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return }
    setBusy(true)
    try {
      await submitPayment({ studentId: profile.id, payment_type: 'MANUAL_PAYMENT', payment_date: date, challan_number: challan, amount: amt, file })
      toast.success('Payment submitted successfully and is waiting for admin verification.')
      onDone()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <FormShell title="Manual Payment" onCancel={onCancel}>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
        <Field label="Payment Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp}/></Field>
        <Field label="Challan Number"><input value={challan} onChange={e=>setChallan(e.target.value)} className={inp} placeholder="e.g. 123456"/></Field>
        <Field label="Payment Amount (₹)"><input type="number" min="1" step="0.01" value={amt} onChange={e=>setAmt(e.target.value)} className={inp}/></Field>
        <Field label="Upload Challan (JPG/PNG/PDF, ≤ 5MB)"><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files?.[0])} className="text-sm"/></Field>
        <div className="md:col-span-2 flex gap-3 mt-2">
          <button disabled={busy} className="px-4 py-2.5 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358] disabled:opacity-60">{busy ? 'Submitting…' : 'Submit Payment'}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Cancel</button>
        </div>
      </form>
    </FormShell>
  )
}

function ScholarshipReceivedForm({ profile, onDone, onCancel }) {
  const [date, setDate] = useState(''); const [bank, setBank] = useState(''); const [amt, setAmt] = useState(''); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (!date || !bank || !amt || !file) { toast.error('All fields are required'); return }
    if (Number(amt) <= 0) { toast.error('Amount must be > 0'); return }
    setBusy(true)
    try {
      await submitPayment({ studentId: profile.id, payment_type: 'SCHOLARSHIP_RECEIVED', payment_date: date, bank_name: bank, amount: amt, file })
      toast.success('Scholarship receipt submitted successfully.')
      onDone()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="mt-4">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
        <Field label="Received Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp}/></Field>
        <Field label="Bank Name"><input value={bank} onChange={e=>setBank(e.target.value)} className={inp} placeholder="e.g. State Bank of India"/></Field>
        <Field label="Amount Received (₹)"><input type="number" min="1" step="0.01" value={amt} onChange={e=>setAmt(e.target.value)} className={inp}/></Field>
        <Field label="Upload Bank Statement"><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files?.[0])} className="text-sm"/></Field>
        <div className="md:col-span-2 flex gap-3 mt-2">
          <button disabled={busy} className="px-4 py-2.5 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358] disabled:opacity-60">{busy ? 'Submitting…' : 'Submit Scholarship Receipt'}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Back</button>
        </div>
      </form>
    </div>
  )
}

function ScholarshipPaidForm({ profile, scholBalance, onDone, onCancel }) {
  const [date, setDate] = useState(''); const [challan, setChallan] = useState(''); const [amt, setAmt] = useState(''); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (!date || !challan || !amt || !file) { toast.error('All fields are required'); return }
    if (Number(amt) <= 0) { toast.error('Amount must be > 0'); return }
    if (Number(amt) > scholBalance) { toast.error(`Amount cannot be greater than scholarship balance (₹${scholBalance})`); return }
    setBusy(true)
    try {
      await submitPayment({ studentId: profile.id, payment_type: 'SCHOLARSHIP_PAID_TO_COLLEGE', payment_date: date, challan_number: challan, amount: amt, file })
      toast.success('Payment submitted successfully and is waiting for admin verification.')
      onDone()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="mt-4">
      <div className="mb-3 text-xs bg-blue-50 text-[#0b2b6b] rounded-lg p-2 border border-blue-100">Available scholarship balance: <b>{inr(scholBalance)}</b></div>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
        <Field label="Payment Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp}/></Field>
        <Field label="Challan Number"><input value={challan} onChange={e=>setChallan(e.target.value)} className={inp}/></Field>
        <Field label="Amount Paid (₹)"><input type="number" min="1" step="0.01" value={amt} onChange={e=>setAmt(e.target.value)} className={inp}/></Field>
        <Field label="Upload Challan"><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files?.[0])} className="text-sm"/></Field>
        <div className="md:col-span-2 flex gap-3 mt-2">
          <button disabled={busy} className="px-4 py-2.5 rounded-lg bg-[#0b2b6b] text-white text-sm font-medium hover:bg-[#0a2358] disabled:opacity-60">{busy ? 'Submitting…' : 'Submit Payment'}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50">Back</button>
        </div>
      </form>
    </div>
  )
}
