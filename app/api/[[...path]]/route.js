import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin, derivePassword, normalizeDob, anonServerClient } from '@/lib/supabase/authServer'

async function readSql(name) {
  const p = path.join(process.cwd(), 'supabase', name)
  return await fs.readFile(p, 'utf8')
}

async function getSub(params) { const p = await params; return (p?.path || []).join('/') }

// ---------- GET ----------
export async function GET(req, { params }) {
  const sub = await getSub(params)
  if (sub === 'health') return NextResponse.json({ ok: true })
  if (sub === 'setup/sql') {
    return new NextResponse(await readSql('schema.sql'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  if (sub === 'setup/sql-v2') {
    return new NextResponse(await readSql('schema-v2.sql'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  if (sub === 'admin/students/template') return templateXlsx()
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// ---------- POST/PUT/DELETE ----------
export async function POST(req, { params }) {
  const sub = await getSub(params)
  try {
    if (sub === 'setup/seed') return await seedDemo()
    if (sub === 'auth/student-login') return await studentLogin(req)
    if (sub === 'admin/students') return await adminGuard(req, () => createStudent(req))
    if (sub === 'admin/students/validate') return await adminGuard(req, () => validateImport(req))
    if (sub === 'admin/students/import') return await adminGuard(req, () => runImport(req))
    if (sub === 'admin/master') return await adminGuard(req, () => upsertMaster(req))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (e) { return NextResponse.json({ error: e.message || String(e) }, { status: 500 }) }
}

export async function PUT(req, { params }) {
  const sub = await getSub(params)
  try {
    if (sub.startsWith('admin/students/')) {
      const id = sub.split('/')[2]
      return await adminGuard(req, () => updateStudent(req, id))
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (e) { return NextResponse.json({ error: e.message || String(e) }, { status: 500 }) }
}

export async function DELETE(req, { params }) {
  const sub = await getSub(params)
  try {
    if (sub.startsWith('admin/students/')) {
      const id = sub.split('/')[2]
      return await adminGuard(req, () => deleteStudent(req, id))
    }
    if (sub.startsWith('admin/master/')) {
      const [_, __, kind, id] = sub.split('/')
      return await adminGuard(req, () => deleteMaster(kind, id))
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (e) { return NextResponse.json({ error: e.message || String(e) }, { status: 500 }) }
}

async function adminGuard(req, fn) {
  const { user, error } = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
  return await fn(user)
}

// ---------- Student login (Roll + DOB) ----------
async function studentLogin(req) {
  const body = await req.json().catch(() => ({}))
  const roll = String(body.roll || '').trim()
  const dob = normalizeDob(body.dob)
  const generic = () => NextResponse.json({ error: 'Invalid Roll Number or Date of Birth.' }, { status: 401 })
  if (!roll || !dob) return generic()

  const { data: prof } = await supabaseAdmin.from('profiles')
    .select('id, role, status, email, dob').ilike('register_number', roll).maybeSingle()
  if (!prof) return generic()
  if (prof.role !== 'student') return generic()
  if (prof.status === 'inactive') return NextResponse.json({ error: 'This account is inactive. Please contact the administrator.' }, { status: 403 })
  if (!prof.dob || prof.dob !== dob) return generic()
  if (!prof.email) return NextResponse.json({ error: 'Login not configured. Please contact the administrator.' }, { status: 400 })

  // Ensure the derived password is set for this user (idempotent)
  const password = derivePassword(roll, dob)
  await supabaseAdmin.auth.admin.updateUserById(prof.id, { password, email_confirm: true })

  // Sign in via anon server client to obtain access/refresh tokens
  const anon = anonServerClient()
  const { data, error } = await anon.auth.signInWithPassword({ email: prof.email, password })
  if (error || !data.session) return generic()
  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}

// ---------- Create student ----------
async function createStudent(req) {
  const body = await req.json().catch(() => ({}))
  const v = await validateStudentPayload(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { data, error } = await performCreateOne(v.record)
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true, student: data })
}

async function performCreateOne(rec) {
  // Uniqueness check
  const orFilter = [`register_number.ilike.${rec.register_number}`]
  if (rec.email) orFilter.push(`email.ilike.${rec.email}`)
  const { data: existing } = await supabaseAdmin.from('profiles').select('id, register_number, email').or(orFilter.join(','))
  if (existing && existing.length) {
    const dupRoll = existing.find(x => x.register_number?.toLowerCase() === rec.register_number.toLowerCase())
    if (dupRoll) return { error: `Student with Roll Number ${rec.register_number} already exists.` }
    return { error: `Email ${rec.email} is already in use.` }
  }

  // Create auth user
  const password = derivePassword(rec.register_number, rec.dob)
  const { data: uRes, error: uErr } = await supabaseAdmin.auth.admin.createUser({
    email: rec.email, password, email_confirm: true,
    user_metadata: { full_name: rec.full_name, role: 'student', register_number: rec.register_number },
  })
  if (uErr) return { error: uErr.message }
  const userId = uRes.user.id

  // Upsert profile (trigger may have inserted a barebones row already)
  const { error: pErr } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    full_name: rec.full_name,
    role: 'student',
    register_number: rec.register_number,
    department: rec.department,
    year: rec.year,
    dob: rec.dob,
    email: rec.email,
    phone: rec.phone || null,
    address: rec.address || null,
    scholarship_id: rec.scholarship_id || null,
    status: 'active',
  }, { onConflict: 'id' })
  if (pErr) return { error: pErr.message }

  // Fee
  if (rec.total_fee != null) {
    const { error: fErr } = await supabaseAdmin.from('student_fees').upsert(
      { student_id: userId, total_fee: rec.total_fee }, { onConflict: 'student_id' }
    )
    if (fErr) return { error: fErr.message }
  }
  return { data: { id: userId, ...rec } }
}

async function validateStudentPayload(body) {
  const roll = String(body.register_number || body.roll || '').trim()
  const full_name = String(body.full_name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const department = String(body.department || '').trim()
  const year = String(body.year || '').trim()
  const dob = normalizeDob(body.dob)
  const total_fee = body.total_fee != null && body.total_fee !== '' ? Number(body.total_fee) : null
  const scholarship_id = body.scholarship_id || null
  if (!full_name) return { ok: false, error: 'Student Name is required' }
  if (!roll) return { ok: false, error: 'Roll Number is required' }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Valid email is required' }
  if (!dob) return { ok: false, error: 'Valid Date of Birth is required (YYYY-MM-DD)' }
  if (!department) return { ok: false, error: 'Department is required' }
  if (!year) return { ok: false, error: 'Academic Year is required' }
  if (total_fee != null && (isNaN(total_fee) || total_fee < 0)) return { ok: false, error: 'Invalid total fee' }
  return { ok: true, record: { full_name, register_number: roll, email, dob, department, year, total_fee, phone: body.phone, address: body.address, scholarship_id } }
}

// ---------- Update student ----------
async function updateStudent(req, id) {
  const body = await req.json().catch(() => ({}))
  // Fetch current
  const { data: cur } = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!cur) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  const updates = {}
  const authUpdates = {}
  const fields = ['full_name','register_number','department','year','phone','address','scholarship_id','status','email']
  for (const f of fields) if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f]
  if (body.dob !== undefined) updates.dob = normalizeDob(body.dob)

  // Uniqueness check for roll and email if changed
  const newRoll = updates.register_number || cur.register_number
  const newEmail = updates.email || cur.email
  if (updates.register_number || updates.email) {
    const orFilter = []
    if (updates.register_number) orFilter.push(`register_number.ilike.${newRoll}`)
    if (updates.email) orFilter.push(`email.ilike.${newEmail}`)
    const { data: dups } = await supabaseAdmin.from('profiles').select('id, register_number, email').or(orFilter.join(','))
    const conflict = (dups || []).find(x => x.id !== id)
    if (conflict) return NextResponse.json({ error: 'Roll Number or Email already in use by another student.' }, { status: 400 })
  }

  // If DOB or roll changed, refresh derived password (idempotent)
  if (updates.dob || updates.register_number) {
    authUpdates.password = derivePassword(newRoll, updates.dob || cur.dob)
  }
  if (updates.email) authUpdates.email = updates.email

  if (Object.keys(authUpdates).length) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { ...authUpdates, email_confirm: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (Object.keys(updates).length) {
    const { error } = await supabaseAdmin.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (body.total_fee !== undefined && body.total_fee !== '') {
    const { error } = await supabaseAdmin.from('student_fees').upsert({ student_id: id, total_fee: Number(body.total_fee) }, { onConflict: 'student_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// ---------- Delete/deactivate ----------
async function deleteStudent(req, id) {
  const url = new URL(req.url)
  const hard = url.searchParams.get('hard') === '1'
  // Check payment history
  const { count } = await supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).eq('student_id', id)
  if (hard && (count || 0) > 0) return NextResponse.json({ error: 'Cannot permanently delete a student with payment history. Deactivate instead.' }, { status: 400 })
  if (hard) {
    await supabaseAdmin.from('student_fees').delete().eq('student_id', id)
    await supabaseAdmin.from('profiles').delete().eq('id', id)
    await supabaseAdmin.auth.admin.deleteUser(id)
    return NextResponse.json({ ok: true, mode: 'hard' })
  }
  // Soft delete: mark inactive
  const { error } = await supabaseAdmin.from('profiles').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, mode: 'soft' })
}

// ---------- Master data ----------
async function upsertMaster(req) {
  const body = await req.json().catch(() => ({}))
  const table = ({ department: 'departments', year: 'academic_years', scholarship: 'scholarships' })[body.kind]
  if (!table) return NextResponse.json({ error: 'Invalid master kind' }, { status: 400 })
  if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const payload = { name: body.name.trim() }
  if (body.kind === 'scholarship' && body.active !== undefined) payload.active = !!body.active
  if (body.id) {
    const { error } = await supabaseAdmin.from(table).update(payload).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await supabaseAdmin.from(table).insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

async function deleteMaster(kind, id) {
  const table = ({ department: 'departments', year: 'academic_years', scholarship: 'scholarships' })[kind]
  if (!table) return NextResponse.json({ error: 'Invalid master kind' }, { status: 400 })
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// ---------- Excel template ----------
function templateXlsx() {
  const wb = XLSX.utils.book_new()
  const header = ['Student Name','Roll Number','Date of Birth','Email','Department','Academic Year','Scholarship Name','Total College Fee','Phone Number','Address']
  const example = ['Monisha A','23IT042','2005-06-15','student@college.edu','IT','4th Year','Government Scholarship',60000,'9876543210','Chennai, TN']
  const ws = XLSX.utils.aoa_to_sheet([header, example])
  ws['!cols'] = header.map(h => ({ wch: Math.max(14, h.length + 2) }))
  // Instructions sheet
  const info = XLSX.utils.aoa_to_sheet([
    ['Instructions'],
    ['Required fields: Student Name, Roll Number, Date of Birth, Email, Department, Academic Year, Scholarship Name, Total College Fee'],
    ['Optional fields: Phone Number, Address'],
    ['Date of Birth accepted formats: YYYY-MM-DD or DD-MM-YYYY'],
    ['Department, Academic Year and Scholarship Name must match existing values (managed by Admin).'],
    ['Roll Number and Email must be unique. Duplicates in the file or in the database are rejected.'],
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.utils.book_append_sheet(wb, info, 'Instructions')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="students-template.xlsx"' } })
}

// ---------- Excel import ----------
async function parseWorkbook(req) {
  const form = await req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') throw new Error('No file uploaded')
  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames.includes('Students') ? 'Students' : wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false })
  return rows
}

function mapRow(r) {
  const g = (k) => {
    for (const key of Object.keys(r)) if (key.trim().toLowerCase() === k.toLowerCase()) return r[key]
    return ''
  }
  return {
    full_name: String(g('Student Name') || '').trim(),
    register_number: String(g('Roll Number') || g('Registration Number') || '').trim(),
    dob: normalizeDob(g('Date of Birth') || g('DOB')),
    email: String(g('Email') || '').trim().toLowerCase(),
    department: String(g('Department') || '').trim(),
    year: String(g('Academic Year') || g('Year') || '').trim(),
    scholarship_name: String(g('Scholarship Name') || g('Scholarship') || '').trim(),
    total_fee: (() => { const v = g('Total College Fee') || g('Total Fee'); const n = Number(String(v).replace(/[,₹\s]/g, '')); return isNaN(n) ? null : n })(),
    phone: String(g('Phone Number') || '').trim(),
    address: String(g('Address') || '').trim(),
  }
}

async function validateImport(req) {
  const rows = await parseWorkbook(req)
  const [{ data: depts }, { data: years }, { data: schols }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('departments').select('name'),
    supabaseAdmin.from('academic_years').select('name'),
    supabaseAdmin.from('scholarships').select('id,name'),
    supabaseAdmin.from('profiles').select('register_number,email').eq('role','student'),
  ])
  const deptSet = new Set((depts || []).map(x => x.name.toLowerCase()))
  const yearSet = new Set((years || []).map(x => x.name.toLowerCase()))
  const scholMap = new Map((schols || []).map(x => [x.name.toLowerCase(), x.id]))
  const existRolls = new Set((existing || []).map(x => (x.register_number || '').toLowerCase()))
  const existEmails = new Set((existing || []).map(x => (x.email || '').toLowerCase()).filter(Boolean))

  const seenRolls = new Set()
  const seenEmails = new Set()
  const results = rows.map((raw, i) => {
    const r = mapRow(raw)
    const errors = []
    if (!r.full_name) errors.push('Missing Student Name')
    if (!r.register_number) errors.push('Missing Roll Number')
    if (!r.dob) errors.push('Missing/invalid Date of Birth')
    if (!r.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) errors.push('Invalid Email')
    if (!r.department) errors.push('Missing Department')
    else if (!deptSet.has(r.department.toLowerCase())) errors.push(`Department not found: ${r.department}`)
    if (!r.year) errors.push('Missing Academic Year')
    else if (!yearSet.has(r.year.toLowerCase())) errors.push(`Year not found: ${r.year}`)
    if (r.scholarship_name && !scholMap.has(r.scholarship_name.toLowerCase())) errors.push(`Scholarship not found: ${r.scholarship_name}`)
    if (r.total_fee == null || r.total_fee < 0) errors.push('Invalid Total Fee')
    // duplicates
    let status = 'valid'
    if (r.register_number && existRolls.has(r.register_number.toLowerCase())) status = 'duplicate'
    else if (r.email && existEmails.has(r.email.toLowerCase())) status = 'duplicate'
    else if (r.register_number && seenRolls.has(r.register_number.toLowerCase())) status = 'duplicate'
    else if (r.email && seenEmails.has(r.email.toLowerCase())) status = 'duplicate'
    if (r.register_number) seenRolls.add(r.register_number.toLowerCase())
    if (r.email) seenEmails.add(r.email.toLowerCase())
    if (errors.length) status = 'invalid'
    return { row: i + 2, data: r, status, errors, scholarship_id: r.scholarship_name ? scholMap.get(r.scholarship_name.toLowerCase()) || null : null }
  })
  return NextResponse.json({
    total: results.length,
    valid: results.filter(r => r.status === 'valid').length,
    duplicate: results.filter(r => r.status === 'duplicate').length,
    invalid: results.filter(r => r.status === 'invalid').length,
    rows: results,
  })
}

async function runImport(req) {
  const rows = await parseWorkbook(req)
  const validation = await (async () => {
    // Re-run validation logic without re-parsing
    const [{ data: depts }, { data: years }, { data: schols }, { data: existing }] = await Promise.all([
      supabaseAdmin.from('departments').select('name'),
      supabaseAdmin.from('academic_years').select('name'),
      supabaseAdmin.from('scholarships').select('id,name'),
      supabaseAdmin.from('profiles').select('register_number,email').eq('role','student'),
    ])
    const deptSet = new Set((depts || []).map(x => x.name.toLowerCase()))
    const yearSet = new Set((years || []).map(x => x.name.toLowerCase()))
    const scholMap = new Map((schols || []).map(x => [x.name.toLowerCase(), x.id]))
    const existRolls = new Set((existing || []).map(x => (x.register_number || '').toLowerCase()))
    const existEmails = new Set((existing || []).map(x => (x.email || '').toLowerCase()).filter(Boolean))
    const seenRolls = new Set(), seenEmails = new Set()
    return rows.map((raw, i) => {
      const r = mapRow(raw)
      const errors = []
      if (!r.full_name) errors.push('Missing Student Name')
      if (!r.register_number) errors.push('Missing Roll Number')
      if (!r.dob) errors.push('Missing/invalid Date of Birth')
      if (!r.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) errors.push('Invalid Email')
      if (!r.department || !deptSet.has(r.department.toLowerCase())) errors.push(`Department not found: ${r.department}`)
      if (!r.year || !yearSet.has(r.year.toLowerCase())) errors.push(`Year not found: ${r.year}`)
      if (r.total_fee == null || r.total_fee < 0) errors.push('Invalid Total Fee')
      let status = 'valid'
      if (r.register_number && existRolls.has(r.register_number.toLowerCase())) status = 'duplicate'
      else if (r.email && existEmails.has(r.email.toLowerCase())) status = 'duplicate'
      else if (r.register_number && seenRolls.has(r.register_number.toLowerCase())) status = 'duplicate'
      else if (r.email && seenEmails.has(r.email.toLowerCase())) status = 'duplicate'
      if (r.register_number) seenRolls.add(r.register_number.toLowerCase())
      if (r.email) seenEmails.add(r.email.toLowerCase())
      if (errors.length) status = 'invalid'
      const scholarship_id = r.scholarship_name ? (scholMap.get(r.scholarship_name.toLowerCase()) || null) : null
      return { row: i + 2, data: r, status, errors, scholarship_id }
    })
  })()

  const toImport = validation.filter(v => v.status === 'valid')
  const failures = []
  let imported = 0
  for (const r of toImport) {
    const rec = { ...r.data, scholarship_id: r.scholarship_id }
    const { data, error } = await performCreateOne(rec)
    if (error) failures.push({ row: r.row, error })
    else imported += 1
  }
  return NextResponse.json({
    imported,
    skipped_duplicates: validation.filter(v => v.status === 'duplicate').length,
    invalid: validation.filter(v => v.status === 'invalid').length,
    failures,
    total: validation.length,
  })
}

// ---------- Seed demo (updated to include DOB + master data) ----------
async function ensureUser({ email, password, role, meta }) {
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 })
  if (listErr) throw listErr
  let user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { ...meta, role } })
    if (error) throw error
    user = data.user
  } else {
    await supabaseAdmin.auth.admin.updateUserById(user.id, { password, user_metadata: { ...meta, role }, email_confirm: true })
  }
  return user
}

async function seedDemo() {
  try {
    const admin = await ensureUser({ email: 'admin@college.edu', password: 'Admin@123', role: 'admin', meta: { full_name: 'College Administrator' } })
    await supabaseAdmin.from('profiles').upsert({ id: admin.id, full_name: 'College Administrator', role: 'admin', email: 'admin@college.edu', status: 'active' }, { onConflict: 'id' })

    const demoDob = '2005-06-15'
    const demoRoll = '23IT042'
    const demoEmail = 'student@college.edu'
    const derived = derivePassword(demoRoll, demoDob)
    const student = await ensureUser({
      email: demoEmail, password: derived, role: 'student',
      meta: { full_name: 'Monisha A', register_number: demoRoll, department: 'IT', year: '4th Year' },
    })
    // Fetch scholarship id
    const { data: schol } = await supabaseAdmin.from('scholarships').select('id').ilike('name', 'Government Scholarship').maybeSingle()
    await supabaseAdmin.from('profiles').upsert({
      id: student.id, full_name: 'Monisha A', role: 'student', register_number: demoRoll,
      department: 'IT', year: '4th Year', dob: demoDob, email: demoEmail,
      scholarship_id: schol?.id || null, status: 'active',
    }, { onConflict: 'id' })
    await supabaseAdmin.from('student_fees').upsert({ student_id: student.id, total_fee: 60000 }, { onConflict: 'student_id' })

    // Only add sample transactions if not already present
    const { count } = await supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).eq('student_id', student.id)
    if (!count) {
      const nowIso = new Date().toISOString()
      await supabaseAdmin.from('payments').insert([
        { student_id: student.id, payment_type: 'MANUAL_PAYMENT', payment_date: '2026-08-15', challan_number: '123456', amount: 10000, status: 'APPROVED', verified_by: admin.id, verified_at: nowIso },
        { student_id: student.id, payment_type: 'SCHOLARSHIP_RECEIVED', payment_date: '2026-09-10', bank_name: 'State Bank of India', amount: 40000, status: 'APPROVED', verified_by: admin.id, verified_at: nowIso },
        { student_id: student.id, payment_type: 'SCHOLARSHIP_PAID_TO_COLLEGE', payment_date: '2026-09-25', challan_number: '654321', amount: 25000, status: 'APPROVED', verified_by: admin.id, verified_at: nowIso },
      ])
    }
    return NextResponse.json({
      ok: true,
      admin: { email: 'admin@college.edu', password: 'Admin@123' },
      student: { roll: demoRoll, dob: demoDob, email: demoEmail },
    })
  } catch (e) { return NextResponse.json({ error: e.message || String(e) }, { status: 500 }) }
}
