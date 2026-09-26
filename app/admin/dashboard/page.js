'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { inr } from '@/lib/format'
import { Users, Wallet, Award, TrendingUp, Clock } from 'lucide-react'

function Card({ icon: Icon, label, value, tint }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl grid place-items-center ${tint}`}><Icon className="h-5 w-5"/></div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{value}</div>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const sb = supabaseBrowser()
  const [stats, setStats] = useState(null)

  useEffect(() => { (async () => {
    const [{ count: studentCount }, { data: fees }, { data: payments }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      sb.from('student_fees').select('total_fee'),
      sb.from('payments').select('payment_type,amount,status'),
    ])
    const totalFee = (fees || []).reduce((a, b) => a + Number(b.total_fee), 0)
    const approved = (payments || []).filter(p => p.status === 'APPROVED')
    const sumBy = t => approved.filter(p => p.payment_type === t).reduce((a, b) => a + Number(b.amount), 0)
    const pending = (payments || []).filter(p => p.status === 'PENDING').length
    setStats({
      students: studentCount || 0,
      totalFee,
      scholarshipReceived: sumBy('SCHOLARSHIP_RECEIVED'),
      scholarshipPaid: sumBy('SCHOLARSHIP_PAID_TO_COLLEGE'),
      manualPaid: sumBy('MANUAL_PAYMENT'),
      pending,
    })
  })() }, [sb])

  if (!stats) return <div className="text-sm text-slate-500">Loading…</div>

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Dashboard</h1><p className="text-sm text-slate-500">Overview of all student payment activity</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card icon={Users} label="Total Students" value={stats.students} tint="bg-blue-50 text-[#0b2b6b]"/>
        <Card icon={Wallet} label="Total College Fees" value={inr(stats.totalFee)} tint="bg-blue-50 text-[#0b2b6b]"/>
        <Card icon={Award} label="Scholarship Received" value={inr(stats.scholarshipReceived)} tint="bg-emerald-50 text-emerald-700"/>
        <Card icon={TrendingUp} label="Scholarship Paid to College" value={inr(stats.scholarshipPaid)} tint="bg-emerald-50 text-emerald-700"/>
        <Card icon={Clock} label="Pending Verification" value={stats.pending} tint="bg-amber-50 text-amber-700"/>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900">Quick actions</h2>
        <p className="text-sm text-slate-500 mt-1">Use the sidebar to manage Students, verify Payments, or view Reports.</p>
      </div>
    </div>
  )
}
