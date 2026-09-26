import Link from 'next/link'
import { GraduationCap, ShieldCheck, MapPin, ArrowRight, Wallet, FileCheck2 } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-[#0b2b6b] text-white grid place-items-center shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 leading-tight">Government College</div>
              <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3"/> Chennai, Tamil Nadu</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-700">
            <a href="#" className="hover:text-[#0b2b6b]">Home</a>
            <a href="#about" className="hover:text-[#0b2b6b]">About</a>
            <a href="#contact" className="hover:text-[#0b2b6b]">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-[#0b2b6b] border border-blue-100 mb-5">
              <ShieldCheck className="h-3.5 w-3.5"/> Secure • Verified • Real-time
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">Scholarship Fee Payment Management System</h1>
            <p className="mt-4 text-lg text-slate-600">Track scholarship receipts and college fee payments securely in one place.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#0b2b6b] grid place-items-center mb-4">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Student Login</h3>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">View your fee details, upload payments and track scholarship transactions.</p>
              <Link href="/student-login" className="mt-6 inline-flex items-center gap-2 bg-[#0b2b6b] hover:bg-[#0a2358] text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors">
                Student Login <ArrowRight className="h-4 w-4"/>
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#0b2b6b] grid place-items-center mb-4">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Admin Login</h3>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">Manage students, verify payments and monitor scholarship transactions.</p>
              <Link href="/admin-login" className="mt-6 inline-flex items-center gap-2 bg-[#0b2b6b] hover:bg-[#0a2358] text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors">
                Admin Login <ArrowRight className="h-4 w-4"/>
              </Link>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/setup" className="text-xs text-slate-500 hover:text-[#0b2b6b] underline underline-offset-2">First-time setup / seed demo data</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Government College, Chennai. All rights reserved.</div>
          <div>Scholarship Fee Payment Management System</div>
        </div>
      </footer>
    </div>
  )
}
