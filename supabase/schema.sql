-- =============================================
-- SCHOLARSHIP FEE PAYMENT MANAGEMENT SYSTEM
-- Complete schema, RLS, and storage buckets
-- =============================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- =============================================
-- TABLES
-- =============================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student','admin')),
  register_number text unique,
  department text,
  year text,
  profile_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  total_fee numeric(12,2) not null default 0 check (total_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  payment_type text not null check (payment_type in ('MANUAL_PAYMENT','SCHOLARSHIP_RECEIVED','SCHOLARSHIP_PAID_TO_COLLEGE')),
  payment_date date not null,
  bank_name text,
  challan_number text,
  amount numeric(12,2) not null check (amount > 0),
  document_path text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  rejection_reason text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  action text not null,
  performed_by uuid references public.profiles(id),
  old_status text,
  new_status text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_type on public.payments(payment_type);

-- =============================================
-- HELPER FUNCTION: is_admin (avoids RLS recursion)
-- =============================================

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin');
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, register_number, department, year)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'register_number',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'year'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table public.profiles enable row level security;
alter table public.student_fees enable row level security;
alter table public.payments enable row level security;
alter table public.payment_audit_logs enable row level security;

-- profiles policies
drop policy if exists p_profiles_select_own on public.profiles;
drop policy if exists p_profiles_select_admin on public.profiles;
drop policy if exists p_profiles_update_own on public.profiles;
drop policy if exists p_profiles_update_admin on public.profiles;

create policy p_profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy p_profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin((select auth.uid())));
create policy p_profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy p_profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin((select auth.uid())));

-- student_fees policies
drop policy if exists p_fees_select_own on public.student_fees;
drop policy if exists p_fees_select_admin on public.student_fees;
drop policy if exists p_fees_admin_all on public.student_fees;

create policy p_fees_select_own on public.student_fees
  for select to authenticated using (student_id = (select auth.uid()));
create policy p_fees_select_admin on public.student_fees
  for select to authenticated using (public.is_admin((select auth.uid())));
create policy p_fees_admin_all on public.student_fees
  for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

-- payments policies
drop policy if exists p_payments_select_own on public.payments;
drop policy if exists p_payments_select_admin on public.payments;
drop policy if exists p_payments_insert_own on public.payments;
drop policy if exists p_payments_update_own_pending on public.payments;
drop policy if exists p_payments_update_admin on public.payments;

create policy p_payments_select_own on public.payments
  for select to authenticated using (student_id = (select auth.uid()));
create policy p_payments_select_admin on public.payments
  for select to authenticated using (public.is_admin((select auth.uid())));
create policy p_payments_insert_own on public.payments
  for insert to authenticated with check (student_id = (select auth.uid()) and status = 'PENDING');
create policy p_payments_update_own_pending on public.payments
  for update to authenticated using (student_id = (select auth.uid()) and status in ('PENDING','REJECTED'))
  with check (student_id = (select auth.uid()));
create policy p_payments_update_admin on public.payments
  for update to authenticated using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- audit logs
drop policy if exists p_audit_select_admin on public.payment_audit_logs;
drop policy if exists p_audit_insert_admin on public.payment_audit_logs;
drop policy if exists p_audit_select_own on public.payment_audit_logs;

create policy p_audit_select_admin on public.payment_audit_logs
  for select to authenticated using (public.is_admin((select auth.uid())));
create policy p_audit_select_own on public.payment_audit_logs
  for select to authenticated using (exists (select 1 from public.payments p where p.id = payment_id and p.student_id = (select auth.uid())));
create policy p_audit_insert_admin on public.payment_audit_logs
  for insert to authenticated with check (public.is_admin((select auth.uid())));

-- =============================================
-- STORAGE BUCKETS
-- =============================================

insert into storage.buckets (id, name, public)
values ('student-profiles','student-profiles', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('payment-documents','payment-documents', false)
on conflict (id) do update set public = false;

-- Storage policies: {user_id}/{...} folder ownership
drop policy if exists sp_profile_insert on storage.objects;
drop policy if exists sp_profile_select_own on storage.objects;
drop policy if exists sp_profile_update_own on storage.objects;
drop policy if exists sp_profile_delete_own on storage.objects;
drop policy if exists sp_profile_select_admin on storage.objects;

create policy sp_profile_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'student-profiles' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy sp_profile_select_own on storage.objects for select to authenticated
  using (bucket_id = 'student-profiles' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy sp_profile_update_own on storage.objects for update to authenticated
  using (bucket_id = 'student-profiles' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy sp_profile_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'student-profiles' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy sp_profile_select_admin on storage.objects for select to authenticated
  using (bucket_id = 'student-profiles' and public.is_admin((select auth.uid())));

drop policy if exists sp_pay_insert on storage.objects;
drop policy if exists sp_pay_select_own on storage.objects;
drop policy if exists sp_pay_select_admin on storage.objects;

create policy sp_pay_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy sp_pay_select_own on storage.objects for select to authenticated
  using (bucket_id = 'payment-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy sp_pay_select_admin on storage.objects for select to authenticated
  using (bucket_id = 'payment-documents' and public.is_admin((select auth.uid())));
