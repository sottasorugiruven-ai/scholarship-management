'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { LayoutDashboard, Users, Receipt, Award, FileText, BarChart3, LogOut, ShieldCheck, Menu, X } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminLayout({ children }) {
  const router = useRouter(); const pathname = usePathname()
  const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true); const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const sb = supabaseBrowser()
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.replace('/admin-login'); return }
      const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { await sb.auth.signOut(); router.replace('/admin-login'); return }
      setProfile(prof); setLoading(false)
    })()
  }, [router])

  async function logout() { await supabaseBrowser().auth.signOut(); toast.success('Logged out'); router.replace('/admin-login') }

  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/students', label: 'Students', icon: Users },
    { href: '/admin/payments', label: 'Payments', icon: Receipt },
    { href: '/admin/scholarships', label: 'Scholarships', icon: Award },
    { href: '/admin/documents', label: 'Documents', icon: FileText },
    { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ]

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`${mobileOpen ? 'block' : 'hidden'} md:block fixed md:sticky top-0 z-40 md:z-auto h-screen w-64 bg-[#0b2b6b] text-white flex-shrink-0`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10">
          <div className="h-9 w-9 rounded-lg bg-white/10 grid place-items-center"><ShieldCheck className="h-5 w-5"/></div>
          <div><div className="text-sm font-semibold">Admin Portal</div><div className="text-[10px] text-white/60">Govt. College, Chennai</div></div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map(n => { const active = pathname === n.href; return (
            <Link key={n.href} href={n.href} onClick={()=>setMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active ? 'bg-white text-[#0b2b6b] font-medium' : 'text-white/85 hover:bg-white/10'}`}><n.icon className="h-4 w-4"/> {n.label}</Link>
          ) })}
          <button onClick={logout} className="w-full mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/85 hover:bg-white/10"><LogOut className="h-4 w-4"/> Logout</button>
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <button className="md:hidden p-2" onClick={()=>setMobileOpen(v=>!v)}>{mobileOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</button>
          <h1 className="text-lg font-semibold text-slate-800 hidden md:block">Administrator</h1>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-200 grid place-items-center text-slate-500 text-xs font-medium">{profile?.full_name?.[0] || 'A'}</div>
            <div className="hidden sm:block"><div className="text-sm font-medium text-slate-800 leading-tight">{profile?.full_name}</div><div className="text-[11px] text-slate-500">Admin</div></div>
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
