import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function readSql() {
  const p = path.join(process.cwd(), 'supabase', 'schema.sql')
  return await fs.readFile(p, 'utf8')
}

async function getSubpath(params) {
  const p = await params
  return (p?.path || []).join('/')
}

export async function GET(req, { params }) {
  const sub = await getSubpath(params)
  if (sub === 'setup/sql') {
    const sql = await readSql()
    return new NextResponse(sql, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  if (sub === 'health') return NextResponse.json({ ok: true })
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(req, { params }) {
  const sub = await getSubpath(params)
  if (sub === 'setup/seed') return await seedDemo()
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function ensureUser({ email, password, role, meta }) {
  // Try find by email first via listUsers (admin API)
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw listErr
  let user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { ...meta, role },
    })
    if (error) throw error
    user = data.user
  } else {
    // Update password and metadata to keep demo consistent
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password, user_metadata: { ...meta, role }, email_confirm: true,
    })
  }
  // Upsert profile with role and demo details
  const { error: upErr } = await supabaseAdmin.from('profiles').upsert({
    id: user.id,
    full_name: meta.full_name || '',
    role,
    register_number: meta.register_number || null,
    department: meta.department || null,
    year: meta.year || null,
  }, { onConflict: 'id' })
  if (upErr) throw upErr
  return user
}

async function seedDemo() {
  try {
    // 1) Ensure admin
    const admin = await ensureUser({
      email: 'admin@college.edu', password: 'Admin@123', role: 'admin',
      meta: { full_name: 'College Administrator' },
    })
    // 2) Ensure student
    const student = await ensureUser({
      email: 'student@college.edu', password: 'Student@123', role: 'student',
      meta: { full_name: 'Monisha A', register_number: '23IT042', department: 'Information Technology', year: '4th Year' },
    })
    // 3) Fee
    const { error: feeErr } = await supabaseAdmin.from('student_fees').upsert({
      student_id: student.id, total_fee: 60000,
    }, { onConflict: 'student_id' })
    if (feeErr) throw feeErr

    // 4) Sample transactions (APPROVED) — clean prior demo rows first
    await supabaseAdmin.from('payments').delete().eq('student_id', student.id)

    const nowIso = new Date().toISOString()
    const seed = [
      { student_id: student.id, payment_type: 'MANUAL_PAYMENT', payment_date: '2026-08-15', challan_number: '123456', amount: 10000, status: 'APPROVED', verified_by: admin.id, verified_at: nowIso },
      { student_id: student.id, payment_type: 'SCHOLARSHIP_RECEIVED', payment_date: '2026-09-10', bank_name: 'State Bank of India', amount: 40000, status: 'APPROVED', verified_by: admin.id, verified_at: nowIso },
      { student_id: student.id, payment_type: 'SCHOLARSHIP_PAID_TO_COLLEGE', payment_date: '2026-09-25', challan_number: '654321', amount: 25000, status: 'APPROVED', verified_by: admin.id, verified_at: nowIso },
    ]
    const { error: pErr } = await supabaseAdmin.from('payments').insert(seed)
    if (pErr) throw pErr

    return NextResponse.json({
      ok: true,
      admin: { email: 'admin@college.edu', password: 'Admin@123' },
      student: { email: 'student@college.edu', password: 'Student@123' },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}
